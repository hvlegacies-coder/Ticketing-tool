import { describe, expect, it } from "vitest";
import { dailyCounts, weekOverWeek } from "./dashboardStats";

const now = new Date("2026-10-21T15:00:00Z");
const at = (iso: string) => ({ created_at: iso });

describe("dailyCounts", () => {
  it("counts tickets per day for the last 7 days, oldest first", () => {
    const tickets = [
      at("2026-10-21T09:00:00Z"),
      at("2026-10-21T10:00:00Z"),
      at("2026-10-20T10:00:00Z"),
      at("2026-10-15T10:00:00Z"),
      at("2026-10-14T10:00:00Z"), // 8 days ago: excluded
    ];
    expect(dailyCounts(tickets, now)).toEqual([1, 0, 0, 0, 0, 1, 2]);
  });

  it("returns seven zeros with no tickets", () => {
    expect(dailyCounts([], now)).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });
});

describe("weekOverWeek", () => {
  it("returns the percent change of the last 7 days vs the 7 before", () => {
    const tickets = [
      ...Array(6).fill(at("2026-10-20T10:00:00Z")),
      ...Array(4).fill(at("2026-10-12T10:00:00Z")),
    ];
    expect(weekOverWeek(tickets, now)).toBe(50);
  });

  it("returns a negative change when volume drops", () => {
    const tickets = [at("2026-10-20T10:00:00Z"), ...Array(4).fill(at("2026-10-12T10:00:00Z"))];
    expect(weekOverWeek(tickets, now)).toBe(-75);
  });

  it("returns null when the previous week had no tickets", () => {
    expect(weekOverWeek([at("2026-10-20T10:00:00Z")], now)).toBeNull();
  });
});
