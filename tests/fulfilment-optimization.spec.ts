import { describe, expect, it } from "vitest";
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

describe("optimizeFulfilment", () => {
  it("chooses the cheapest complete retailer when verified fulfilment is equal", () => {
    const result = optimizeFulfilment(items, offers, deliveryRules, { maxStores: 2 });
    expect(result?.totalProductCost).toBe(10);
    expect(result?.retailerCount).toBe(1);
    expect(result?.totalLandedCost).toBe(10);
  });

  it("requires an available verified delivery rule for every selected offer", () => {
    const result = optimizeFulfilment(items, offers, [deliveryRules[0]], { maxStores: 2 });
    expect(result?.retailerCount).toBe(1);
    expect(result?.allocations.every((allocation) => allocation.retailerId === "r1")).toBe(true);
  });

  it("uses branch-specific rules in preference to retailer-wide rules", () => {
    const result = optimizeFulfilment([{ productId: "p1", quantity: 1 }], offers, [
      { retailerId: "r1", branchId: null, fulfilmentMode: "delivery", isAvailable: true, deliveryFee: 50, minimumOrderValue: 0, currency: "ZAR" },
      { retailerId: "r1", branchId: "b1", fulfilmentMode: "delivery", isAvailable: true, deliveryFee: 2, minimumOrderValue: 0, currency: "ZAR" },
      { retailerId: "r2", branchId: "b2", fulfilmentMode: "delivery", isAvailable: true, deliveryFee: 20, minimumOrderValue: 0, currency: "ZAR" },
    ], { maxStores: 1 });
    expect(result?.totalLandedCost).toBe(12);
    expect(result?.deliveryFees).toBe(2);
  });

  it("includes delivery fees once per fulfilment scope", () => {
    const result = optimizeFulfilment(items, offers, [
      { retailerId: "r1", branchId: "b1", fulfilmentMode: "delivery", isAvailable: true, deliveryFee: 0, minimumOrderValue: 0, currency: "ZAR" },
      { retailerId: "r2", branchId: "b2", fulfilmentMode: "delivery", isAvailable: true, deliveryFee: 20, minimumOrderValue: 0, currency: "ZAR" },
    ], { maxStores: 2 });
    expect(result?.totalLandedCost).toBe(10);
    expect(result?.deliveryFees).toBe(0);
  });

  it("treats minimum order as a hard constraint rather than a surcharge", () => {
    const result = optimizeFulfilment([{ productId: "p1", quantity: 1 }], offers, [
      { retailerId: "r1", branchId: "b1", fulfilmentMode: "delivery", isAvailable: true, deliveryFee: 0, minimumOrderValue: 20, currency: "ZAR" },
      { retailerId: "r2", branchId: "b2", fulfilmentMode: "delivery", isAvailable: true, deliveryFee: 0, minimumOrderValue: 0, currency: "ZAR" },
    ], { maxStores: 1 });
    expect(result?.totalProductCost).toBe(5);
    expect(result?.minimumOrderSurcharges).toBe(0);
    expect(result?.allocations[0].retailerId).toBe("r2");
  });

  it("combines delivery, minimum order and store-visit cost", () => {
    const result = optimizeFulfilment(items, offers, [
      { retailerId: "r1", branchId: "b1", fulfilmentMode: "delivery", isAvailable: true, deliveryFee: 5, minimumOrderValue: 30, currency: "ZAR" },
      { retailerId: "r2", branchId: "b2", fulfilmentMode: "delivery", isAvailable: true, deliveryFee: 3, minimumOrderValue: 0, currency: "ZAR" },
    ], { maxStores: 2, storeVisitCost: 2 });
    expect(result?.totalLandedCost).toBe(15);
    expect(result?.deliveryFees).toBe(3);
    expect(result?.storeVisitCost).toBe(2);
  });

  it("returns null when no verified fulfilment rule can cover the basket", () => {
    const result = optimizeFulfilment(items, offers, [], { maxStores: 2 });
    expect(result).toBeNull();
  });
});
