import { describe, expect, it } from "vitest";
import { buildTicketEmail, shortPriority } from "./ticketEmail";

const base = {
  ticketId: "1a2b3c4d-0000-4000-8000-000000000001",
  clientName: "Ann Lee",
  issueTitle: "Refund status not updating",
  priority: "Moderate (single user or workaround available)",
  issueCategory: "Software/Application",
  chatLink: "https://app.x/t/tok",
  portalUrl: "https://app.x/support/hv",
  brandName: "HigherView Ticket",
};

describe("buildTicketEmail", () => {
  it.each(["received", "processing", "resolved"] as const)("%s: has the mobile viewport and no fixed widths wider than a phone", (kind) => {
    const { html } = buildTicketEmail(kind, base);
    expect(html).toContain('name="viewport"');
    // Real width properties only (not max-width / min-width or media queries).
    const widths = [...html.matchAll(/(?<![-\w])width:\s*(\d+)px/g)].map((m) => Number(m[1]));
    expect(widths.filter((w) => w > 300)).toEqual([]);
  });

  it.each(["received", "processing", "resolved"] as const)("%s: shows the ticket number, chat link and portal link", (kind) => {
    const { html, subject } = buildTicketEmail(kind, base);
    expect(html).toContain("1A2B3C4D");
    expect(html).toContain('href="https://app.x/t/tok"');
    expect(html).toContain('href="https://app.x/support/hv"');
    expect(subject).toContain("#1A2B3C4D");
  });

  it("keeps each email's own wording", () => {
    expect(buildTicketEmail("received", base).html).toContain("Your support ticket has been received");
    expect(buildTicketEmail("processing", base).html).toContain("is now being actively worked on by our team");
    expect(buildTicketEmail("resolved", { ...base, resolvedBy: "Les" }).html).toContain("has been resolved and closed");
    expect(buildTicketEmail("resolved", { ...base, resolvedBy: "Les" }).html).toContain("Les");
  });

  it("uses the original subjects", () => {
    expect(buildTicketEmail("received", base).subject).toBe("🎫 Ticket #1A2B3C4D Received — Refund status not updating");
    expect(buildTicketEmail("processing", base).subject).toBe("⚙️ Ticket #1A2B3C4D In Progress — Refund status not updating");
    expect(buildTicketEmail("resolved", base).subject).toBe("✅ Ticket #1A2B3C4D Resolved — Refund status not updating");
  });

  it("escapes customer-typed text", () => {
    const { html } = buildTicketEmail("received", { ...base, clientName: "<b>x</b>", issueTitle: '<img src=x onerror="a()">' });
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("<b>x</b>");
    expect(html).toContain("&lt;img src=x");
  });

  it("omits optional rows that are empty", () => {
    const { html } = buildTicketEmail("received", { ...base, issueCategory: undefined, companyName: undefined });
    expect(html).not.toContain(">Category<");
    expect(html).not.toContain(">Company<");
  });

  it("only links http(s) URLs", () => {
    const { html } = buildTicketEmail("received", { ...base, chatLink: "javascript:alert(1)" });
    expect(html).not.toContain("javascript:");
  });
});

describe("shortPriority", () => {
  it.each([
    ["High impact & high urgency (critical outage or many users blocked)", "Critical"],
    ["High impact or high urgency (major function degraded or deadline risk)", "High"],
    ["Moderate (single user or workaround available)", "Moderate"],
    ["Low (minor issue or general inquiry)", "Low"],
    ["Medium", "Medium"],
    [undefined, "Moderate"],
  ])("%s -> %s", (input, out) => {
    expect(shortPriority(input)).toBe(out);
  });
});
