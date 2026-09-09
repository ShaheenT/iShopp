import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test.describe("community contribution security", () => {
  test("submission contract requires an idempotency key and evidence", async () => {
    const schema = await readFile("lib/community/price-submission.ts", "utf8");
    expect(schema).toContain("idempotencyKey: z.string().uuid()");
    expect(schema).toContain("sourceUrl or storagePath is required");
  });

  test("price API forwards idempotency to the database RPC", async () => {
    const route = await readFile("app/api/community/prices/route.ts", "utf8");
    expect(route).toContain("p_idempotency_key: input.idempotencyKey");
    expect(route).toContain("submit_community_price");
  });

  test("evidence endpoint requires an authenticated user and validates image signatures", async () => {
    const route = await readFile("app/api/community/evidence/route.ts", "utf8");
    expect(route).toContain("supabase.auth.getUser()");
    expect(route).toContain("image/jpeg");
    expect(route).toContain("image/png");
    expect(route).toContain("image/webp");
    expect(route).toContain("10 * 1024 * 1024");
    expect(route).toContain("matchesSignature");
    expect(route).toContain("evidence_signature_mismatch");
    expect(route).toContain("userData.user.id");
  });

  test("evidence storage is private and user-folder scoped", async () => {
    const migration = await readFile("supabase/migrations/0024_community_price_evidence_storage.sql", "utf8");
    expect(migration).toContain("public, false");
    expect(migration).toContain("storage.foldername(name))[1] = auth.uid()::text");
  });

  test("community submissions and evidence have RLS boundaries", async () => {
    const migration = await readFile("supabase/migrations/0014_community_price_intelligence.sql", "utf8");
    expect(migration).toContain("alter table public.community_price_submissions enable row level security");
    expect(migration).toContain("alter table public.community_price_evidence enable row level security");
    expect(migration).toContain("revoke insert, update, delete on table public.community_price_submissions from authenticated");
  });
});
