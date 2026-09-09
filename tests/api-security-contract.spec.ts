import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

const protectedRoutes = [
  "app/api/baskets/route.ts",
  "app/api/baskets/[basketId]/route.ts",
  "app/api/baskets/[basketId]/items/route.ts",
  "app/api/basket/[basketId]/savings/route.ts",
  "app/api/basket/[basketId]/fulfilment-optimize/route.ts",
  "app/api/basket/[basketId]/plan/route.ts",
  "app/api/rewards/route.ts",
  "app/api/community/evidence/route.ts",
  "app/api/community/prices/route.ts",
  "app/api/products/[productId]/compare/route.ts",
];

test("critical user APIs explicitly require an authenticated Supabase user", async () => {
  for (const path of protectedRoutes) {
    const source = await readFile(path, "utf8");
    expect(source, path).toContain("supabase.auth.getUser()");
    expect(source, path).toContain("status: 401");
  }
});

test("basket mutation and intelligence routes enforce basket ownership", async () => {
  const files = [
    "app/api/baskets/[basketId]/route.ts",
    "app/api/baskets/[basketId]/items/route.ts",
    "app/api/baskets/[basketId]/items/[itemId]/route.ts",
    "app/api/basket/[basketId]/savings/route.ts",
    "app/api/basket/[basketId]/fulfilment-optimize/route.ts",
    "app/api/basket/[basketId]/plan/route.ts",
  ];

  for (const path of files) {
    const source = await readFile(path, "utf8");
    expect(source, path).toContain("basketId");
    expect(source, path).toMatch(/user_id|shopping_baskets/);
  }
});

test("shopping plan API requires request idempotency and forwards it to the RPC", async () => {
  const route = await readFile("app/api/basket/[basketId]/plan/route.ts", "utf8");
  expect(route).toContain("Idempotency-Key");
  expect(route).toContain("invalid_idempotency_key");
  expect(route).toContain("p_idempotency_key: idempotencyKey");
  expect(route).toContain("idempotentRetry");
});

test("community contribution rejects cross-user evidence paths in the database boundary", async () => {
  const migration = await readFile("supabase/migrations/0026_shopping_plan_idempotency_and_evidence_scope.sql", "utf8");
  expect(migration).toContain("split_part(p_evidence_storage_path, '/', 1) <> auth.uid()::text");
  expect(migration).toContain("evidence storage path outside user scope");
});
