import { describe, expect, it } from "vitest";
import { buildWebhookPayload, isValidWebhookUrl } from "./webhookPayload";

describe("buildWebhookPayload", () => {
  const payload = buildWebhookPayload({
    event: "client_message",
    org: { id: "o", slug: "higherview", name: "HV" },
    ticket: { id: "t1", client_full_name: "Ann", email: "a@x.com", client_access_token: "tok" },
    message: "hi",
    createdAt: "2026-10-20T00:00:00Z",
    appUrl: "https://app.x",
  });

  it("builds customer and admin links from the app URL", () => {
    expect(payload.chat_url).toBe("https://app.x/t/tok");
    expect(payload.admin_url).toBe("https://app.x/app/higherview/ticket/t1");
  });

  it("carries the spec's fields", () => {
    expect(payload).toEqual({
      event: "client_message",
      org: { id: "o", slug: "higherview", name: "HV" },
      ticket_id: "t1",
      customer_name: "Ann",
      email: "a@x.com",
      message: "hi",
      chat_url: "https://app.x/t/tok",
      admin_url: "https://app.x/app/higherview/ticket/t1",
      created_at: "2026-10-20T00:00:00Z",
      team: null,
      assigned_to: null,
    });
  });
});

describe("isValidWebhookUrl", () => {
  it.each([
    ["http://x.com", false],
    ["", false],
    [null, false],
    ["not a url", false],
    ["https://services.leadconnectorhq.com/hooks/abc", true],
  ])("%s -> %s", (url, expected) => {
    expect(isValidWebhookUrl(url)).toBe(expected);
  });
});

describe("routing fields", () => {
  const base = {
    org: { id: "o", slug: "hv", name: "HV" },
    ticket: { id: "t1", client_full_name: "Ann", email: "a@x.com", client_access_token: "tok" },
    message: "m",
    createdAt: "2026-10-26T00:00:00Z",
    appUrl: "https://app.x",
  };

  it("includes the team and assignee when known", () => {
    const p = buildWebhookPayload({
      ...base,
      event: "agent_requested",
      team: { key: "ghl", name: "GoHighLevel" },
      assignedTo: { name: "Les", email: "les@x.com" },
    });
    expect(p.team).toEqual({ key: "ghl", name: "GoHighLevel" });
    expect(p.assigned_to).toEqual({ name: "Les", email: "les@x.com" });
  });

  it("sends null team and assignee when not set", () => {
    const p = buildWebhookPayload({ ...base, event: "chat_ended" });
    expect(p.event).toBe("chat_ended");
    expect(p.team).toBeNull();
    expect(p.assigned_to).toBeNull();
  });
});
