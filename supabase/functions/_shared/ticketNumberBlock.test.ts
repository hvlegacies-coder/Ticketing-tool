import { describe, expect, it } from "vitest";
import { ticketNumberBlock } from "./ticketNumberBlock";

describe("ticketNumberBlock", () => {
  it("shows the 8-character number and the Track ticket instructions", () => {
    const html = ticketNumberBlock("1a2b3c4d-0000-4000-8000-000000000001", "https://app.x/support/hv");
    expect(html).toContain("1A2B3C4D");
    expect(html).toContain("Track ticket");
    expect(html).toContain('href="https://app.x/support/hv"');
  });

  it("omits the button when no portal URL is known", () => {
    const html = ticketNumberBlock("1a2b3c4d-0000-4000-8000-000000000001", undefined);
    expect(html).toContain("1A2B3C4D");
    expect(html).not.toContain("<a ");
  });

  it("only accepts http(s) portal URLs and escapes them", () => {
    expect(ticketNumberBlock("1a2b3c4d", "javascript:alert(1)")).not.toContain("javascript:");
    expect(ticketNumberBlock("1a2b3c4d", 'https://x.com/"><script>')).not.toContain("<script>");
  });
});
