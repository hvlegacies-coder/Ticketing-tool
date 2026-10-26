// Pure GoHighLevel webhook helpers (no Deno APIs) so Vitest can test them.
import { appUrl } from "./appUrl.ts";

export type WebhookEvent = "agent_requested" | "client_message" | "chat_ended";

export type GhlPayload = {
  event: WebhookEvent;
  org: { id: string; slug: string; name: string };
  ticket_id: string;
  customer_name: string;
  email: string;
  message: string;
  chat_url: string;
  admin_url: string;
  created_at: string;
  team: { key: string; name: string } | null;
  assigned_to: { name: string | null; email: string | null } | null;
};

export function buildWebhookPayload(input: {
  event: WebhookEvent;
  org: { id: string; slug: string; name: string };
  ticket: { id: string; client_full_name: string; email: string; client_access_token: string };
  message: string;
  createdAt: string;
  appUrl: string;
  team?: { key: string; name: string } | null;
  assignedTo?: { name: string | null; email: string | null } | null;
}): GhlPayload {
  return {
    event: input.event,
    org: input.org,
    ticket_id: input.ticket.id,
    customer_name: input.ticket.client_full_name,
    email: input.ticket.email,
    message: input.message,
    chat_url: appUrl(`/t/${input.ticket.client_access_token}`, input.appUrl),
    admin_url: appUrl(`/app/${input.org.slug}/ticket/${input.ticket.id}`, input.appUrl),
    created_at: input.createdAt,
    team: input.team ?? null,
    assigned_to: input.assignedTo ?? null,
  };
}

export function isValidWebhookUrl(url: string | null): boolean {
  if (!url) return false;
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}
