import { z } from "zod";

export const catalogueDocumentSchema = z.object({
  retailerId: z.string().uuid(),
  storeBranchId: z.string().uuid().optional(),
  sourceUrl: z.string().url().max(2048).optional(),
  storagePath: z.string().min(1).max(2048).optional(),
  contentHash: z.string().min(1).max(255).optional(),
  mimeType: z.string().min(1).max(255),
  originalFilename: z.string().min(1).max(512).optional(),
  capturedAt: z.string().datetime().optional(),
  pageCount: z.number().int().positive().optional(),
}).refine((value) => value.sourceUrl || value.storagePath, {
  message: "sourceUrl or storagePath is required",
  path: ["sourceUrl"],
});

export const catalogueExtractionSchema = z.object({
  documentId: z.string().uuid(),
  extractorType: z.string().min(1).max(100),
  extractorVersion: z.string().min(1).max(100),
  rawText: z.string().max(1_000_000).optional(),
  extractedData: z.record(z.string(), z.unknown()).optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export const specialCandidateSchema = z.object({
  extractionId: z.string().uuid(),
  retailerId: z.string().uuid(),
  storeBranchId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  title: z.string().max(500).optional(),
  brand: z.string().max(255).optional(),
  unit: z.string().max(100).optional(),
  regularPrice: z.number().nonnegative().optional(),
  specialPrice: z.number().nonnegative().optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  sourceUrl: z.string().url().max(2048).optional(),
  sourceType: z.string().max(100).optional(),
  confidence: z.number().min(0).max(1).optional(),
  rawPayload: z.record(z.string(), z.unknown()).default({}),
});
