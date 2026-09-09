import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("shopping plan migration snapshots verified commercial inputs", async () => {
  const migration = await readFile("supabase/migrations/0017_shopping_plans.sql", "utf8");

  expect(migration).toContain("shopping_plans");
  expect(migration).toContain("shopping_plan_items");
  expect(migration).toContain("shopping_baskets");
  expect(migration).toContain("shopping_plan_items_owner_select");
  expect(migration).toContain("create_verified_shopping_plan");
  expect(migration).toContain("verification_status = 'verified'");
  expect(migration).toContain("fulfilment_mode = 'delivery'");
  expect(migration).toContain("starts_at <= now()");
  expect(migration).toContain("fulfilment_evidence");
  expect(migration).toContain("plan price mismatch");
  expect(migration).toContain("verified fulfilment rule unavailable");
});
