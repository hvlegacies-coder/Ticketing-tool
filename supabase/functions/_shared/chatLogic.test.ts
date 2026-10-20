import { describe, expect, it } from "vitest";
import { parseChatResult, rateLimitKey, toApiMessages, validateChatRequest } from "./chatLogic";

describe("validateChatRequest", () => {
  it("rejects more than 30 messages", () => {
    expect(validateChatRequest({ messages: Array(31).fill({ role: "user", content: "x" }) })).toEqual({
      ok: false,
      error: "too_many_messages",
    });
  });

  it("rejects a message longer than 2000 chars", () => {
    expect(validateChatRequest({ messages: [{ role: "user", content: "x".repeat(2001) }] })).toEqual({
      ok: false,
      error: "message_too_long",
    });
  });

  it("rejects a body whose messages is not an array", () => {
    expect(validateChatRequest({ messages: "nope" })).toEqual({ ok: false, error: "invalid_body" });
  });

  it("rejects a message with an unknown role", () => {
    expect(validateChatRequest({ messages: [{ role: "system", content: "x" }] })).toEqual({
      ok: false,
      error: "invalid_body",
    });
  });

  it("accepts a valid conversation and passes organizationId through", () => {
    const messages = [{ role: "user", content: "hello" }];
    expect(validateChatRequest({ organizationId: "org-1", messages })).toEqual({
      ok: true,
      organizationId: "org-1",
      messages,
    });
  });
});

describe("parseChatResult", () => {
  it("returns the text reply without handoff on a normal turn", () => {
    expect(parseChatResult({ stop_reason: "end_turn", content: [{ type: "text", text: "Hi" }] })).toEqual({
      reply: "Hi",
      handoff: false,
    });
  });

  it("flags handoff when Claude calls request_human_agent", () => {
    expect(
      parseChatResult({
        stop_reason: "tool_use",
        content: [{ type: "text", text: "Connecting you" }, { type: "tool_use", name: "request_human_agent" }],
      }),
    ).toEqual({ reply: "Connecting you", handoff: true });
  });

  it("uses a default confirmation when the tool call has no text", () => {
    expect(
      parseChatResult({ stop_reason: "tool_use", content: [{ type: "tool_use", name: "request_human_agent" }] }).reply,
    ).toBe("Sure — I'll connect you with a team member.");
  });

  it("hands off with an apology on refusal", () => {
    expect(parseChatResult({ stop_reason: "refusal", content: [] })).toEqual({
      reply: "Sorry, I can't help with that here. Let me connect you with a team member.",
      handoff: true,
    });
  });

  it("ignores thinking blocks", () => {
    expect(
      parseChatResult({ stop_reason: "end_turn", content: [{ type: "thinking" }, { type: "text", text: "Answer" }] }),
    ).toEqual({ reply: "Answer", handoff: false });
  });
});

describe("toApiMessages", () => {
  it("drops the widget's leading assistant greeting", () => {
    expect(
      toApiMessages([
        { role: "assistant", content: "Hi!" },
        { role: "user", content: "help" },
        { role: "assistant", content: "sure" },
      ]),
    ).toEqual([
      { role: "user", content: "help" },
      { role: "assistant", content: "sure" },
    ]);
  });

  it("returns an empty list when there is no user turn", () => {
    expect(toApiMessages([{ role: "assistant", content: "Hi!" }])).toEqual([]);
  });
});

describe("validateChatRequest organization", () => {
  it("rejects a request without organizationId", () => {
    expect(validateChatRequest({ messages: [{ role: "user", content: "hi" }] })).toEqual({
      ok: false,
      error: "missing_organization",
    });
  });
});

describe("rateLimitKey", () => {
  it("uses the first x-forwarded-for address", () => {
    expect(rateLimitKey(new Headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }))).toBe("ip:1.2.3.4");
  });

  it("falls back to a shared bucket when no address is present", () => {
    expect(rateLimitKey(new Headers())).toBe("ip:unknown");
  });
});
