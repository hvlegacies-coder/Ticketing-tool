import { beforeEach, describe, expect, it, vi } from "vitest";

const { invoke, insert } = vi.hoisted(() => ({ invoke: vi.fn(), insert: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke }, from: () => ({ insert }) },
}));

import {
  AI_FALLBACK_TEXT,
  buildTranscript,
  clearLiveSession,
  createHandoffTicket,
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

  it("returns the fallback text when the function errors", async () => {
    invoke.mockResolvedValue({ data: null, error: new Error("boom") });
    await expect(sendAiMessage("org", [])).resolves.toEqual({ reply: AI_FALLBACK_TEXT, handoff: false });
  });

  it("returns the fallback text when invoke throws", async () => {
    invoke.mockRejectedValue(new Error("network"));
    await expect(sendAiMessage("org", [])).resolves.toEqual({ reply: AI_FALLBACK_TEXT, handoff: false });
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
        priority: "Medium",
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
