import { test, expect } from "@playwright/test";
import { optimizeFulfilment, type FulfilmentRule } from "@/lib/basket/fulfilment-optimization";

const items = [
  { productId: "p1", quantity: 1 },
  { productId: "p2", quantity: 1 },
];

const offers = [
  { productId: "p1", retailerId: "r1", retailerName: "Store A", branchId: "b1", branchName: "A Main", specialId: "s1", unitPrice: 10, currency: "ZAR" },
  { productId: "p2", retailerId: "r1", retailerName: "Store A", branchId: "b1", branchName: "A Main", specialId: "s2", unitPrice: 10, currency: "ZAR" },
  { productId: "p1", retailerId: "r2", retailerName: "Store B", branchId: "b2", branchName: "B Main", specialId: "s3", unitPrice: 5, currency: "ZAR" },
  { productId: "p2", retailerId: "r2", retailerName: "Store B", branchId: "b2", branchName: "B Main", specialId: "s4", unitPrice: 5, currency: "ZAR" },
];

const deliveryRules: FulfilmentRule[] = [
  { retailerId: "r1", branchId: "b1", fulfilmentMode: "delivery", isAvailable: true, deliveryFee: 0, minimumOrderValue: 0, currency: "ZAR" },
  { retailerId: "r2", branchId: "b2", fulfilmentMode: "delivery", isAvailable: true, deliveryFee: 0, minimumOrderValue: 0, currency: "ZAR" },
];

test.describe("optimizeFulfilment", () => {
  test("chooses the cheapest complete retailer when verified fulfilment is equal", () => {
    const result = optimizeFulfilment(items, offers, deliveryRules, { maxStores: 2 });
    expect(result?.totalProductCost).toBe(10);
    expect(result?.retailerCount).toBe(1);
    expect(result?.totalLandedCost).toBe(10);
  });

  test("requires an available delivery rule for every selected offer", () => {
    const result = optimizeFulfilment(items, offers, [deliveryRules[0]], { maxStores: 2 });
    expect(result?.retailerCount).toBe(1);
    expect(result?.allocations.every((allocation) => allocation.retailerId === "r1")).toBe(true);
  });

  test("uses branch-specific rules in preference to retailer-wide rules", () => {
    const result = optimizeFulfilment([{ productId: "p1", quantity: 1 }], offers, [
      { retailerId: "r1", branchId: null, fulfilmentMode: "delivery", isAvailable: true, deliveryFee: 50, minimumOrderValue: 0, currency: "ZAR" },
      { retailerId: "r1", branchId: "b1", fulfilmentMode: "delivery", isAvailable: true, deliveryFee: 2, minimumOrderValue: 0, currency: "ZAR" },
      { retailerId: "r2", branchId: "b2", fulfilmentMode: "delivery", isAvailable: true, deliveryFee: 20, minimumOrderValue: 0, currency: "ZAR" },
    ], { maxStores: 1 });
    expect(result?.totalLandedCost).toBe(12);
    expect(result?.deliveryFees).toBe(2);
  });

  test("includes delivery fees once per fulfilment scope", () => {
    const result = optimizeFulfilment(items, offers, [
      { retailerId: "r1", branchId: "b1", fulfilmentMode: "delivery", isAvailable: true, deliveryFee: 0, minimumOrderValue: 0, currency: "ZAR" },
      { retailerId: "r2", branchId: "b2", fulfilmentMode: "delivery", isAvailable: true, deliveryFee: 20, minimumOrderValue: 0, currency: "ZAR" },
    ], { maxStores: 2 });
    expect(result?.totalLandedCost).toBe(10);
    expect(result?.deliveryFees).toBe(0);
  });

  test("treats minimum order as a hard constraint rather than a surcharge", () => {
    const result = optimizeFulfilment([{ productId: "p1", quantity: 1 }], offers, [
      { retailerId: "r1", branchId: "b1", fulfilmentMode: "delivery", isAvailable: true, deliveryFee: 0, minimumOrderValue: 20, currency: "ZAR" },
      { retailerId: "r2", branchId: "b2", fulfilmentMode: "delivery", isAvailable: true, deliveryFee: 0, minimumOrderValue: 0, currency: "ZAR" },
    ], { maxStores: 1 });
    expect(result?.totalProductCost).toBe(5);
    expect(result?.minimumOrderSurcharges).toBe(0);
    expect(result?.allocations[0].retailerId).toBe("r2");
  });

  test("combines delivery, minimum order and store-visit cost", () => {
    const result = optimizeFulfilment(items, offers, [
      { retailerId: "r1", branchId: "b1", fulfilmentMode: "delivery", isAvailable: true, deliveryFee: 5, minimumOrderValue: 30, currency: "ZAR" },
      { retailerId: "r2", branchId: "b2", fulfilmentMode: "delivery", isAvailable: true, deliveryFee: 3, minimumOrderValue: 0, currency: "ZAR" },
    ], { maxStores: 2, storeVisitCost: 2 });
    expect(result?.totalLandedCost).toBe(15);
    expect(result?.deliveryFees).toBe(3);
    expect(result?.storeVisitCost).toBe(2);
  });

  test("does not combine offers and fulfilment rules from different currencies", () => {
    const result = optimizeFulfilment([{ productId: "p1", quantity: 1 }], [
      { ...offers[0], currency: "USD" },
      offers[2],
    ], [
      { ...deliveryRules[0], currency: "ZAR" },
      deliveryRules[1],
    ], { maxStores: 1 });
    expect(result?.allocations[0].retailerId).toBe("r2");
    expect(result?.totalLandedCost).toBe(5);
  });

  test("returns null when no delivery rule can cover the basket", () => {
    const result = optimizeFulfilment(items, offers, [], { maxStores: 2 });
    expect(result).toBeNull();
  });
});
