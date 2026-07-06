import Anthropic from "@anthropic-ai/sdk";
import fs from "fs/promises";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// The shape we ask Claude to return. We validate against this loosely after parsing.
export interface ExtractedInvoiceData {
  merchantName: string | null;
  date: string | null;
  currency: string | null;
  taxAmount: number | null;
  totalAmount: number | null;
  lineItems: { description: string; qty: number; price: number }[];
  confidenceScore: number; // 0-1, how confident the model is in this extraction
  documentType: string; // e.g. "receipt", "invoice", "unknown"
  qualityScore: number; // 0-1, how legible/clear the source image was
}

const EXTRACTION_PROMPT = `You are an invoice/receipt data extraction system. Look at the attached document image and extract the following fields as JSON.

Respond with ONLY a raw JSON object, no markdown code fences, no commentary, matching exactly this shape:

{
  "merchantName": string or null,
  "date": string or null (format YYYY-MM-DD if determinable),
  "currency": string or null (3-letter ISO code like "NGN", "USD" if determinable),
  "taxAmount": number or null,
  "totalAmount": number or null,
  "lineItems": [{ "description": string, "qty": number, "price": number }],
  "confidenceScore": number between 0 and 1 (your confidence in this extraction overall),
  "documentType": string (e.g. "receipt", "invoice", "unknown"),
  "qualityScore": number between 0 and 1 (how clear/legible the source image is)
}

If a field cannot be determined, use null (or an empty array for lineItems). Do not invent data that isn't visible in the document.`;

function guessMediaType(mimeType: string): string {
  // Anthropic's API accepts these specific image types, plus PDFs as documents.
  const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  return allowed.includes(mimeType) ? mimeType : "image/jpeg";
}

export async function extractInvoiceData(
  filePath: string,
  mimeType: string
): Promise<ExtractedInvoiceData> {
  const fileBuffer = await fs.readFile(filePath);
  const base64Data = fileBuffer.toString("base64");

  const isPdf = mimeType === "application/pdf";

  const message = await anthropic.beta.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 1500,
    messages: [
      {
        role: "user",
        content: [
          isPdf
            ? {
                type: "document" as const,
                source: {
                  type: "base64" as const,
                  media_type: "application/pdf" as const,
                  data: base64Data,
                },
              }
            : {
                type: "image" as const,
                source: {
                  type: "base64" as const,
                  media_type: guessMediaType(mimeType) as
                    | "image/jpeg"
                    | "image/png"
                    | "image/gif"
                    | "image/webp",
                  data: base64Data,
                },
              },
          {
            type: "text" as const,
            text: EXTRACTION_PROMPT,
          },
        ],
      },
    ],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from extraction model");
  }

  let parsed: any;
  try {
    // Strip markdown code fences in case the model adds them despite instructions.
    const cleaned = textBlock.text.replace(/```json|```/g, "").trim();
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new Error("Failed to parse extraction response as JSON: " + textBlock.text.slice(0, 200));
  }

  return {
    merchantName: parsed.merchantName ?? null,
    date: parsed.date ?? null,
    currency: parsed.currency ?? null,
    taxAmount: typeof parsed.taxAmount === "number" ? parsed.taxAmount : null,
    totalAmount: typeof parsed.totalAmount === "number" ? parsed.totalAmount : null,
    lineItems: Array.isArray(parsed.lineItems) ? parsed.lineItems : [],
    confidenceScore: typeof parsed.confidenceScore === "number" ? parsed.confidenceScore : 0,
    documentType: parsed.documentType ?? "unknown",
    qualityScore: typeof parsed.qualityScore === "number" ? parsed.qualityScore : 0,
  };
}