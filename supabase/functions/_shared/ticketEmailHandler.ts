// Shared Deno handler for the three ticket emails (received / processing / resolved).
// The HTML comes from ticketEmail.ts (mobile-first, tested); this file only does
// HTTP, validation and the Resend call.
import { appUrl } from "./appUrl.ts";
import { buildTicketEmail, type TicketEmailKind } from "./ticketEmail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

export function serveTicketEmail(kind: TicketEmailKind) {
  Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("Missing RESEND_API_KEY");
      return json({ error: "Server configuration error" }, 500);
    }

    try {
      const body = await req.json();
      const { ticketId, email, clientName, issueTitle } = body;
      if (!ticketId || !email || !clientName || !issueTitle) return json({ error: "Missing required fields" }, 400);

      const { subject, html } = buildTicketEmail(kind, {
        ticketId,
        clientName,
        issueTitle,
        priority: body.priority,
        issueCategory: body.issueCategory,
        department: body.department,
        affectedSystem: body.affectedSystem,
        companyName: body.companyName,
        resolvedBy: body.resolvedBy,
        chatLink: body.chatLink || appUrl("/", Deno.env.get("PUBLIC_APP_URL") ?? ""),
        portalUrl: body.portalUrl,
        brandName: body.orgName || "HigherView Taxes LLC",
      });

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "HigherView Taxes Support <support@higherviewtaxesllc.com>",
          reply_to: "hvlegacies@gmail.com",
          to: [email],
          subject,
          html,
        }),
      });
      if (!res.ok) throw new Error(`Resend API error: ${res.status} ${await res.text()}`);

      const result = await res.json();
      console.log(`Ticket ${kind} email sent via Resend:`, result);
      return json({ success: true, id: result.id });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("Email send error:", errorMsg);
      return json({ error: errorMsg }, 500);
    }
  });
}
