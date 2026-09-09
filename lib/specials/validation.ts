import { z } from "zod";

const isoDate = z.string().datetime({ offset: true });

export const publicSpecialQuerySchema = z.object({
  retailerId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(24),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const createSpecialSchema = z.object({
  productId: z.string().uuid(),
  retailerId: z.string().uuid(),
  storeBranchId: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(1).max(240).nullable().optional(),
  regularPrice: z.number().finite().nonnegative().nullable().optional(),
  specialPrice: z.number().finite().nonnegative(),
  startsAt: isoDate,
  endsAt: isoDate.nullable().optional(),
  sourceUrl: z.string().url().max(2048).nullable().optional(),
  sourceType: z.string().trim().min(1).max(50).nullable().optional(),
}).superRefine((value, ctx) => {
  if (value.endsAt && new Date(value.endsAt) <= new Date(value.startsAt)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["endsAt"],
      message: "endsAt must be later than startsAt",
    });
  }
  if (value.regularPrice !== null && value.regularPrice !== undefined && value.regularPrice < value.specialPrice) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["regularPrice"],
      message: "regularPrice must be greater than or equal to specialPrice",
    });
  }
});

export type CreateSpecialInput = z.infer<typeof createSpecialSchema>;
