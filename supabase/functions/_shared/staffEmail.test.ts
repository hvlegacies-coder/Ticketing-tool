import { describe, expect, it } from "vitest";
import { buildStaffTicketEmail, planStaffEmails } from "./staffEmail";

const staff = [
  { userId: "owner", email: "owner@x.com", name: "Jay", role: "owner" },
  { userId: "admin", email: "admin@x.com", name: "Mia", role: "admin" },
  { userId: "les", email: "les@x.com", name: "Les", role: "agent" },
  { userId: "viewer", email: "v@x.com", name: "Vic", role: "viewer" },
];

describe("planStaffEmails", () => {
  it("new ticket: owners and admins get 'new', the assignee gets 'assigned'", () => {
    expect(planStaffEmails("new_ticket", staff, "les")).toEqual([
      { to: "owner@x.com", name: "Jay", kind: "new" },
      { to: "admin@x.com", name: "Mia", kind: "new" },
      { to: "les@x.com", name: "Les", kind: "assigned" },
    ]);
  });

  it("new ticket assigned to an admin: that admin gets one 'assigned' email, not two", () => {
    expect(planStaffEmails("new_ticket", staff, "admin")).toEqual([
      { to: "owner@x.com", name: "Jay", kind: "new" },
      { to: "admin@x.com", name: "Mia", kind: "assigned" },
    ]);
  });

  it("new unassigned ticket: only owners and admins", () => {
    expect(planStaffEmails("new_ticket", staff, null).map((e) => e.to)).toEqual(["owner@x.com", "admin@x.com"]);
  });

  it("assignment: only the assignee", () => {
    expect(planStaffEmails("assigned", staff, "les")).toEqual([{ to: "les@x.com", name: "Les", kind: "assigned" }]);
  });

  it("assignment to someone not on staff (or no email): nobody", () => {
    expect(planStaffEmails("assigned", staff, "ghost")).toEqual([]);
    expect(planStaffEmails("assigned", [{ ...staff[2], email: null }], "les")).toEqual([]);
  });

  it("never emails viewers about new tickets", () => {
    expect(planStaffEmails("new_ticket", staff, null).some((e) => e.to === "v@x.com")).toBe(false);
  });
});

describe("buildStaffTicketEmail", () => {
  const input = {
    ticketId: "1a2b3c4d-0000-4000-8000-000000000001",
    recipientName: "Les",
    customerName: "Ann <b>Lee</b>",
    title: "Calendar not syncing",
    summary: "GHL calendar stopped syncing with Google since Monday.",
    priority: "High impact or high urgency (major function degraded or deadline risk)",
    team: "GoHighLevel",
    adminUrl: "https://app.x/app/hv/ticket/1a2b3c4d",
    orgName: "Higher View Legacy",
  };

  it("assigned: subject and button point the agent at the ticket", () => {
    const { subject, html } = buildStaffTicketEmail("assigned", input);
    expect(subject).toBe("🎯 Assigned to you: #1A2B3C4D Calendar not syncing");
    expect(html).toContain('href="https://app.x/app/hv/ticket/1a2b3c4d"');
    expect(html).toContain("assigned to you");
    expect(html).toContain("GoHighLevel");
    expect(html).toContain("High");
  });

  it("new: subject announces a new ticket", () => {
    expect(buildStaffTicketEmail("new", input).subject).toBe("🆕 New ticket #1A2B3C4D: Calendar not syncing");
  });

  it("escapes customer text and has no fixed widths wider than a phone", () => {
    const { html } = buildStaffTicketEmail("new", input);
    expect(html).not.toContain("<b>Lee</b>");
    expect(html).toContain('name="viewport"');
    const widths = [...html.matchAll(/(?<![-\w])width:\s*(\d+)px/g)].map((m) => Number(m[1]));
    expect(widths.filter((w) => w > 300)).toEqual([]);
  });

  it("never includes the customer's private chat link", () => {
    expect(buildStaffTicketEmail("new", input).html).not.toContain("/t/");
  });

  it("only links http(s) admin URLs", () => {
    expect(buildStaffTicketEmail("new", { ...input, adminUrl: "javascript:x" }).html).not.toContain("javascript:");
  });
});
