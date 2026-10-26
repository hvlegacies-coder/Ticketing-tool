import { beforeEach, describe, expect, it, vi } from "vitest";

const sb = vi.hoisted(() => ({ update: vi.fn(), eq: vi.fn(), invoke: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({ update: (patch: unknown) => { sb.update(patch); return { eq: (c: string, v: string) => sb.eq(c, v) }; } }),
    functions: { invoke: sb.invoke },
  },
}));

import { PRIORITY_CHOICES, changeTicketStatus, priorityLabel, setTicketPriority } from "./ticketActions";

const ticket = {
  id: "t1",
  email: "ann@x.com",
  client_full_name: "Ann",
  issue_title: "Refund",
  priority: "Moderate (single user or workaround available)",
  issue_category: "Other",
  department: null,
  client_access_token: "tok",
};
const ctx = { orgName: "HV", orgSlug: "hv", actorName: "Les" };

// Block bodies: returning a mock from beforeEach makes Vitest call it as teardown.
beforeEach(() => {
  sb.update.mockReset();
  sb.eq.mockReset();
  sb.invoke.mockReset();
  sb.eq.mockResolvedValue({ error: null });
  sb.invoke.mockResolvedValue({ data: { success: true }, error: null });
});

describe("priority labels", () => {
  it("maps the SLA priority strings to short words", () => {
    expect(PRIORITY_CHOICES.map((c) => c.label)).toEqual(["Critical", "High", "Moderate", "Low"]);
    expect(priorityLabel("Moderate (single user or workaround available)")).toBe("Moderate");
    expect(priorityLabel("Medium")).toBe("Medium");
  });
});

describe("setTicketPriority", () => {
  it("saves a known priority", async () => {
    await expect(setTicketPriority("t1", PRIORITY_CHOICES[0].value)).resolves.toBe(true);
    expect(sb.update).toHaveBeenCalledWith({ priority: PRIORITY_CHOICES[0].value });
  });

  it("refuses an unknown priority without calling the database", async () => {
    await expect(setTicketPriority("t1", "ASAP")).resolves.toBe(false);
    expect(sb.update).not.toHaveBeenCalled();
  });
});

describe("changeTicketStatus", () => {
  it("New: updates status only", async () => {
    await expect(changeTicketStatus(ticket, "New", ctx)).resolves.toEqual({ emailSent: null });
    expect(sb.update).toHaveBeenCalledWith({ status: "New" });
    expect(sb.invoke).not.toHaveBeenCalled();
  });

  it("Processing: syncs Monday and emails the customer", async () => {
    await expect(changeTicketStatus(ticket, "Processing", ctx)).resolves.toEqual({ emailSent: true });
    expect(sb.invoke).toHaveBeenCalledWith("update-monday-group", { body: { ticketId: "t1", status: "Processing" } });
    expect(sb.invoke).toHaveBeenCalledWith(
      "send-ticket-processing-email",
      { body: expect.objectContaining({ ticketId: "t1", email: "ann@x.com", chatLink: `${window.location.origin}/t/tok`, portalUrl: `${window.location.origin}/support/hv` }) },
    );
  });

  it("Closed: sends the resolved email with who resolved it", async () => {
    await changeTicketStatus(ticket, "Closed", ctx);
    expect(sb.invoke).toHaveBeenCalledWith("send-ticket-resolved-email", { body: expect.objectContaining({ resolvedBy: "Les" }) });
  });

  it("reports a failed email instead of pretending it was sent", async () => {
    sb.invoke.mockImplementation((fn: string) =>
      Promise.resolve(fn.startsWith("send-") ? { data: null, error: new Error("500") } : { data: {}, error: null }),
    );
    await expect(changeTicketStatus(ticket, "Closed", ctx)).resolves.toEqual({ emailSent: false });
  });

  it("throws when the status update itself fails, and sends nothing", async () => {
    sb.eq.mockResolvedValue({ error: { message: "rls" } });
    await expect(changeTicketStatus(ticket, "Processing", ctx)).rejects.toThrow("rls");
    expect(sb.invoke).not.toHaveBeenCalled();
  });
});
