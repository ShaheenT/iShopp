import { z } from "zod";

export const catalogQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  category: z.string().trim().max(120).optional(),
  retailer: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type CatalogQuery = z.infer<typeof catalogQuerySchema>;
