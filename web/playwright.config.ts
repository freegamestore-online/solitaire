import { defineConfig } from "@playwright/test";

const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true };

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  timeout: 90_000,
  expect: { timeout: 10_000 },
  projects: [
    { name: "iphone14-light", use: { ...phone, colorScheme: "light" } },
    { name: "iphone14-dark", use: { ...phone, colorScheme: "dark" } },
  ],
  use: {
    baseURL: "http://127.0.0.1:4187",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm dev --host 127.0.0.1 --port 4187 --strictPort",
    url: "http://127.0.0.1:4187",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
