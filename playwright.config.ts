import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testIgnore: ["**/verified-fulfilment-migration.spec.ts"],
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  reporter: "list",
});
