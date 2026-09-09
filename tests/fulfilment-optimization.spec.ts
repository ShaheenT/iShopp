import { describe, expect, it } from "vitest";
import { optimizeFulfilment } from "@/lib/basket/fulfilment-optimization";

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

describe("optimizeFulfilment", () => {
  it("chooses the cheapest complete retailer when fulfilment is equal", () => {
    const result = optimizeFulfilment(items, offers, [], { maxStores: 2 });
    expect(result?.totalProductCost).toBe(10);
    expect(result?.retailerCount).toBe(1);
    expect(result?.totalLandedCost).toBe(10);
  });

  it("includes delivery fees once per selected retailer", () => {
    const result = optimizeFulfilment(items, offers, [
      { retailerId: "r1", deliveryFee: 0 },
      { retailerId: "r2", deliveryFee: 20 },
    ], { maxStores: 2 });
    expect(result?.totalLandedCost).toBe(10);
    expect(result?.deliveryFees).toBe(0);
  });

  it("applies a minimum-order surcharge when the selected retailer is below threshold", () => {
    const result = optimizeFulfilment([{ productId: "p1", quantity: 1 }], offers, [
      { retailerId: "r2", minimumOrder: 20 },
    ], { maxStores: 1 });
    expect(result?.totalProductCost).toBe(5);
    expect(result?.minimumOrderSurcharges).toBe(15);
    expect(result?.totalLandedCost).toBe(20);
  });

  it("combines delivery, minimum order and store-visit cost", () => {
    const result = optimizeFulfilment(items, offers, [
      { retailerId: "r1", deliveryFee: 5, minimumOrder: 30 },
      { retailerId: "r2", deliveryFee: 3, minimumOrder: 0 },
    ], { maxStores: 2, storeVisitCost: 2 });
    expect(result?.totalLandedCost).toBe(15);
    expect(result?.deliveryFees).toBe(3);
    expect(result?.storeVisitCost).toBe(2);
  });

  it("returns null when no retailer combination can cover the basket", () => {
    const result = optimizeFulfilment(items, offers.filter((offer) => offer.productId !== "p2"), [], { maxStores: 2 });
    expect(result).toBeNull();
  });
});
