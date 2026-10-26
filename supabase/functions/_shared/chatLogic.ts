// Pure request/response helpers for the support-chat edge function.
// No Deno or SDK imports so Vitest can test them.
import { DEFAULT_PRIORITY, TICKET_CATEGORIES, TICKET_PRIORITIES } from "./ticketOptions.ts";

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export type ChatImage = { media_type: (typeof IMAGE_TYPES)[number]; data: string };
export type ChatTurn = { role: "user" | "assistant"; content: string; image?: ChatImage };

type ApiContent =
  | string
  | Array<
      | { type: "image"; source: { type: "base64"; media_type: ChatImage["media_type"]; data: string } }
      | { type: "text"; text: string }
    >;
export type ApiMessage = { role: "user" | "assistant"; content: ApiContent };

export const MAX_MESSAGES = 30;
export const MAX_MESSAGE_CHARS = 2000;
// ~5 MB of image bytes once base64-decoded.
export const MAX_IMAGE_BASE64 = 7_000_000;
export const HANDOFF_TOOL_NAME = "request_human_agent";
export const TICKET_TOOL_NAME = "create_ticket";

export type TicketDraft = { title: string; category: string; priority: string; summary: string; team?: string };
export type RoutingTeam = { key: string; name: string; description: string };

/** One line per team for the system prompt ("key = Name: description"). */
export function buildTeamGuide(teams: RoutingTeam[]): string {
  if (teams.length === 0) return "";
  return teams.map((t) => `- ${t.key} = ${t.name}: ${t.description}`).join("\n");
}
export const PHOTO_PLACEHOLDER = "[customer shared a photo]";

const HANDOFF_DEFAULT_REPLY = "Sure — I'll connect you with a team member.";
const TICKET_DEFAULT_REPLY = "Here's the ticket I prepared — add your name and email to submit it.";
const REFUSAL_REPLY = "Sorry, I can't help with that here. Let me connect you with a team member.";

export function validateChatRequest(
  body: unknown,
): { ok: true; organizationId: string; messages: ChatTurn[] } | { ok: false; error: string } {
  const b = body as { organizationId?: unknown; messages?: unknown } | null;
  if (!b || !Array.isArray(b.messages)) return { ok: false, error: "invalid_body" };

  const shapeOk = b.messages.every(
    (m) =>
      m &&
      (m.role === "user" || m.role === "assistant") &&
      typeof m.content === "string" &&
      (m.image === undefined || m.role === "user") &&
      (m.content.length > 0 || m.image !== undefined),
  );
  if (!shapeOk) return { ok: false, error: "invalid_body" };
  if (b.messages.length > MAX_MESSAGES) return { ok: false, error: "too_many_messages" };
  if (b.messages.some((m: ChatTurn) => m.content.length > MAX_MESSAGE_CHARS)) {
    return { ok: false, error: "message_too_long" };
  }

  for (const m of b.messages as ChatTurn[]) {
    if (!m.image) continue;
    if (!IMAGE_TYPES.includes(m.image.media_type) || typeof m.image.data !== "string") {
      return { ok: false, error: "invalid_image" };
    }
    if (m.image.data.length > MAX_IMAGE_BASE64) return { ok: false, error: "image_too_large" };
  }

  // Required so the per-org ai_chat_enabled switch can never be skipped.
  if (typeof b.organizationId !== "string" || !b.organizationId) return { ok: false, error: "missing_organization" };

  return { ok: true, organizationId: b.organizationId, messages: b.messages as ChatTurn[] };
}

/** Normalizes the create_ticket tool input; null when title or summary is missing. */
export function validateTicketDraft(input: unknown, teamKeys: string[] = []): TicketDraft | null {
  const d = (input ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const title = str(d.title).slice(0, 140);
  const summary = str(d.summary).slice(0, 4000);
  if (!title || !summary) return null;
  const category = (TICKET_CATEGORIES as readonly string[]).includes(str(d.category)) ? str(d.category) : "Other";
  const priority = (TICKET_PRIORITIES as readonly string[]).includes(str(d.priority)) ? str(d.priority) : DEFAULT_PRIORITY;
  const team = str(d.team);
  return teamKeys.includes(team) ? { title, category, priority, summary, team } : { title, category, priority, summary };
}

export function parseChatResult(
  resp: {
    stop_reason: string;
    content: Array<{ type: string; text?: string; name?: string; input?: unknown }>;
  },
  teamKeys: string[] = [],
): { reply: string; handoff: boolean; ticketDraft?: TicketDraft; handoffTeam?: string } {
  if (resp.stop_reason === "refusal") return { reply: REFUSAL_REPLY, handoff: true };

  const text = resp.content
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text)
    .join("\n")
    .trim();
  const handoffCall = resp.content.find((b) => b.type === "tool_use" && b.name === HANDOFF_TOOL_NAME);
  const handoff = !!handoffCall;
  const handoffTeamRaw = (handoffCall?.input as { team?: unknown } | undefined)?.team;
  const handoffTeam = typeof handoffTeamRaw === "string" && teamKeys.includes(handoffTeamRaw) ? handoffTeamRaw : undefined;

  const ticketCall = resp.content.find((b) => b.type === "tool_use" && b.name === TICKET_TOOL_NAME);
  const ticketDraft = ticketCall ? validateTicketDraft(ticketCall.input, teamKeys) : null;

  if (ticketDraft && !handoff) return { reply: text || TICKET_DEFAULT_REPLY, handoff: false, ticketDraft };
  const reply = text || (handoff ? HANDOFF_DEFAULT_REPLY : "");
  return handoffTeam ? { reply, handoff, handoffTeam } : { reply, handoff };
}

/**
 * Converts widget turns to Messages API format. Drops the widget's leading
 * assistant greeting (the API must start with a user turn) and sends only the
 * most recent photo — older photos become a text placeholder to save tokens.
 */
export function toApiMessages(messages: ChatTurn[]): ApiMessage[] {
  const firstUser = messages.findIndex((m) => m.role === "user");
  if (firstUser === -1) return [];
  const turns = messages.slice(firstUser);

  let lastImage = -1;
  turns.forEach((m, i) => {
    if (m.image) lastImage = i;
  });

  return turns.map((m, i) => {
    if (!m.image) return { role: m.role, content: m.content };
    if (i !== lastImage) {
      return { role: m.role, content: m.content ? `${m.content}\n${PHOTO_PLACEHOLDER}` : PHOTO_PLACEHOLDER };
    }
    return {
      role: m.role,
      content: [
        { type: "image", source: { type: "base64", media_type: m.image.media_type, data: m.image.data } },
        { type: "text", text: m.content || "Please look at this photo." },
      ],
    };
  });
}

// Bucket for the per-client AI chat rate limit (first hop of x-forwarded-for).
export function rateLimitKey(headers: Headers): string {
  const ip = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return `ip:${ip || "unknown"}`;
}

/** Tolerates a secret pasted with quotes, whitespace, or inside a copied curl example. */
export function extractApiKey(raw: string | undefined): string {
  if (!raw) return "";
  return raw.match(/sk-ant-[A-Za-z0-9_-]+/)?.[0] ?? raw.trim().replace(/^["']|["']$/g, "");
}
