// Pure request/response helpers for the support-chat edge function.
// No Deno or SDK imports so Vitest can test them.

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
export const PHOTO_PLACEHOLDER = "[customer shared a photo]";

const HANDOFF_DEFAULT_REPLY = "Sure — I'll connect you with a team member.";
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

export function parseChatResult(resp: {
  stop_reason: string;
  content: Array<{ type: string; text?: string; name?: string }>;
}): { reply: string; handoff: boolean } {
  if (resp.stop_reason === "refusal") return { reply: REFUSAL_REPLY, handoff: true };

  const text = resp.content
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text)
    .join("\n")
    .trim();
  const handoff = resp.content.some((b) => b.type === "tool_use" && b.name === HANDOFF_TOOL_NAME);

  return { reply: text || (handoff ? HANDOFF_DEFAULT_REPLY : ""), handoff };
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
