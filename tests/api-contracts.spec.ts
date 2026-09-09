import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

test.describe("basket API contracts", () => {
  test("basket collection is authenticated and user-scoped", () => {
    const route = read("app/api/baskets/route.ts");
    expect(route).toContain("supabase.auth.getUser()");
    expect(route).toContain('"shopping_baskets"');
    expect(route).toContain("user_id");
    expect(route).toContain("401");
  });
  test("basket resource validates UUIDs and ownership", () => {
    const route = read("app/api/baskets/[basketId]/route.ts");
    expect(route).toContain("z.string().uuid()");
    expect(route).toContain("user_id");
    expect(route).toContain("basket_not_found");
  });
  test("basket items only accept verified products", () => {
    const route = read("app/api/baskets/[basketId]/items/route.ts");
    expect(route).toContain("z.string().uuid()");
    expect(route).toContain('verification_status", "verified"');
    expect(route).toContain("shopping_basket_items");
    expect(route).toContain("quantity");
  });
  test("basket item mutations are scoped to the owning basket", () => {
    const route = read("app/api/baskets/[basketId]/items/[itemId]/route.ts");
    expect(route).toContain("shopping_baskets.user_id");
    expect(route).toContain("basket_item_not_found");
    expect(route).toContain("quantity");
  });
  test("shopping plan reads are authenticated and user-scoped", () => {
    const route = read("app/api/baskets/[basketId]/plans/route.ts");
    expect(route).toContain("supabase.auth.getUser()");
    expect(route).toContain("shopping_plans");
    expect(route).toContain("shopping_plan_items");
    expect(route).toContain("user_id");
  });
  test("comparison API is authenticated and backed by verified comparison RPC", () => {
    const route = read("app/api/products/[productId]/compare/route.ts");
    expect(route).toContain("z.string().uuid()");
    expect(route).toContain("supabase.auth.getUser()");
    expect(route).toContain("compare_product_prices");
  });
  test("optimization APIs use server-side intelligence", () => {
    const optimize = read("app/api/basket/[basketId]/optimize/route.ts");
    const fulfilment = read("app/api/basket/[basketId]/fulfilment-optimize/route.ts");
    expect(optimize).toContain("get_basket_intelligence_inputs");
    expect(fulfilment).toContain("get_basket_fulfilment_inputs");
    expect(fulfilment).toContain("storeVisitCost");
    expect(fulfilment).not.toContain("bodySchema = z.object({ deliveryFee");
    expect(fulfilment).not.toContain("bodySchema = z.object({ minimumOrder");
  });
  test("basket savings uses verified intelligence", () => {
    const route = read("app/api/basket/[basketId]/savings/route.ts");
    expect(route).toContain("get_basket_intelligence_inputs");
    expect(route).toContain("verified: true");
  });
});
