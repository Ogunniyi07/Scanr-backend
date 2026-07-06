import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/requireAuth";

export const userRouter = Router();

// Every route below runs requireAuth first - req.userId is guaranteed to exist.
userRouter.use(requireAuth);

// GET /user/me
userRouter.get("/me", async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  const { passwordHash: _, ...safeUser } = user;
  res.json(safeUser);
});

const updateProfileSchema = z.object({
  fullName: z.string().min(1).optional(),
  businessName: z.string().optional(),
  avatarUrl: z.string().url().optional(),
});

// PUT /user/profile
userRouter.put("/profile", async (req, res) => {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
  }

  const updated = await prisma.user.update({
    where: { id: req.userId },
    data: parsed.data,
  });

  const { passwordHash: _, ...safeUser } = updated;
  res.json(safeUser);
});

const notificationsSchema = z.object({
  scanComplete: z.boolean().optional(),
  weeklyReport: z.boolean().optional(),
  securityAlerts: z.boolean().optional(),
  productUpdates: z.boolean().optional(),
  exportReady: z.boolean().optional(),
});

// PUT /user/notifications
userRouter.put("/notifications", async (req, res) => {
  const parsed = notificationsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid input" });
  }

  const data = parsed.data;
  const updated = await prisma.user.update({
    where: { id: req.userId },
    data: {
      ...(data.scanComplete !== undefined && { notifyScanComplete: data.scanComplete }),
      ...(data.weeklyReport !== undefined && { notifyWeeklyReport: data.weeklyReport }),
      ...(data.securityAlerts !== undefined && { notifySecurityAlerts: data.securityAlerts }),
      ...(data.productUpdates !== undefined && { notifyProductUpdates: data.productUpdates }),
      ...(data.exportReady !== undefined && { notifyExportReady: data.exportReady }),
    },
  });

  const { passwordHash: _, ...safeUser } = updated;
  res.json(safeUser);
});
