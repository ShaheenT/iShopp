import { z } from 'zod';

export const communityPriceSubmissionSchema = z.object({
  productId: z.string().uuid(),
  retailerId: z.string().uuid(),
  storeBranchId: z.string().uuid().nullable().optional(),
  observedPrice: z.number().finite().min(0),
  regularPrice: z.number().finite().min(0).nullable().optional(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  observedAt: z.string().datetime({ offset: true }).optional(),
  sourceUrl: z.string().url().nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  evidence: z.object({
    sourceUrl: z.string().url().nullable().optional(),
    storagePath: z.string().trim().min(1).max(1000).nullable().optional(),
    sourceHash: z.string().trim().min(1).max(255).nullable().optional(),
    extractedText: z.string().max(100000).nullable().optional(),
    extractedData: z.record(z.unknown()).optional(),
  }),
}).superRefine((value, ctx) => {
  if (value.regularPrice !== null && value.regularPrice !== undefined && value.regularPrice < value.observedPrice) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['regularPrice'], message: 'regularPrice cannot be below observedPrice' });
  }
  if (!value.evidence.sourceUrl && !value.evidence.storagePath) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['evidence'], message: 'sourceUrl or storagePath is required' });
  }
});

export type CommunityPriceSubmissionInput = z.infer<typeof communityPriceSubmissionSchema>;
