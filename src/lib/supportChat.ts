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

export const AI_FALLBACK_TEXT =
  'I\'m having trouble connecting right now. You can submit a ticket with the form, or tap "Talk to an agent".';

const TRANSCRIPT_MAX_CHARS = 10_000;
// Matches MAX_MESSAGES in supabase/functions/_shared/chatLogic.ts; older turns are dropped.
const MAX_SENT_TURNS = 30;
const sessionKey = (orgId: string) => `hv-live-chat:${orgId}`;

export async function sendAiMessage(
  organizationId: string,
  messages: ChatTurn[],
): Promise<{ reply: string; handoff: boolean }> {
  try {
    const { data, error } = await supabase.functions.invoke("support-chat", {
      body: { organizationId, messages: toWire(messages.slice(-MAX_SENT_TURNS)) },
    });
    if (error || typeof data?.reply !== "string") return { reply: AI_FALLBACK_TEXT, handoff: false };
    return { reply: data.reply, handoff: data.handoff === true };
  } catch {
    return { reply: AI_FALLBACK_TEXT, handoff: false };
  }
}

export function buildTranscript(messages: ChatTurn[]): string {
  return messages
    .map((m) => `${m.role === "user" ? "Customer" : "AI"}: ${textOnly(m)}`)
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
    chatbot_transcript: input.turns.map((m) => ({ role: m.role, content: textOnly(m) })),
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
