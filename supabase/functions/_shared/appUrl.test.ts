import { describe, expect, it } from "vitest";
import { appUrl } from "./appUrl";

describe("appUrl", () => {
  it("joins base and path without double slashes", () => {
    expect(appUrl("/t/abc", "https://x.com/")).toBe("https://x.com/t/abc");
  });

  it("adds the missing slash between base and path", () => {
    expect(appUrl("t/abc", "https://x.com")).toBe("https://x.com/t/abc");
  });

  it("throws when the base URL is empty", () => {
    expect(() => appUrl("/t/abc", "")).toThrow("PUBLIC_APP_URL not set");
  });
});
