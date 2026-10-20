import { describe, expect, it } from "vitest";
import { formatDuration } from "./time";

describe("formatDuration", () => {
  it("formats seconds with a zero-padded remainder", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(9)).toBe("0:09");
    expect(formatDuration(65)).toBe("1:05");
    expect(formatDuration(3600)).toBe("60:00");
  });
});
