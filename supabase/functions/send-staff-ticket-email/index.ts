// Called by the notify_staff_* triggers (pg_net). Emails owners/admins about new
// tickets and the assignee when a ticket is assigned. Never returns 5xx.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { appUrl } from "../_shared/appUrl.ts";
import { buildStaffTicketEmail, planStaffEmails, type StaffEvent, type StaffMember } from "../_shared/staffEmail.ts";

const reply = (status: number, body?: unknown) =>
  new Response(body ? JSON.stringify(body) : null, { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  const secret = Deno.env.get("NOTIFY_WEBHOOK_SECRET");
  if (!secret || req.headers.get("x-notify-secret") !== secret) return reply(401);

  try {
    const { event, ticket_id } = (await req.json()) as { event: StaffEvent; ticket_id: string };
    if ((event !== "new_ticket" && event !== "assigned") || !ticket_id) return reply(400);

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("send-staff-ticket-email: RESEND_API_KEY not set");
      return reply(202);
    }

    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: ticket } = await db
      .from("tickets")
      .select("id, organization_id, client_full_name, issue_title, issue_description, priority, team_key, assigned_to_user_id, organizations(name, slug)")
      .eq("id", ticket_id)
      .maybeSingle();
    if (!ticket) return reply(204);

    const { data: members } = await db
      .from("organization_members")
      .select("user_id, role, profiles(full_name, email)")
      .eq("organization_id", ticket.organization_id);
    const staff: StaffMember[] = (members ?? []).map((m) => {
      const p = m.profiles as unknown as { full_name: string | null; email: string | null } | null;
      return { userId: m.user_id, role: m.role, email: p?.email ?? null, name: p?.full_name ?? null };
    });

    const plan = planStaffEmails(event, staff, ticket.assigned_to_user_id);
    if (plan.length === 0) return reply(204);

    const org = ticket.organizations as unknown as { name: string; slug: string };
    const { data: team } = ticket.team_key
      ? await db.from("routing_teams").select("name").eq("organization_id", ticket.organization_id).eq("key", ticket.team_key).maybeSingle()
      : { data: null };
    const adminUrl = appUrl(`/app/${org.slug}/ticket/${ticket.id}`, Deno.env.get("PUBLIC_APP_URL") ?? "");

    let sent = 0;
    for (const recipient of plan) {
      const { subject, html } = buildStaffTicketEmail(recipient.kind, {
        ticketId: ticket.id,
        recipientName: recipient.name,
        customerName: ticket.client_full_name,
        title: ticket.issue_title,
        summary: ticket.issue_description ?? "",
        priority: ticket.priority,
        team: team?.name ?? null,
        adminUrl,
        orgName: org.name,
      });
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: `${org.name} Support <support@higherviewtaxesllc.com>`, to: [recipient.to], subject, html }),
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) sent++;
      else console.error("send-staff-ticket-email: Resend", res.status, await res.text());
    }
    return reply(202, { planned: plan.length, sent });
  } catch (err) {
    console.error("send-staff-ticket-email error:", err);
    return reply(202);
  }
});
