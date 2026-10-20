// Pure request/response helpers for the support-chat edge function.
// No Deno or SDK imports so Vitest can test them.

export type ChatTurn = { role: "user" | "assistant"; content: string };

export const MAX_MESSAGES = 30;
export const MAX_MESSAGE_CHARS = 2000;
export const HANDOFF_TOOL_NAME = "request_human_agent";

const HANDOFF_DEFAULT_REPLY = "Sure — I'll connect you with a team member.";
const REFUSAL_REPLY = "Sorry, I can't help with that here. Let me connect you with a team member.";

export function validateChatRequest(
  body: unknown,
): { ok: true; organizationId: string | null; messages: ChatTurn[] } | { ok: false; error: string } {
  const b = body as { organizationId?: unknown; messages?: unknown } | null;
  if (!b || !Array.isArray(b.messages)) return { ok: false, error: "invalid_body" };

  const valid = b.messages.every(
    (m) =>
      m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string",
  );
  if (!valid) return { ok: false, error: "invalid_body" };
  if (b.messages.length > MAX_MESSAGES) return { ok: false, error: "too_many_messages" };
  if (b.messages.some((m: ChatTurn) => m.content.length > MAX_MESSAGE_CHARS)) {
    return { ok: false, error: "message_too_long" };
  }

  return {
    ok: true,
    organizationId: typeof b.organizationId === "string" ? b.organizationId : null,
    messages: b.messages as ChatTurn[],
  };
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

// The widget opens with an assistant greeting; the Messages API requires the
// conversation to start with a user turn.
export function toApiMessages(messages: ChatTurn[]): ChatTurn[] {
  const firstUser = messages.findIndex((m) => m.role === "user");
  return firstUser === -1 ? [] : messages.slice(firstUser);
}
