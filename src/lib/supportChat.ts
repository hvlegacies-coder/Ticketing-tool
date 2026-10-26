import { supabase } from "@/integrations/supabase/client";
import { generateClientAccessToken } from "@/lib/utils";

export type ChatImage = { media_type: "image/jpeg" | "image/png" | "image/webp" | "image/gif"; data: string; previewUrl?: string };
export type ChatTurn = { role: "user" | "assistant"; content: string; image?: ChatImage };

/** Text-only view of a turn: photos become a "[photo]" marker (option A: photos are never stored). */
const textOnly = (m: ChatTurn) => (m.image ? `[photo]${m.content ? " " + m.content : ""}` : m.content);

// Only the latest photo goes over the wire; previewUrl is browser-only.
function toWire(messages: ChatTurn[]) {
  const last = messages.map((m) => !!m.image).lastIndexOf(true);
  return messages.map((m, i) => {
    if (!m.image) return { role: m.role, content: m.content };
    if (i !== last) return { role: m.role, content: textOnly(m) };
    return { role: m.role, content: m.content, image: { media_type: m.image.media_type, data: m.image.data } };
  });
}

export type LiveSession = { ticketId: string; token: string; name: string; email: string };
export type TicketDraft = { title: string; category: string; priority: string; summary: string; team?: string };
export type AiResult = {
  reply: string;
  handoff: boolean;
  ticketDraft?: TicketDraft;
  /** Routing team the AI picked for a live-agent handoff. */
  handoffTeam?: string;
  /** The org turned AI chat off: show the fallback message form. */
  aiDisabled?: boolean;
  /** The AI couldn't be reached: show the fallback message form. */
  unavailable?: boolean;
};

export const AI_FALLBACK_TEXT =
  'I\'m having trouble connecting right now. Send us a message below, or tap "Talk to an agent".';

// Must match "Moderate" in src/lib/mondayConfig.ts PRIORITY_OPTIONS (SLA policies key on it).
const MODERATE_PRIORITY = "Moderate (single user or workaround available)";
const TRANSCRIPT_MAX_CHARS = 10_000;
// Matches MAX_MESSAGES in supabase/functions/_shared/chatLogic.ts; older turns are dropped.
const MAX_SENT_TURNS = 30;
const sessionKey = (orgId: string) => `hv-live-chat:${orgId}`;

export async function sendAiMessage(organizationId: string, messages: ChatTurn[]): Promise<AiResult> {
  const fallback: AiResult = { reply: AI_FALLBACK_TEXT, handoff: false, unavailable: true };
  try {
    const { data, error } = await supabase.functions.invoke("support-chat", {
      body: { organizationId, messages: toWire(messages.slice(-MAX_SENT_TURNS)) },
    });
    if (error || typeof data?.reply !== "string") return fallback;
    return {
      reply: data.reply,
      handoff: data.handoff === true,
      ...(data.ticketDraft ? { ticketDraft: data.ticketDraft as TicketDraft } : {}),
      ...(data.aiDisabled ? { aiDisabled: true } : {}),
      ...(typeof data.handoffTeam === "string" ? { handoffTeam: data.handoffTeam } : {}),
    };
  } catch {
    return fallback;
  }
}

export function buildTranscript(messages: ChatTurn[]): string {
  return messages
    .map((m) => `${m.role === "user" ? "Customer" : "AI"}: ${textOnly(m)}`)
    .join("\n")
    .slice(0, TRANSCRIPT_MAX_CHARS);
}

// Anonymous ticket insert: id and token are generated
// client-side because anon can't read the row back (RLS on RETURNING).
async function insertTicket(fields: Record<string, unknown>): Promise<{ ticketId: string; token: string }> {
  const ticketId = crypto.randomUUID();
  const token = generateClientAccessToken();
  const { error } = await supabase.from("tickets").insert({ id: ticketId, client_access_token: token, ...fields } as never);
  if (error) throw error;
  return { ticketId, token };
}

// The org's support page, so emails can point customers to Track ticket.
function currentPortalUrl(): string | undefined {
  const m = window.location.pathname.match(/^\/support\/([^/]+)/);
  return m ? `${window.location.origin}/support/${m[1]}` : undefined;
}

// Confirmation email with the private chat link; never blocks ticket creation.
async function sendConfirmationEmail(p: {
  ticketId: string;
  token: string;
  email: string;
  name: string;
  title: string;
  priority: string;
  category: string;
  company: string;
  orgName?: string;
}) {
  try {
    await supabase.functions.invoke("send-ticket-email", {
      body: {
        ticketId: p.ticketId,
        email: p.email,
        clientName: p.name,
        issueTitle: p.title,
        priority: p.priority,
        issueCategory: p.category,
        companyName: p.company,
        chatLink: `${window.location.origin}/t/${p.token}`,
        orgName: p.orgName,
        portalUrl: currentPortalUrl(),
      },
    });
  } catch (err) {
    console.error("Confirmation email failed (non-blocking):", err);
  }
}

const transcriptJson = (turns: ChatTurn[]) => turns.map((m) => ({ role: m.role, content: textOnly(m) }));

export async function createHandoffTicket(input: {
  organizationId: string;
  name: string;
  email: string;
  turns: ChatTurn[];
  orgName?: string;
  teamKey?: string;
}): Promise<{ ticketId: string; token: string }> {
  const title = "Live chat request";
  const ids = await insertTicket({
    organization_id: input.organizationId,
    client_full_name: input.name,
    email: input.email,
    company_name: "—",
    issue_title: title,
    issue_category: "Live Chat",
    priority: MODERATE_PRIORITY,
    issue_description: buildTranscript(input.turns) || "Customer requested a live agent.",
    chatbot_transcript: transcriptJson(input.turns),
    agent_requested_at: new Date().toISOString(),
    team_key: input.teamKey ?? null,
  });
  await sendConfirmationEmail({ ...ids, email: input.email, name: input.name, title, priority: MODERATE_PRIORITY, category: "Live Chat", company: "—", orgName: input.orgName });
  return ids;
}

/** Ticket the AI prepared and the customer confirmed (no live agent requested). */
export async function createTicketFromChat(input: {
  organizationId: string;
  orgName?: string;
  name: string;
  email: string;
  company: string;
  draft: TicketDraft;
  turns: ChatTurn[];
}): Promise<{ ticketId: string; token: string }> {
  const company = input.company.trim() || "—";
  const ids = await insertTicket({
    organization_id: input.organizationId,
    client_full_name: input.name,
    email: input.email,
    company_name: company,
    issue_title: input.draft.title,
    issue_category: input.draft.category,
    priority: input.draft.priority,
    issue_description: input.draft.summary,
    chatbot_transcript: transcriptJson(input.turns),
    team_key: input.draft.team ?? null,
  });
  await sendConfirmationEmail({
    ...ids,
    email: input.email,
    name: input.name,
    title: input.draft.title,
    priority: input.draft.priority,
    category: input.draft.category,
    company,
    orgName: input.orgName,
  });
  return ids;
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

const MAX_EDGE = 1568;
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

/** Fit within a 1568px long edge (Claude's sweet spot), never upscaling. */
export function fitDimensions(width: number, height: number): { width: number; height: number } {
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** Downscale and re-encode a photo as JPEG in the browser. Throws if it can't be decoded. */
export async function shrinkImage(file: File): Promise<ChatImage> {
  if (file.size > MAX_PHOTO_BYTES) throw new Error("too_large");
  const bitmap = await createImageBitmap(file);
  const { width, height } = fitDimensions(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  return { media_type: "image/jpeg", data: dataUrl.split(",")[1], previewUrl: dataUrl };
}

/** Customer ended the live chat: tells the agent side so nobody keeps waiting. */
export async function endChatByToken(token: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("end_chat_by_token", { _token: token });
    return !error && data === true;
  } catch {
    return false;
  }
}
