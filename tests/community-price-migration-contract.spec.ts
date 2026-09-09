import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("community price migration preserves the trusted observation boundary", () => {
  const sql = readFileSync(join(process.cwd(), "supabase/migrations/0014_community_price_intelligence.sql"), "utf8");

  expect(sql).toContain("create table public.community_price_submissions");
  expect(sql).toContain("create table public.community_price_evidence");
  expect(sql).toContain("create table public.community_price_verification_events");
  expect(sql).toContain("create table public.community_price_verifiers");
  expect(sql).toContain("verification_status public.verification_status not null default 'pending'");
  expect(sql).toContain("foreign key (store_branch_id, retailer_id)");
  expect(sql).toContain("create or replace function public.submit_community_price");
  expect(sql).toContain("create or replace function public.verify_community_price");
  expect(sql).toContain("usable evidence required before verification");
  expect(sql).toContain("grant execute on function public.submit_community_price");
  expect(sql).toContain("grant execute on function public.verify_community_price");
  expect(sql).toContain("grant execute on function public.get_verified_community_prices");
});
