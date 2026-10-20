import { describe, expect, it } from "vitest";
import { buildNavSections } from "./navigation";

const badges = { waiting: 3, unread: 2, suggestions: 4 };
const shape = (role: Parameters<typeof buildNavSections>[0]) =>
  buildNavSections(role, "hv", badges).map((s) => [s.title, s.items.map((i) => i.label)]);

describe("buildNavSections", () => {
  it("gives owners all three groups", () => {
    expect(shape("owner")).toEqual([
      ["WORKSPACE", ["Dashboard", "Live chats", "Analytics"]],
      ["CUSTOMERS", ["Suggestions", "Canned responses"]],
      ["ADMIN", ["Team", "Settings"]],
    ]);
  });

  it("hides admin-only items and empty groups from viewers", () => {
    expect(shape("viewer")).toEqual([
      ["WORKSPACE", ["Dashboard", "Analytics"]],
      ["CUSTOMERS", ["Suggestions"]],
    ]);
  });

  it("returns nothing before the role is known", () => {
    expect(buildNavSections(null, "hv", badges)).toEqual([]);
  });

  it("attaches live badges with their tone", () => {
    const items = buildNavSections("agent", "hv", badges).flatMap((s) => s.items);
    const byLabel = Object.fromEntries(items.map((i) => [i.label, i]));
    expect(byLabel.Dashboard).toMatchObject({ to: "/app/hv/dashboard", badge: 3, tone: "gold" });
    expect(byLabel["Live chats"]).toMatchObject({ badge: 2, tone: "cyan" });
    expect(byLabel.Suggestions).toMatchObject({ badge: 4, tone: "cyan" });
    expect(byLabel.Analytics.badge).toBeUndefined();
  });

  it("omits zero badges", () => {
    const items = buildNavSections("owner", "hv", { waiting: 0, unread: 0, suggestions: 0 }).flatMap((s) => s.items);
    expect(items.every((i) => i.badge === undefined)).toBe(true);
  });
});
