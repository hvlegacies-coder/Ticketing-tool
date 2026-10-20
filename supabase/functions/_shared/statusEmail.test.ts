import { describe, expect, it } from "vitest";
import { buildStatusEmail } from "./statusEmail";

const base = {
  orgName: "HigherView",
  authorName: "Ann",
  title: "Dark mode",
  status: "Planned",
  staffResponse: null as string | null,
  boardUrl: "https://app.x/support/hv/suggestions",
};

describe("buildStatusEmail", () => {
  it("puts the title and new status in the subject", () => {
    expect(buildStatusEmail(base).subject).toBe('Your idea "Dark mode" is now Planned');
  });

  it("links to the public board", () => {
    expect(buildStatusEmail(base).html).toContain('href="https://app.x/support/hv/suggestions"');
  });

  it("includes the official response when present", () => {
    expect(buildStatusEmail({ ...base, staffResponse: "Shipping in May" }).html).toContain("Shipping in May");
  });

  it("omits the response block when there is none", () => {
    expect(buildStatusEmail(base).html).not.toContain("Official response");
  });

  it("escapes HTML in customer-supplied text", () => {
    const { html, subject } = buildStatusEmail({ ...base, title: '<img src=x onerror=alert(1)>', authorName: "<b>A</b>" });
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).not.toContain("<b>A</b>");
    expect(subject).toBe('Your idea "<img src=x onerror=alert(1)>" is now Planned');
  });
});
