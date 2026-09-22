import { describe, expect, it } from "vitest";

describe("test environment", () => {
  it("runs in plain Node with no browser globals, like the simulation engine", () => {
    expect(typeof window).toBe("undefined");
    expect(typeof document).toBe("undefined");
  });
});
