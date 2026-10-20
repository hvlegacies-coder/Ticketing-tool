// Called by Postgres triggers (pg_net) when a customer asks for an agent or
// sends a chat message; forwards the event to the org's GoHighLevel webhook.
// Never returns 5xx: a webhook problem must not look like a chat failure.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildWebhookPayload, isValidWebhookUrl, type WebhookEvent } from "../_shared/webhookPayload.ts";

const reply = (status: number) => new Response(null, { status });

serve(async (req) => {
  const secret = Deno.env.get("NOTIFY_WEBHOOK_SECRET");
  if (!secret || req.headers.get("x-notify-secret") !== secret) return reply(401);

  try {
    const { event, ticket_id, message_id } = (await req.json()) as {
      event: WebhookEvent;
      ticket_id: string;
      message_id: string | null;
    };
    if ((event !== "agent_requested" && event !== "client_message") || !ticket_id) return reply(400);

    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: ticket } = await db
      .from("tickets")
      .select("id, organization_id, client_full_name, email, client_access_token, organizations(id, slug, name)")
      .eq("id", ticket_id)
      .maybeSingle();
    if (!ticket) return reply(204);

    const { data: integration } = await db
      .from("organization_integrations")
      .select("ghl_webhook_url")
      .eq("organization_id", ticket.organization_id)
      .maybeSingle();
    const url = integration?.ghl_webhook_url ?? null;
    if (!isValidWebhookUrl(url)) return reply(204);

    let message = "Customer requested a live agent.";
    let createdAt = new Date().toISOString();
    if (message_id) {
      const { data: msg } = await db
        .from("chat_messages")
        .select("message, created_at")
        .eq("id", message_id)
        .eq("ticket_id", ticket_id)
        .maybeSingle();
      if (msg) {
        message = msg.message;
        createdAt = msg.created_at;
      }
    }

    const org = ticket.organizations as unknown as { id: string; slug: string; name: string };
    const payload = buildWebhookPayload({
      event,
      org,
      ticket,
      message,
      createdAt,
      appUrl: Deno.env.get("PUBLIC_APP_URL") ?? "",
    });

    const res = await fetch(url!, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) console.error("notify-webhook: GHL responded", res.status);
    return reply(202);
  } catch (err) {
    console.error("notify-webhook error:", err);
    return reply(202);
  }
});
