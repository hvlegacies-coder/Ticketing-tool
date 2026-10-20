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
