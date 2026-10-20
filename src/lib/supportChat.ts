import { supabase } from "@/integrations/supabase/client";
import { generateClientAccessToken } from "@/lib/utils";

export type ChatTurn = { role: "user" | "assistant"; content: string };

export type LiveSession = { ticketId: string; token: string; name: string; email: string };

export const AI_FALLBACK_TEXT =
  'I\'m having trouble connecting right now. You can submit a ticket with the form, or tap "Talk to an agent".';

const TRANSCRIPT_MAX_CHARS = 10_000;
const sessionKey = (orgId: string) => `hv-live-chat:${orgId}`;

export async function sendAiMessage(
  organizationId: string,
  messages: ChatTurn[],
): Promise<{ reply: string; handoff: boolean }> {
  try {
    const { data, error } = await supabase.functions.invoke("support-chat", {
      body: { organizationId, messages },
    });
    if (error || typeof data?.reply !== "string") return { reply: AI_FALLBACK_TEXT, handoff: false };
    return { reply: data.reply, handoff: data.handoff === true };
  } catch {
    return { reply: AI_FALLBACK_TEXT, handoff: false };
  }
}

export function buildTranscript(messages: ChatTurn[]): string {
  return messages
    .map((m) => `${m.role === "user" ? "Customer" : "AI"}: ${m.content}`)
    .join("\n")
    .slice(0, TRANSCRIPT_MAX_CHARS);
}

// Same anonymous insert path as TicketForm: id and token are generated
// client-side because anon can't read the row back (RLS on RETURNING).
export async function createHandoffTicket(input: {
  organizationId: string;
  name: string;
  email: string;
  turns: ChatTurn[];
}): Promise<{ ticketId: string; token: string }> {
  const ticketId = crypto.randomUUID();
  const token = generateClientAccessToken();

  const { error } = await supabase.from("tickets").insert({
    id: ticketId,
    client_access_token: token,
    organization_id: input.organizationId,
    client_full_name: input.name,
    email: input.email,
    company_name: "—",
    issue_title: "Live chat request",
    issue_category: "Live Chat",
    priority: "Medium",
    issue_description: buildTranscript(input.turns) || "Customer requested a live agent.",
    chatbot_transcript: input.turns,
    agent_requested_at: new Date().toISOString(),
  } as never);
  if (error) throw error;

  return { ticketId, token };
}

export function saveLiveSession(orgId: string, session: LiveSession): void {
  try {
    sessionStorage.setItem(sessionKey(orgId), JSON.stringify(session));
  } catch {
    // storage unavailable (private mode): live chat still works for this page view
  }
}

export function loadLiveSession(orgId: string): LiveSession | null {
  try {
    const raw = sessionStorage.getItem(sessionKey(orgId));
    if (!raw) return null;
    const s = JSON.parse(raw);
    return typeof s?.ticketId === "string" && typeof s?.token === "string" ? s : null;
  } catch {
    return null;
  }
}

export function clearLiveSession(orgId: string): void {
  try {
    sessionStorage.removeItem(sessionKey(orgId));
  } catch {
    // ignore
  }
}
