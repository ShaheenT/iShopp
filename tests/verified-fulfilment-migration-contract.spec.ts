import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const migrationPath = fileURLToPath(new URL("../supabase/migrations/0012_verified_fulfilment.sql", import.meta.url));
const migration = readFileSync(migrationPath, "utf8");

test.describe("verified fulfilment migration contract", () => {
  test("defines the verified commercial-fact model", () => {
    expect(migration).toContain("create table public.fulfilment_rules");
    expect(migration).toContain("create table public.fulfilment_evidence");
    expect(migration).toContain("create table public.fulfilment_verification_events");
    expect(migration).toContain("minimum_order_value numeric(12,2)");
    expect(migration).toContain("starts_at timestamptz not null");
    expect(migration).toContain("ends_at timestamptz");
  });

  test("enforces retailer/branch integrity and verified-rule overlap protection", () => {
    expect(migration).toContain("fulfilment_rules_branch_retailer_fk");
    expect(migration).toContain("fulfilment_rules_no_verified_overlap");
    expect(migration).toContain("btree_gist");
  });

  test("requires evidence before verification and while verified", () => {
    expect(migration).toContain("verified fulfilment rule requires evidence");
    expect(migration).toContain("cannot remove the last usable evidence from a verified fulfilment rule");
    expect(migration).toContain("join lateral (");
    expect(migration).toContain("fe0.status in ('captured', 'processed')");
  });

  test("limits runtime fulfilment facts to effective verified delivery rules", () => {
    expect(migration).toContain("fr0.fulfilment_mode = 'delivery'");
    expect(migration).toContain("fr0.verification_status = 'verified'");
    expect(migration).toContain("fr0.starts_at <= now()");
    expect(migration).toContain("fr0.ends_at is null or fr0.ends_at > now()");
    expect(migration).toContain("(fr0.store_branch_id is not null) desc");
  });
});
