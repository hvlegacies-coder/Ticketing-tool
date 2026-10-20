import { describe, expect, it } from "vitest";
import { slaProgress } from "./sla";

const now = new Date("2026-10-21T12:00:00Z");

describe("slaProgress", () => {
  it("returns the elapsed share of the SLA window", () => {
    expect(slaProgress("2026-10-21T10:00:00Z", "2026-10-21T14:00:00Z", now)).toBe(0.5);
  });

  it("caps at 1 once the due time has passed", () => {
    expect(slaProgress("2026-10-21T08:00:00Z", "2026-10-21T10:00:00Z", now)).toBe(1);
  });

  it("returns null when there is no due date", () => {
    expect(slaProgress("2026-10-21T08:00:00Z", null, now)).toBeNull();
  });
});
