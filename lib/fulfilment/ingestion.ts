import { z } from 'zod';

const isoDate = z.string().datetime({ offset: true });

export const fulfilmentIngestionSchema = z.object({
  retailerId: z.string().uuid(),
  storeBranchId: z.string().uuid().nullable().optional(),
  fulfilmentMode: z.enum(['delivery', 'pickup', 'collection']),
  deliveryFee: z.number().finite().min(0),
  minimumOrderValue: z.number().finite().min(0).nullable().optional(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  startsAt: isoDate,
  endsAt: isoDate.nullable().optional(),
  sourceUrl: z.string().url().nullable().optional(),
  sourceType: z.string().trim().min(1).max(100),
  sourceHash: z.string().trim().min(1).max(255).nullable().optional(),
  evidence: z.object({
    storagePath: z.string().trim().min(1).max(1000).nullable().optional(),
    sourceUrl: z.string().url().nullable().optional(),
    sourceHash: z.string().trim().min(1).max(255).nullable().optional(),
    extractedText: z.string().max(100000).nullable().optional(),
    extractedData: z.record(z.unknown()).optional(),
  }),
}).superRefine((value, ctx) => {
  if (!value.sourceUrl && !value.sourceHash) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['sourceUrl'], message: 'sourceUrl or sourceHash is required' });
  }
  if (!value.evidence.storagePath && !value.evidence.sourceUrl) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['evidence'], message: 'evidence storagePath or sourceUrl is required' });
  }
  if (value.endsAt && new Date(value.endsAt).getTime() <= new Date(value.startsAt).getTime()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endsAt'], message: 'endsAt must be after startsAt' });
  }
});

export type FulfilmentIngestionInput = z.infer<typeof fulfilmentIngestionSchema>;
