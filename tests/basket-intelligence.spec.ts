import { test, expect } from "@playwright/test";
import { calculateBasketIntelligence } from "@/lib/basket/basket-intelligence";

const items = [
  { productId: "milk", quantity: 2 },
  { productId: "bread", quantity: 1 },
  { productId: "eggs", quantity: 1 },
];

const offers = [
  { productId: "milk", retailerId: "a", retailerName: "Alpha", branchId: "a1", branchName: "Alpha CBD", specialId: "m1", specialPrice: 20, currency: "ZAR" },
  { productId: "milk", retailerId: "b", retailerName: "Bravo", branchId: "b1", branchName: "Bravo CBD", specialId: "m2", specialPrice: 18, currency: "ZAR" },
  { productId: "bread", retailerId: "a", retailerName: "Alpha", branchId: "a1", branchName: "Alpha CBD", specialId: "b1", specialPrice: 15, currency: "ZAR" },
  { productId: "bread", retailerId: "b", retailerName: "Bravo", branchId: "b1", branchName: "Bravo CBD", specialId: "b2", specialPrice: 19, currency: "ZAR" },
  { productId: "eggs", retailerId: "a", retailerName: "Alpha", branchId: "a1", branchName: "Alpha CBD", specialId: "e1", specialPrice: 30, currency: "ZAR" },
  { productId: "eggs", retailerId: "b", retailerName: "Bravo", branchId: "b1", branchName: "Bravo CBD", specialId: "e2", specialPrice: 21, currency: "ZAR" },
];

test.describe("calculateBasketIntelligence", () => {
  test("finds the minimum split basket with quantity multiplication", () => {
    const result = calculateBasketIntelligence(items, offers, 2);
    expect(result.splitMinimum.total).toBe(72);
    expect(result.splitMinimum.retailerCount).toBe(2);
    expect(result.requestedQuantity).toBe(4);
  });

  test("finds the cheapest single-retailer basket", () => {
    const result = calculateBasketIntelligence(items, offers, 2);
    expect(result.singleRetailer.total).toBe(85);
    expect(result.singleRetailer.retailerSubtotals[0].retailerName).toBe("Bravo");
  });

  test("uses the cheapest complete strategy within the store cap", () => {
    const result = calculateBasketIntelligence(items, offers, 2);
    expect(result.practical.total).toBe(72);
    expect(result.practical.retailerCount).toBe(2);
    expect(result.savingsVsSingleRetailer).toBe(13);
    expect(result.savingsVsSplitMinimum).toBe(0);
  });

  test("reduces the practical strategy to one store when constrained", () => {
    const result = calculateBasketIntelligence(items, offers, 1);
    expect(result.practical.total).toBe(85);
    expect(result.practical.retailerCount).toBe(1);
  });

  test("marks a basket unavailable when an item has no verified offer", () => {
    const result = calculateBasketIntelligence([...items, { productId: "coffee", quantity: 1 }], offers);
    expect(result.splitMinimum.total).toBeNull();
    expect(result.splitMinimum.unavailableProductIds).toEqual(["coffee"]);
    expect(result.singleRetailer.total).toBeNull();
  });

  test("uses deterministic tie-breaking", () => {
    const tied = [
      ...offers,
      { productId: "coffee", retailerId: "b", retailerName: "Bravo", branchId: "b1", branchName: "Bravo CBD", specialId: "c1", specialPrice: 10, currency: "ZAR" },
      { productId: "coffee", retailerId: "a", retailerName: "Alpha", branchId: "a1", branchName: "Alpha CBD", specialId: "c2", specialPrice: 10, currency: "ZAR" },
    ];
    const result = calculateBasketIntelligence([{ productId: "coffee", quantity: 1 }], tied);
    expect(result.splitMinimum.allocations[0].retailerId).toBe("a");
  });
});
