import { test, expect } from "@playwright/test";

import { calculateBasketSavings } from "@/lib/basket/savings-summary";

test.describe("basket savings summary", () => {
  test("selects the cheapest verified offer per product", () => {
    const result = calculateBasketSavings([
      { productId: "milk", retailerId: "a", retailerName: "A", price: 30, currency: "ZAR", quantity: 2 },
      { productId: "milk", retailerId: "b", retailerName: "B", price: 27, currency: "ZAR", quantity: 2 },
      { productId: "coffee", retailerId: "a", retailerName: "A", price: 80, currency: "ZAR", quantity: 1 },
    ], "ZAR");

    expect(result.currentCost).toBe(167);
    expect(result.optimizedCost).toBe(134);
    expect(result.savings).toBe(33);
    expect(result.savingsPercent).toBe(19.76);
    expect(result.currency).toBe("ZAR");
  });

  test("never reports negative savings", () => {
    const result = calculateBasketSavings([
      { productId: "milk", retailerId: "a", retailerName: "A", price: 20, currency: "ZAR", quantity: 1 },
    ], "ZAR");

    expect(result.savings).toBe(0);
    expect(result.savingsPercent).toBe(0);
  });
});
