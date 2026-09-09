import { test, expect } from "@playwright/test";

import { createSpecialSchema } from "../lib/specials/validation";

test.describe("special input validation", () => {
  test("accepts a valid special", () => {
    const result = createSpecialSchema.safeParse({
      productId: "11111111-1111-4111-8111-111111111111",
      retailerId: "22222222-2222-4222-8222-222222222222",
      specialPrice: 49.99,
      regularPrice: 59.99,
      startsAt: "2026-09-09T08:00:00+02:00",
      endsAt: "2026-09-16T23:59:59+02:00",
      sourceType: "catalogue",
    });

    expect(result.success).toBe(true);
  });

  test("rejects an inverted date window", () => {
    const result = createSpecialSchema.safeParse({
      productId: "11111111-1111-4111-8111-111111111111",
      retailerId: "22222222-2222-4222-8222-222222222222",
      specialPrice: 49.99,
      startsAt: "2026-09-16T08:00:00+02:00",
      endsAt: "2026-09-09T23:59:59+02:00",
    });

    expect(result.success).toBe(false);
  });

  test("rejects a regular price below the special price", () => {
    const result = createSpecialSchema.safeParse({
      productId: "11111111-1111-4111-8111-111111111111",
      retailerId: "22222222-2222-4222-8222-222222222222",
      specialPrice: 59.99,
      regularPrice: 49.99,
      startsAt: "2026-09-09T08:00:00+02:00",
    });

    expect(result.success).toBe(false);
  });
});
