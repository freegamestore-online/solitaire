import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const WEB = resolve(__dirname, "..");
const read = (rel: string) => readFileSync(resolve(WEB, rel), "utf-8");

/** The description a store listing and a search result show: the meta tag in the HTML shell. */
function metaDescription(html: string): string {
  const match = html.match(/<meta name="description" content="([^"]*)"/);
  return match?.[1] ?? "";
}

describe("listing copy", () => {
  const html = read("index.html");
  const description = metaDescription(html);

  it("names every mode", () => {
    for (const mode of ["Klondike", "Spider", "FreeCell", "TriPeaks", "Pyramid"]) {
      expect(description).toContain(mode);
    }
  });

  it("mentions the daily deal", () => {
    expect(description).toMatch(/daily/i);
  });

  it("fits a search snippet", () => {
    expect(description.length).toBeGreaterThan(0);
    expect(description.length).toBeLessThanOrEqual(160);
  });

  it("makes no tracking or ad claims, since the page loads the platform analytics script", () => {
    expect(html).toContain("analytics.js");
    expect(description).not.toMatch(/no tracking|no ads|ad-free|ad free/i);
  });

  it("gives the installed app the same modes in its manifest description", () => {
    const manifest = read("vite.config.ts");
    expect(manifest).toMatch(/description: 'Solitaire: Klondike, Spider, FreeCell, TriPeaks and Pyramid/);
  });
});

describe("Klondike controls copy", () => {
  it("does not advertise a draw mode that the app does not offer", () => {
    expect(read("src/App.tsx")).not.toMatch(/Draw 1 or Draw 3 mode available/);
  });

  it("disables undo once the win overlay is shown", () => {
    expect(read("src/App.tsx")).toContain('disabled={!meta.canUndo || phase === "won"}');
  });
});

describe("theme and phones", () => {
  it("declares color-scheme so native controls follow light and dark", () => {
    expect(read("index.html")).toContain('name="color-scheme" content="light dark"');
    expect(read("src/index.css")).toContain("color-scheme: light dark");
  });

  it("has a phone breakpoint for the mode bar", () => {
    const css = read("src/index.css");
    expect(css).toMatch(/@media \(max-width: 640px\)/);
    expect(css).toContain(".mode-bar");
  });
});
