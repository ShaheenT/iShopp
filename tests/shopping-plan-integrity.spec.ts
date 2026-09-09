import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test.describe("shopping plan integrity", () => {
  test("route derives commercial inputs server-side", async () => {
    const route = await readFile("app/api/basket/[basketId]/plan/route.ts", "utf8");
    expect(route).toContain('get_basket_intelligence_inputs');
    expect(route).toContain('get_basket_fulfilment_inputs');
    expect(route).toContain('create_verified_shopping_plan');
    expect(route).toContain('verified_specials_and_fulfilment_rules');
    expect(route).not.toContain('p_total_landed_cost: parsedBody.data');
  });

  test("rewards route reads the protected reward summary RPC", async () => {
    const route = await readFile("app/api/rewards/route.ts", "utf8");
    expect(route).toContain('get_community_reward_summary');
    expect(route).toContain('unauthorized');
    expect(route).toContain('verified_community_reward_ledger');
  });
});
