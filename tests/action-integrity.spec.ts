import { test, expect } from "@playwright/test";

test.describe("action-layer integrity", () => {
  test("migration enforces server-side snapshot validation", async () => {
    const fs = await import("node:fs/promises");
    const sql = await fs.readFile("supabase/migrations/0018_action_integrity.sql", "utf8");
    expect(sql).toContain("line total mismatch");
    expect(sql).toContain("plan price mismatch");
    expect(sql).toContain("delivery fee mismatch");
    expect(sql).toContain("landed cost mismatch");
    expect(sql).toContain("minimum order constraint not met");
    expect(sql).toContain("mixed plan currencies");
    expect(sql).toContain("verified special unavailable");
    expect(sql).toContain("verified fulfilment rule unavailable");
  });
});
