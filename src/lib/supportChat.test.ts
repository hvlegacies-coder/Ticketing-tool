import { beforeEach, describe, expect, it, vi } from "vitest";

const { invoke, insert, rpc } = vi.hoisted(() => ({ invoke: vi.fn(), insert: vi.fn(), rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke }, from: () => ({ insert }), rpc },
}));

import {
  AI_FALLBACK_TEXT,
  buildTranscript,
  clearLiveSession,
  createHandoffTicket,
  createTicketFromChat,
  endChatByToken,
  fitDimensions,
  loadLiveSession,
  saveLiveSession,
  sendAiMessage,
} from "./supportChat";

beforeEach(() => {
  invoke.mockReset();
  insert.mockReset();
  sessionStorage.clear();
});

describe("sendAiMessage", () => {
  it("returns the reply and handoff flag from the edge function", async () => {
    invoke.mockResolvedValue({ data: { reply: "Hi", handoff: true }, error: null });
    await expect(sendAiMessage("org", [{ role: "user", content: "x" }])).resolves.toEqual({ reply: "Hi", handoff: true });
    expect(invoke).toHaveBeenCalledWith("support-chat", {
      body: { organizationId: "org", messages: [{ role: "user", content: "x" }] },
    });
  });

  it("sends only the most recent 30 turns of a long chat", async () => {
    invoke.mockResolvedValue({ data: { reply: "ok", handoff: false }, error: null });
    const long = Array.from({ length: 40 }, (_, i) => ({ role: (i % 2 ? "assistant" : "user") as "user" | "assistant", content: String(i) }));
    await sendAiMessage("org", long);
    const sent = invoke.mock.calls[0][1].body.messages;
    expect(sent).toHaveLength(30);
    expect(sent[29].content).toBe("39");
  });

  it("returns the fallback text when the function errors", async () => {
    invoke.mockResolvedValue({ data: null, error: new Error("boom") });
    await expect(sendAiMessage("org", [])).resolves.toEqual({ reply: AI_FALLBACK_TEXT, handoff: false, unavailable: true });
  });

  it("returns the fallback text when invoke throws", async () => {
    invoke.mockRejectedValue(new Error("network"));
    await expect(sendAiMessage("org", [])).resolves.toEqual({ reply: AI_FALLBACK_TEXT, handoff: false, unavailable: true });
  });
});

describe("buildTranscript", () => {
  it("labels customer and AI turns", () => {
    expect(
      buildTranscript([
        { role: "user", content: "a" },
        { role: "assistant", content: "b" },
      ]),
    ).toBe("Customer: a\nAI: b");
  });

  it("truncates to 10,000 characters", () => {
    expect(buildTranscript([{ role: "user", content: "x".repeat(20000) }]).length).toBe(10000);
  });
});

describe("live session storage", () => {
  it("round-trips a saved session", () => {
    saveLiveSession("o1", { ticketId: "t", token: "k", name: "n", email: "e@x.com" });
    expect(loadLiveSession("o1")?.token).toBe("k");
  });

  it("returns null for a corrupt value", () => {
    sessionStorage.setItem("hv-live-chat:o2", "{bad");
    expect(loadLiveSession("o2")).toBeNull();
  });

  it("clears a session", () => {
    saveLiveSession("o3", { ticketId: "t", token: "k", name: "n", email: "e@x.com" });
    clearLiveSession("o3");
    expect(loadLiveSession("o3")).toBeNull();
  });
});

describe("createHandoffTicket", () => {
  it("inserts a live-chat ticket flagged as waiting for an agent", async () => {
    insert.mockResolvedValue({ error: null });
    const turns = [{ role: "user" as const, content: "help" }];
    const result = await createHandoffTicket({ organizationId: "o", name: "N", email: "e@x.com", turns });
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: result.ticketId,
        client_access_token: result.token,
        organization_id: "o",
        client_full_name: "N",
        email: "e@x.com",
        company_name: "—",
        issue_title: "Live chat request",
        issue_category: "Live Chat",
        priority: "Moderate (single user or workaround available)",
        issue_description: "Customer: help",
        chatbot_transcript: turns,
        agent_requested_at: expect.any(String),
      }),
    );
    expect(result.token).toMatch(/^[0-9a-f]{40}$/);
  });

  it("throws when the insert fails", async () => {
    insert.mockResolvedValue({ error: new Error("rls") });
    await expect(
      createHandoffTicket({ organizationId: "o", name: "N", email: "e@x.com", turns: [] }),
    ).rejects.toThrow("rls");
  });
});

describe("photos", () => {
  const img = { media_type: "image/jpeg" as const, data: "QUJD", previewUrl: "blob:x" };

  it("never sends the preview URL to the server", async () => {
    invoke.mockResolvedValue({ data: { reply: "ok", handoff: false }, error: null });
    await sendAiMessage("org", [{ role: "user", content: "see", image: img }]);
    expect(invoke.mock.calls[0][1].body.messages[0].image).toEqual({ media_type: "image/jpeg", data: "QUJD" });
  });

  it("marks photos in the transcript without image data", () => {
    expect(buildTranscript([{ role: "user", content: "my W2", image: img }])).toBe("Customer: [photo] my W2");
  });

  it("does not store photos on the handoff ticket", async () => {
    insert.mockResolvedValue({ error: null });
    await createHandoffTicket({
      organizationId: "o",
      name: "N",
      email: "e@x.com",
      turns: [{ role: "user", content: "my W2", image: img }],
    });
    const row = insert.mock.calls[0][0];
    expect(JSON.stringify(row)).not.toContain("QUJD");
    expect(row.chatbot_transcript).toEqual([{ role: "user", content: "[photo] my W2" }]);
  });
});

describe("fitDimensions", () => {
  it("scales the long edge down to 1568px", () => {
    expect(fitDimensions(4032, 3024)).toEqual({ width: 1568, height: 1176 });
    expect(fitDimensions(3024, 4032)).toEqual({ width: 1176, height: 1568 });
  });

  it("leaves small images alone", () => {
    expect(fitDimensions(800, 600)).toEqual({ width: 800, height: 600 });
  });
});

describe("tickets from chat", () => {
  const draft = {
    title: "Refund status not updating",
    category: "Software/Application",
    priority: "Moderate (single user or workaround available)",
    summary: "Portal still shows Pending.",
  };

  it("passes the ticket draft and flags through from the AI", async () => {
    invoke.mockResolvedValue({ data: { reply: "Prepared", handoff: false, ticketDraft: draft }, error: null });
    await expect(sendAiMessage("org", [{ role: "user", content: "x" }])).resolves.toEqual({
      reply: "Prepared",
      handoff: false,
      ticketDraft: draft,
    });
  });

  it("marks the AI as disabled when the org turned it off", async () => {
    invoke.mockResolvedValue({ data: { reply: "off", handoff: false, aiDisabled: true }, error: null });
    expect((await sendAiMessage("org", [])).aiDisabled).toBe(true);
  });

  it("marks the AI as unavailable when the call fails", async () => {
    invoke.mockResolvedValue({ data: null, error: new Error("down") });
    expect((await sendAiMessage("org", [])).unavailable).toBe(true);
  });

  it("creates a ticket from the draft without requesting an agent, then emails the chat link", async () => {
    insert.mockResolvedValue({ error: null });
    invoke.mockResolvedValue({ data: {}, error: null });
    const turns = [{ role: "user" as const, content: "my refund" }];
    const r = await createTicketFromChat({ organizationId: "o", orgName: "HV", name: "Ann", email: "a@x.com", company: "", draft, turns });
    const row = insert.mock.calls[0][0];
    expect(row).toMatchObject({
      issue_title: draft.title,
      issue_category: draft.category,
      priority: draft.priority,
      issue_description: draft.summary,
      company_name: "—",
      client_full_name: "Ann",
    });
    expect(row.agent_requested_at).toBeUndefined();
    expect(row.chatbot_transcript).toEqual([{ role: "user", content: "my refund" }]);
    expect(invoke).toHaveBeenCalledWith("send-ticket-email", {
      body: expect.objectContaining({ ticketId: r.ticketId, email: "a@x.com", chatLink: expect.stringContaining(`/t/${r.token}`) }),
    });
  });

  it("still returns the ticket when the email fails", async () => {
    insert.mockResolvedValue({ error: null });
    invoke.mockRejectedValue(new Error("resend down"));
    await expect(
      createTicketFromChat({ organizationId: "o", orgName: "HV", name: "Ann", email: "a@x.com", company: "Acme", draft, turns: [] }),
    ).resolves.toMatchObject({ token: expect.any(String) });
    expect(insert.mock.calls[0][0].company_name).toBe("Acme");
  });

  it("gives handoff tickets the Moderate SLA priority", async () => {
    insert.mockResolvedValue({ error: null });
    invoke.mockResolvedValue({ data: {}, error: null });
    await createHandoffTicket({ organizationId: "o", name: "N", email: "e@x.com", turns: [] });
    expect(insert.mock.calls[0][0].priority).toBe("Moderate (single user or workaround available)");
  });
});

describe("confirmation email portal link", () => {
  const draft = {
    title: "T",
    category: "Other",
    priority: "Moderate (single user or workaround available)",
    summary: "S",
  };

  it("includes the support page URL so the email can link to Track ticket", async () => {
    window.history.pushState({}, "", "/support/higher-view-legacy");
    insert.mockResolvedValue({ error: null });
    invoke.mockResolvedValue({ data: {}, error: null });
    await createTicketFromChat({ organizationId: "o", name: "Ann", email: "a@x.com", company: "", draft, turns: [] });
    expect(invoke.mock.calls[0][1].body.portalUrl).toBe(`${window.location.origin}/support/higher-view-legacy`);
    window.history.pushState({}, "", "/");
  });

  it("leaves the portal URL out when not on a support page", async () => {
    window.history.pushState({}, "", "/");
    insert.mockResolvedValue({ error: null });
    invoke.mockResolvedValue({ data: {}, error: null });
    await createTicketFromChat({ organizationId: "o", name: "Ann", email: "a@x.com", company: "", draft, turns: [] });
    expect(invoke.mock.calls[0][1].body.portalUrl).toBeUndefined();
  });
});

describe("routing and end chat", () => {
  const draft = {
    title: "T",
    category: "Other",
    priority: "Moderate (single user or workaround available)",
    summary: "S",
  };

  it("passes the AI's handoff team through", async () => {
    invoke.mockResolvedValue({ data: { reply: "ok", handoff: true, handoffTeam: "appointments" }, error: null });
    expect((await sendAiMessage("org", [])).handoffTeam).toBe("appointments");
  });

  it("saves the draft's team on the ticket", async () => {
    insert.mockResolvedValue({ error: null });
    invoke.mockResolvedValue({ data: {}, error: null });
    await createTicketFromChat({ organizationId: "o", name: "A", email: "a@x.com", company: "", draft: { ...draft, team: "ghl" }, turns: [] });
    expect(insert.mock.calls.at(-1)![0].team_key).toBe("ghl");
  });

  it("saves the handoff team on the live-chat ticket", async () => {
    insert.mockResolvedValue({ error: null });
    invoke.mockResolvedValue({ data: {}, error: null });
    await createHandoffTicket({ organizationId: "o", name: "A", email: "a@x.com", turns: [], teamKey: "apps" });
    expect(insert.mock.calls.at(-1)![0].team_key).toBe("apps");
  });

  it("ends the chat through the token RPC", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    await expect(endChatByToken("tok")).resolves.toBe(true);
    expect(rpc).toHaveBeenCalledWith("end_chat_by_token", { _token: "tok" });
  });

  it("reports failure when ending the chat errors", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "down" } });
    await expect(endChatByToken("tok")).resolves.toBe(false);
  });
});
