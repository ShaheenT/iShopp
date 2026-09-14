import { z } from "zod";

export const idSchema = z.string().uuid();

export const shareSchema = z.object({
  product_id: idSchema.optional(),
  special_id: idSchema.optional(),
  list_id: idSchema.optional(),
  channel: z.enum(["whatsapp", "copy_link", "native_share", "other"]),
}).refine((v) => v.product_id || v.special_id || v.list_id, {
  message: "A product, special or list is required",
});

export const shoppingListSchema = z.object({ name: z.string().trim().min(1).max(120) });

export const shoppingListItemSchema = z.object({
  product_id: idSchema.nullable().optional(),
  quantity: z.number().positive().max(100000),
  note: z.string().trim().max(500).nullable().optional(),
});

export const basketItemSchema = z.object({
  product_id: idSchema,
  quantity: z.number().positive().max(100000),
  special_id: idSchema.nullable().optional(),
});

export const checkoutSchema = z.object({
  basket_id: idSchema,
  return_url: z.string().url().max(2048).optional(),
});

export const scanSchema = z.object({
  barcode: z.string().trim().min(4).max(64).optional(),
  query: z.string().trim().min(1).max(200).optional(),
  image_url: z.string().url().max(2048).optional(),
}).refine((v) => v.barcode || v.query || v.image_url, {
  message: "barcode, query or image_url is required",
});
