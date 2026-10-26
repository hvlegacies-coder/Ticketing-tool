import { describe, expect, it } from "vitest";
import {
  MAX_IMAGE_BASE64,
  buildTeamGuide,
  extractApiKey,
  parseChatResult,
  rateLimitKey,
  toApiMessages,
  validateChatRequest,
  validateTicketDraft,
} from "./chatLogic";

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

  it("flags booking when Claude calls offer_booking_call, with a default reply", () => {
    expect(
      parseChatResult({ stop_reason: "tool_use", content: [{ type: "text", text: "Sure!" }, { type: "tool_use", name: "offer_booking_call" }] }),
    ).toEqual({ reply: "Sure!", handoff: false, booking: true });
    expect(parseChatResult({ stop_reason: "tool_use", content: [{ type: "tool_use", name: "offer_booking_call" }] }).reply).toMatch(/Book a call/);
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

describe("images", () => {
  const img = { media_type: "image/jpeg", data: "QUJD" };

  it("accepts a user turn with an image and an empty caption", () => {
    const r = validateChatRequest({ organizationId: "o", messages: [{ role: "user", content: "", image: img }] });
    expect(r.ok).toBe(true);
  });

  it("rejects an image on an assistant turn", () => {
    expect(
      validateChatRequest({ organizationId: "o", messages: [{ role: "user", content: "hi" }, { role: "assistant", content: "x", image: img }] }),
    ).toEqual({ ok: false, error: "invalid_body" });
  });

  it("rejects unsupported image types", () => {
    expect(
      validateChatRequest({ organizationId: "o", messages: [{ role: "user", content: "", image: { media_type: "image/tiff", data: "QUJD" } }] }),
    ).toEqual({ ok: false, error: "invalid_image" });
  });

  it("rejects images over the size limit", () => {
    const big = { media_type: "image/jpeg", data: "A".repeat(MAX_IMAGE_BASE64 + 1) };
    expect(validateChatRequest({ organizationId: "o", messages: [{ role: "user", content: "", image: big }] })).toEqual({
      ok: false,
      error: "image_too_large",
    });
  });

  it("rejects a text-only turn with empty content", () => {
    expect(validateChatRequest({ organizationId: "o", messages: [{ role: "user", content: "" }] })).toEqual({
      ok: false,
      error: "invalid_body",
    });
  });

  it("sends only the latest photo and replaces older ones with a placeholder", () => {
    const out = toApiMessages([
      { role: "user", content: "first", image: img },
      { role: "assistant", content: "ok" },
      { role: "user", content: "", image: { media_type: "image/png", data: "WFla" } },
    ]);
    expect(out[0]).toEqual({ role: "user", content: "first\n[customer shared a photo]" });
    expect(out[2]).toEqual({
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: "image/png", data: "WFla" } },
        { type: "text", text: "Please look at this photo." },
      ],
    });
  });
});

describe("create_ticket tool", () => {
  const input = {
    title: "Refund status not updating",
    category: "Software/Application",
    priority: "Moderate (single user or workaround available)",
    summary: "Customer filed in March; portal still shows Pending.",
  };

  it("returns a ticket draft when Claude calls create_ticket", () => {
    expect(
      parseChatResult({
        stop_reason: "tool_use",
        content: [{ type: "text", text: "I can open a ticket." }, { type: "tool_use", name: "create_ticket", input }],
      }),
    ).toEqual({ reply: "I can open a ticket.", handoff: false, ticketDraft: input });
  });

  it("uses a default prompt when the tool call has no text", () => {
    expect(
      parseChatResult({ stop_reason: "tool_use", content: [{ type: "tool_use", name: "create_ticket", input }] }).reply,
    ).toBe("Here's the ticket I prepared — add your name and email to submit it.");
  });

  it("falls back to Other and Moderate for values outside the lists", () => {
    expect(validateTicketDraft({ ...input, category: "Taxes", priority: "ASAP" })).toEqual({
      ...input,
      category: "Other",
      priority: "Moderate (single user or workaround available)",
    });
  });

  it("rejects a draft without a title or summary", () => {
    expect(validateTicketDraft({ ...input, title: " " })).toBeNull();
    expect(validateTicketDraft({ ...input, summary: undefined })).toBeNull();
  });

  it("trims and caps long fields", () => {
    const d = validateTicketDraft({ ...input, title: "x".repeat(300), summary: "y".repeat(5000) })!;
    expect(d.title).toHaveLength(140);
    expect(d.summary).toHaveLength(4000);
  });
});

describe("extractApiKey", () => {
  it("pulls the key out of a pasted curl example", () => {
    const pasted = 'curl https://api.anthropic.com/v1/messages \\n  --header "x-api-key: sk-ant-api03-AbC_d-123" \\n  --header "anthropic-version: 2023-06-01"';
    expect(extractApiKey(pasted)).toBe("sk-ant-api03-AbC_d-123");
  });

  it("trims whitespace and quotes around a plain key", () => {
    expect(extractApiKey('  "sk-ant-api03-xyz"\n')).toBe("sk-ant-api03-xyz");
  });

  it("returns an empty string when unset", () => {
    expect(extractApiKey(undefined)).toBe("");
  });
});

describe("team routing", () => {
  const teams = ["ghl", "apps", "internal", "appointments"];
  const base = {
    title: "Calendar not syncing",
    category: "Software/Application",
    priority: "Moderate (single user or workaround available)",
    summary: "GHL calendar stopped syncing.",
  };

  it("keeps a known team on the ticket draft", () => {
    expect(validateTicketDraft({ ...base, team: "ghl" }, teams)).toEqual({ ...base, team: "ghl" });
  });

  it("drops an unknown team", () => {
    expect(validateTicketDraft({ ...base, team: "sales" }, teams)).toEqual(base);
  });

  it("returns the team chosen for a handoff", () => {
    expect(
      parseChatResult(
        { stop_reason: "tool_use", content: [{ type: "tool_use", name: "request_human_agent", input: { reason: "x", team: "appointments" } }] },
        teams,
      ),
    ).toEqual({ reply: "Sure — I'll connect you with a team member.", handoff: true, handoffTeam: "appointments" });
  });

  it("ignores a handoff team that isn't configured", () => {
    expect(
      parseChatResult(
        { stop_reason: "tool_use", content: [{ type: "tool_use", name: "request_human_agent", input: { reason: "x", team: "nope" } }] },
        teams,
      ).handoffTeam,
    ).toBeUndefined();
  });
});

describe("buildTeamGuide", () => {
  it("lists each team's key, name and description for the AI", () => {
    const guide = buildTeamGuide([
      { key: "ghl", name: "GoHighLevel", description: "Anything GHL." },
      { key: "apps", name: "Apps", description: "Our apps." },
    ]);
    expect(guide).toContain("ghl = GoHighLevel: Anything GHL.");
    expect(guide).toContain("apps = Apps: Our apps.");
  });

  it("is empty when the org has no teams", () => {
    expect(buildTeamGuide([])).toBe("");
  });
});
