import { test, expect } from "@playwright/test";
import { optimizeSavings } from "@/lib/basket/savings-optimization";

const items = [
  { productId: "milk", quantity: 2 },
  { productId: "bread", quantity: 1 },
];

const offers = [
  { productId: "milk", retailerId: "a", retailerName: "Alpha", branchId: "a1", branchName: "Alpha CBD", specialId: "m1", unitPrice: 20, currency: "ZAR" },
  { productId: "bread", retailerId: "a", retailerName: "Alpha", branchId: "a1", branchName: "Alpha CBD", specialId: "b1", unitPrice: 20, currency: "ZAR" },
  { productId: "milk", retailerId: "b", retailerName: "Bravo", branchId: "b1", branchName: "Bravo CBD", specialId: "m2", unitPrice: 15, currency: "ZAR" },
  { productId: "bread", retailerId: "b", retailerName: "Bravo", branchId: "b1", branchName: "Bravo CBD", specialId: "b2", unitPrice: 30, currency: "ZAR" },
];

test.describe("optimizeSavings", () => {
  test("chooses the split basket when store visits are free", () => {
    const result = optimizeSavings(items, offers, { maxStores: 2, storeVisitCost: 0 });
    expect(result?.totalProductCost).toBe(50);
    expect(result?.retailerCount).toBe(2);
  });

  test("chooses one retailer when the extra visit costs more than the saving", () => {
    const result = optimizeSavings(items, offers, { maxStores: 2, storeVisitCost: 10 });
    expect(result?.totalProductCost).toBe(60);
    expect(result?.totalLandedCost).toBe(70);
    expect(result?.retailerCount).toBe(1);
    expect(result?.retailerSubtotals[0].retailerName).toBe("Alpha");
  });

  test("respects maxStores", () => {
    const result = optimizeSavings(items, offers, { maxStores: 1 });
    expect(result?.retailerCount).toBe(1);
    expect(result?.totalProductCost).toBe(60);
  });

  test("returns null for an incomplete basket", () => {
    const result = optimizeSavings([...items, { productId: "eggs", quantity: 1 }], offers);
    expect(result).toBeNull();
  });
});
