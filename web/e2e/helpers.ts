import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { expect, type Page, type TestInfo } from "@playwright/test";

export async function stubExternalServices(page: Page) {
  await page.route("https://auth.freegamestore.online/**", (route) => route.fulfill({
    status: 200,
    headers: {
      "access-control-allow-origin": "http://127.0.0.1:4187",
      "access-control-allow-credentials": "true",
    },
    json: null,
  }));
  await page.route("https://freegamestore-leaderboard.serge-the-dev.workers.dev/**", async (route) => {
    const method = route.request().method();
    const path = new URL(route.request().url()).pathname;
    if (method === "POST" || path.endsWith("/recent")) {
      await route.fulfill({ json: { scores: [], ok: true } });
    } else {
      await route.fulfill({ json: { scores: [{ player_name: "Browser test", score: 1234, created_at: "2026-01-01T00:00:00Z" }] } });
    }
  });
  await page.route("https://fonts.googleapis.com/**", (route) => route.fulfill({ status: 200, contentType: "text/css", body: "" }));
  await page.route("https://fonts.gstatic.com/**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.route("https://api.freegamestore.online/v1/analytics.js**", (route) => route.fulfill({ status: 200, contentType: "text/javascript", body: "" }));
}

export function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

export async function captureReference(page: Page, testInfo: TestInfo, name: string) {
  const directory = join(testInfo.project.testDir, "screenshots");
  await mkdir(directory, { recursive: true });
  const fileName = `${testInfo.project.name}-${name}.png`;
  await page.screenshot({ path: join(directory, fileName), animations: "disabled" });
}

export async function assertNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(dimensions.document, `document width ${dimensions.document} exceeds viewport ${dimensions.viewport}`).toBeLessThanOrEqual(dimensions.viewport);
  expect(dimensions.body, `body width ${dimensions.body} exceeds viewport ${dimensions.viewport}`).toBeLessThanOrEqual(dimensions.viewport);
}

export async function playNumberedDeal(page: Page, modeName: string, deal = 1) {
  await page.getByRole("button", { name: modeName, exact: true }).click();
  const input = page.getByLabel(/^Deal #/);
  await input.fill(String(deal));
  await page.getByRole("button", { name: "Play deal", exact: true }).click();
}
