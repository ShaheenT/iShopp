import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

const migrationPath = "supabase/migrations/0015_trust_rewards.sql";
const hardeningPath = "supabase/migrations/0016_community_hardening.sql";

test("trust and rewards migration preserves ledger and verification boundaries", async () => {
  const migration = await readFile(migrationPath, "utf8");
  const hardening = await readFile(hardeningPath, "utf8");

  expect(migration).toContain("community_trust_profiles");
  expect(migration).toContain("community_reward_ledger");
  expect(migration).toContain("community_reward_once_per_submission");
  expect(migration).toContain("Verified community price contribution");
  expect(migration).toContain("recalculate_community_trust");
  expect(migration).toContain("get_community_reward_summary");
  expect(migration).toContain("self verification is not allowed");
  expect(migration).toContain("only pending community prices can be verified");

  expect(hardening).toContain("revoke execute on function public.recalculate_community_trust(uuid) from authenticated");
  expect(hardening).toContain("duplicate community price observation");
  expect(hardening).toContain("daily community contribution limit reached");
  expect(hardening).toContain("get_community_price_intelligence");
  expect(hardening).toContain("percentile_cont(0.5)");
});
