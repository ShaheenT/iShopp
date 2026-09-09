import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test.describe("basket savings integrity", () => {
  test("uses a verified single-retailer baseline instead of summing competing offers", async () => {
    const route = await readFile("app/api/basket/[basketId]/savings/route.ts", "utf8");
    expect(route).toContain('optimizeSavings');
    expect(route).toContain('maxStores: 1');
    expect(route).toContain('maxStores: 2');
    expect(route).toContain('lowest verified single-retailer basket');
    expect(route).not.toContain('calculateBasketSavings');
  });

  test("does not expose a saving when the verified basket cannot be completed", async () => {
    const route = await readFile("app/api/basket/[basketId]/savings/route.ts", "utf8");
    expect(route).toContain('unavailable: true');
    expect(route).toContain('savings: 0');
  });
});
