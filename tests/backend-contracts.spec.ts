import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

test.describe("backend migration contracts", () => {
  test("community verifier access is created once before trust RPCs", () => {
    const intelligence = read("supabase/migrations/0014_community_price_intelligence.sql");
    const trust = read("supabase/migrations/0015_trust_rewards.sql");
    expect(intelligence).toContain("create table public.community_price_verifiers");
    expect(intelligence).toContain("revoke all on table public.community_price_verifiers from anon, authenticated");
    expect(trust).not.toContain("create table public.community_price_verifiers");
    expect(trust).toContain("public.community_price_verifiers");
    expect(trust.indexOf("create or replace function public.verify_community_price")).toBeGreaterThan(-1);
    expect(trust).toContain("revoke all on function public.recalculate_community_trust(uuid) from public");
    expect(trust).not.toContain("grant execute on function public.recalculate_community_trust(uuid) to authenticated");
  });

  test("community submissions require trusted catalogue entities", () => {
    const sql = read("supabase/migrations/0020_community_submission_integrity.sql");
    expect(sql).toContain("verified product required");
    expect(sql).toContain("verified active retailer required");
    expect(sql).toContain("active retailer branch required");
    expect(sql).toContain("observed price must be greater than zero");
    expect(sql).toContain("observed time cannot be in the future");
    expect(sql).toContain("revoke all on function public.submit_community_price");
    expect(sql).toContain("grant execute on function public.submit_community_price");
  });

  test("verified community prices exclude inactive or mismatched branches", () => {
    const sql = read("supabase/migrations/0021_verified_community_price_scope.sql");
    expect(sql).toContain("create or replace function public.get_verified_community_prices");
    expect(sql).toContain("left join public.store_branches sb");
    expect(sql).toContain("sb.retailer_id = cps.retailer_id");
    expect(sql).toContain("sb.is_active");
    expect(sql).toContain("cps.store_branch_id is null");
  });

  test("community risk signals use the same active commercial scope", () => {
    const sql = read("supabase/migrations/0022_community_risk_scope.sql");
    expect(sql).toContain("create or replace function public.get_community_price_risk");
    expect(sql).toContain("left join public.store_branches sb");
    expect(sql).toContain("sb.retailer_id = s.retailer_id");
    expect(sql).toContain("sb.is_active");
    expect(sql).toContain("s.store_branch_id = v_branch_id");
    expect(sql).toContain("least(100, v_score)");
  });

  test("action integrity validates branch-specific commercial facts", () => {
    const sql = read("supabase/migrations/0018_action_integrity.sql");
    expect(sql).toContain("create or replace function public.create_verified_shopping_plan");
    expect(sql).toContain("line total mismatch");
    expect(sql).toContain("minimum order constraint not met");
    expect(sql).toContain("currency");
    expect(sql).toContain("store_branches sb");
  });

  test("shopping plans must represent the basket exactly", () => {
    const sql = read("supabase/migrations/0023_shopping_plan_basket_integrity.sql");
    expect(sql).toContain("plan items do not match basket");
    expect(sql).toContain("duplicate basket product in plan");
    expect(sql).toContain("plan item does not match basket quantity");
    expect(sql).toContain("shopping_basket_items");
    expect(sql).toContain("create or replace function public.create_verified_shopping_plan");
  });

  test("community evidence storage is private and user-scoped", () => {
    const sql = read("supabase/migrations/0024_community_price_evidence_storage.sql");
    expect(sql).toContain("community-price-evidence");
    expect(sql).toContain("public, false");
    expect(sql).toContain("storage.foldername(name)");
    expect(sql).toContain("auth.uid()::text");
    expect(sql).toContain("for insert");
    expect(sql).toContain("for select");
  });

  test("anomaly detection is advisory and verifier-gated", () => {
    const sql = read("supabase/migrations/0019_community_anomaly_detection.sql");
    expect(sql).toContain("Anomaly detection is a review signal only");
    expect(sql).toContain("community_price_verifiers");
    expect(sql).toContain("extreme_deviation_from_verified_median");
    expect(sql).toContain("duplicate_observation");
    expect(sql).toContain("high_submission_velocity");
    expect(sql).toContain("high_rejection_rate");
    expect(sql).toContain("least(100, v_score)");
  });
});

test.describe("API contracts", () => {
  test("community verification endpoints enforce UUID validation and authentication", () => {
    const verify = read("app/api/community/prices/[submissionId]/verify/route.ts");
    const reject = read("app/api/community/prices/[submissionId]/reject/route.ts");
    const risk = read("app/api/community/prices/[submissionId]/risk/route.ts");

    for (const route of [verify, reject, risk]) {
      expect(route).toContain("z.string().uuid()");
      expect(route).toContain("supabase.auth.getUser()");
      expect(route).toContain("401");
    }
    expect(verify).toContain('"verify_community_price"');
    expect(reject).toContain('"reject_community_price"');
    expect(risk).toContain('"get_community_price_risk"');
  });

  test("community evidence upload is authenticated, image-only, size-limited and private", () => {
    const route = read("app/api/community/evidence/route.ts");
    expect(route).toContain("supabase.auth.getUser()");
    expect(route).toContain("401");
    expect(route).toContain("10 * 1024 * 1024");
    expect(route).toContain("image/jpeg");
    expect(route).toContain("community-price-evidence");
    expect(route).toContain("sourceHash");
    expect(route).toContain("evidence_file_required");
  });

  test("product search only exposes verified catalogue products", () => {
    const route = read("app/api/products/search/route.ts");
    expect(route).toContain("verification_status");
    expect(route).toContain('"verified"');
    expect(route).toContain("retailer_id");
    expect(route).toContain("ilike");
    expect(route).toContain("barcode");
  });

  test("branch lookup only exposes active retailer branches", () => {
    const route = read("app/api/retailers/[retailerId]/branches/route.ts");
    expect(route).toContain("z.string().uuid()");
    expect(route).toContain("is_active");
    expect(route).toContain("retailer_id");
  });

  test("verified price comparison is authenticated and server-sourced", () => {
    const route = read("app/api/products/[productId]/compare/route.ts");
    expect(route).toContain("z.string().uuid()");
    expect(route).toContain("supabase.auth.getUser()");
    expect(route).toContain("401");
    expect(route).toContain('"compare_product_prices"');
    expect(route).not.toContain("special_price:");
  });

  test("fulfilment optimization does not accept commercial truth from clients", () => {
    const route = read("app/api/basket/[basketId]/fulfilment-optimize/route.ts");
    expect(route).toContain("maxStores");
    expect(route).toContain("storeVisitCost");
    expect(route).not.toContain("deliveryFee");
    expect(route).not.toContain("minimumOrder");
    expect(route).toContain("get_basket_fulfilment_inputs");
  });

  test("shopping plan creation uses verified server-side snapshots", () => {
    const route = read("app/api/basket/[basketId]/plan/route.ts");
    expect(route).toContain("get_basket_intelligence_inputs");
    expect(route).toContain("get_basket_fulfilment_inputs");
    expect(route).toContain("create_verified_shopping_plan");
    expect(route).toContain("expiresAt");
  });
});
