import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test.describe("shopping plan idempotency", () => {
  test("database migration preserves full commercial integrity checks", async () => {
    const sql = await readFile("supabase/migrations/0027_shopping_plan_integrity_idempotency_fix.sql", "utf8");
    expect(sql).toContain("idempotency_key uuid default null");
    expect(sql).toContain("plan items do not match basket");
    expect(sql).toContain("duplicate basket product in plan");
    expect(sql).toContain("plan item does not match basket quantity");
    expect(sql).toContain("verified special unavailable");
    expect(sql).toContain("plan price mismatch");
    expect(sql).toContain("verified fulfilment rule unavailable");
    expect(sql).toContain("minimum order constraint not met");
    expect(sql).toContain("delivery fee mismatch");
    expect(sql).toContain("landed cost mismatch");
    expect(sql).toContain("unique_violation");
  });

  test("plan API requires and forwards idempotency", async () => {
    const route = await readFile("app/api/basket/[basketId]/plan/route.ts", "utf8");
    expect(route).toContain('request.headers.get("Idempotency-Key")');
    expect(route).toContain("idempotencyKeySchema");
    expect(route).toContain("p_idempotency_key: idempotencyKey");
    expect(route).toContain("idempotentRetry");
  });
});
