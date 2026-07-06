import { Router } from "express";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/requireAuth";
import { upload, UPLOADS_DIR } from "../lib/upload";
import { extractInvoiceData } from "../lib/anthropic";

export const scansRouter = Router();

scansRouter.use(requireAuth);

// Runs in the background after we've already responded to the upload request,
// so the client doesn't have to wait for the full Claude round-trip synchronously.
// It polls GET /scans/:scanId/status instead (see below).
async function processScanInBackground(scanId: string, filePath: string, mimeType: string) {
  const startedAt = Date.now();

  try {
    const extracted = await extractInvoiceData(filePath, mimeType);
    const processingTime = (Date.now() - startedAt) / 1000;

    await prisma.scan.update({
      where: { id: scanId },
      data: {
        status: extracted.confidenceScore < 0.4 ? "REVIEW_REQUIRED" : "COMPLETE",
        merchantName: extracted.merchantName,
        date: extracted.date,
        currency: extracted.currency,
        taxAmount: extracted.taxAmount,
        totalAmount: extracted.totalAmount,
        confidenceScore: extracted.confidenceScore,
        documentType: extracted.documentType,
        qualityScore: extracted.qualityScore,
        processingTime,
        lineItems: {
          create: extracted.lineItems.map((item) => ({
            description: item.description,
            qty: item.qty,
            price: item.price,
          })),
        },
      },
    });
  } catch (err) {
    console.error(`Scan ${scanId} extraction failed:`, err);
    await prisma.scan.update({
      where: { id: scanId },
      data: { status: "FAILED" },
    });
  }
}

// POST /scans - upload a receipt/invoice for processing
scansRouter.post("/", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }

  const scan = await prisma.scan.create({
    data: {
      userId: req.userId as string,
      fileName: req.file.originalname,
      previewUrl: `/uploads/${req.file.filename}`,
      status: "PROCESSING",
    },
  });

  // Fire-and-forget: don't await this, so the client gets an immediate response
  // and can start polling /status. Errors are caught and saved as FAILED status.
  processScanInBackground(scan.id, req.file.path, req.file.mimetype);

  res.status(202).json({
    scanId: scan.id,
    status: scan.status.toLowerCase(),
    createdAt: scan.createdAt,
  });
});

// GET /scans - list scan history with filters + pagination
const listQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
  status: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  vendor: z.string().optional(),
  totalMin: z.coerce.number().optional(),
  totalMax: z.coerce.number().optional(),
});

scansRouter.get("/", async (req, res) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid query params", errors: parsed.error.flatten() });
  }

  const { page, pageSize, status, dateFrom, dateTo, vendor, totalMin, totalMax } = parsed.data;

  const where: any = { userId: req.userId };
  if (status) where.status = status.toUpperCase();
  if (vendor) where.merchantName = { contains: vendor, mode: "insensitive" };
  if (dateFrom || dateTo) {
    where.date = {};
    if (dateFrom) where.date.gte = dateFrom;
    if (dateTo) where.date.lte = dateTo;
  }
  if (totalMin !== undefined || totalMax !== undefined) {
    where.totalAmount = {};
    if (totalMin !== undefined) where.totalAmount.gte = totalMin;
    if (totalMax !== undefined) where.totalAmount.lte = totalMax;
  }

  const [scans, totalCount] = await Promise.all([
    prisma.scan.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.scan.count({ where }),
  ]);

  res.json({
    scans: scans.map((s: (typeof scans)[number]) => ({
      id: s.id,
      vendorName: s.merchantName,
      description: s.documentType,
      date: s.date,
      grandTotal: s.totalAmount,
      status: s.status.toLowerCase(),
      previewUrl: s.previewUrl,
    })),
    totalCount,
  });
});

// GET /scans/:scanId/status - lightweight polling endpoint
scansRouter.get("/:scanId/status", async (req, res) => {
  const scan = await prisma.scan.findFirst({
    where: { id: req.params.scanId, userId: req.userId },
  });

  if (!scan) {
    return res.status(404).json({ message: "Scan not found" });
  }

  res.json({
    scanId: scan.id,
    status: scan.status.toLowerCase(),
    progress: scan.status === "PROCESSING" ? 50 : 100,
  });
});

// GET /scans/:scanId - full extracted result
scansRouter.get("/:scanId", async (req, res) => {
  const scan = await prisma.scan.findFirst({
    where: { id: req.params.scanId, userId: req.userId },
    include: { lineItems: true },
  });

  if (!scan) {
    return res.status(404).json({ message: "Scan not found" });
  }

  res.json(scan);
});

// PATCH /scans/:scanId - manual edits to extracted fields
const patchSchema = z.object({
  merchantName: z.string().optional(),
  date: z.string().optional(),
  currency: z.string().optional(),
  taxAmount: z.number().optional(),
  totalAmount: z.number().optional(),
  lineItems: z
    .array(z.object({ id: z.string().optional(), description: z.string(), qty: z.number(), price: z.number() }))
    .optional(),
});

scansRouter.patch("/:scanId", async (req, res) => {
  const existing = await prisma.scan.findFirst({
    where: { id: req.params.scanId, userId: req.userId },
  });
  if (!existing) {
    return res.status(404).json({ message: "Scan not found" });
  }

  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
  }

  const { lineItems, ...fields } = parsed.data;

  const updated = await prisma.scan.update({
    where: { id: existing.id },
    data: {
      ...fields,
      ...(lineItems && {
        lineItems: {
          deleteMany: {}, // replace all line items with the edited set
          create: lineItems.map((li) => ({ description: li.description, qty: li.qty, price: li.price })),
        },
      }),
    },
    include: { lineItems: true },
  });

  res.json(updated);
});

// POST /scans/:scanId/approve
scansRouter.post("/:scanId/approve", async (req, res) => {
  const existing = await prisma.scan.findFirst({
    where: { id: req.params.scanId, userId: req.userId },
  });
  if (!existing) {
    return res.status(404).json({ message: "Scan not found" });
  }

  await prisma.scan.update({ where: { id: existing.id }, data: { status: "APPROVED" } });
  res.json({ status: "approved" });
});

// POST /scans/:scanId/discard
scansRouter.post("/:scanId/discard", async (req, res) => {
  const existing = await prisma.scan.findFirst({
    where: { id: req.params.scanId, userId: req.userId },
  });
  if (!existing) {
    return res.status(404).json({ message: "Scan not found" });
  }

  await prisma.scan.update({ where: { id: existing.id }, data: { status: "DISCARDED" } });
  res.json({ status: "discarded" });
});

// DELETE /scans/:scanId - permanently remove
scansRouter.delete("/:scanId", async (req, res) => {
  const existing = await prisma.scan.findFirst({
    where: { id: req.params.scanId, userId: req.userId },
  });
  if (!existing) {
    return res.status(404).json({ message: "Scan not found" });
  }

  // Clean up the stored file too, not just the DB row.
  if (existing.previewUrl) {
    const filePath = path.join(UPLOADS_DIR, path.basename(existing.previewUrl));
    await fs.unlink(filePath).catch(() => {
      // File might already be gone - not worth failing the request over.
    });
  }

  await prisma.scan.delete({ where: { id: existing.id } });
  res.status(204).send();
});