// Called by the notify_suggestion_status trigger (pg_net) when staff change a
// suggestion's status; emails the author via Resend. Never returns 5xx.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { appUrl } from "../_shared/appUrl.ts";
import { buildStatusEmail } from "../_shared/statusEmail.ts";

const reply = (status: number) => new Response(null, { status });

serve(async (req) => {
  const secret = Deno.env.get("NOTIFY_WEBHOOK_SECRET");
  if (!secret || req.headers.get("x-notify-secret") !== secret) return reply(401);

  try {
    const { suggestion_id } = (await req.json()) as { suggestion_id?: string };
    if (!suggestion_id) return reply(400);

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("send-suggestion-status-email: RESEND_API_KEY not set");
      return reply(202);
    }

    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: s } = await db
      .from("suggestions")
      .select("title, status, staff_response, author_name, author_email, is_hidden, organizations(name, slug)")
      .eq("id", suggestion_id)
      .maybeSingle();
    // Hidden/merged posts don't get emails: their board link would 404 for the author.
    if (!s || s.is_hidden) return reply(204);

    const org = s.organizations as unknown as { name: string; slug: string };
    const { subject, html } = buildStatusEmail({
      orgName: org.name,
      authorName: s.author_name,
      title: s.title,
      status: s.status,
      staffResponse: s.staff_response,
      boardUrl: appUrl(`/support/${org.slug}/suggestions`, Deno.env.get("PUBLIC_APP_URL") ?? ""),
    });

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `${org.name} Support <support@higherviewtaxesllc.com>`,
        to: [s.author_email],
        subject,
        html,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) console.error("send-suggestion-status-email: Resend", res.status, await res.text());
    return reply(202);
  } catch (err) {
    console.error("send-suggestion-status-email error:", err);
    return reply(202);
  }
});
