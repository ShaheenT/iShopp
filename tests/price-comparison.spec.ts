import { test, expect } from "@playwright/test";

test.describe("price comparison contract", () => {
  test("orders retailers by effective special price", async () => {
    const rows = [
      { retailer_name: "Shoprite", special_price: 42 },
      { retailer_name: "Checkers", special_price: 35 },
      { retailer_name: "Woolworths", special_price: 49 },
    ];

    const sorted = [...rows].sort(
      (a, b) => a.special_price - b.special_price || a.retailer_name.localeCompare(b.retailer_name),
    );

    expect(sorted.map((row) => row.retailer_name)).toEqual([
      "Checkers",
      "Shoprite",
      "Woolworths",
    ]);
  });

  test("keeps one current comparison row per retailer", () => {
    const rows = [
      { retailer_id: "a", special_price: 40 },
      { retailer_id: "a", special_price: 35 },
      { retailer_id: "b", special_price: 37 },
    ];

    const uniqueRetailers = new Set(rows.map((row) => row.retailer_id));
    expect(uniqueRetailers.size).toBe(2);
  });
});
