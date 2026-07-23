import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Map monday.com group titles to app statuses
const GROUP_TO_STATUS: Record<string, string> = {
  "in progress": "Processing",
  "resolved / closed": "Closed",
};

async function mondayQuery(token: string, query: string) {
  const res = await fetch("https://api.monday.com/v2", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: token },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`Monday API HTTP ${res.status}: ${await res.text()}`);
  const data = await res.json();
  if (data.errors) throw new Error(data.errors.map((e: { message: string }) => e.message).join("; "));
  return data;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    // monday.com sends a challenge for webhook verification
    if (body.challenge) {
      console.log("Monday webhook challenge received");
      return new Response(JSON.stringify({ challenge: body.challenge }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const event = body.event;
    if (!event) {
      return new Response(JSON.stringify({ error: "No event data" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // We expect a "move_item_to_group" or similar event
    // monday.com webhook for "When item moves to group" sends:
    // event.itemId, event.destGroupId, event.sourceGroupId, event.boardId
    const itemId = String(event.itemId || event.pulseId || "");
    const destGroupId = event.destGroupId || event.groupId || "";
    const boardId = String(event.boardId || "");

    if (!itemId) {
      console.log("No itemId in webhook event, skipping");
      return new Response(JSON.stringify({ success: true, skipped: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Monday webhook: item ${itemId} moved to group ${destGroupId} on board ${boardId}`);

    const MONDAY_API_TOKEN = Deno.env.get("MONDAY_API_TOKEN");
    if (!MONDAY_API_TOKEN) {
      throw new Error("MONDAY_API_TOKEN not configured");
    }

    // Fetch the group title from monday.com to determine the target status
    const MONDAY_BOARD_ID = Deno.env.get("MONDAY_BOARD_ID");
    const boardIdToUse = boardId || MONDAY_BOARD_ID;

    const groupsData = await mondayQuery(
      MONDAY_API_TOKEN,
      `query { boards(ids: [${boardIdToUse}]) { groups { id title } } }`
    );

    const groups = groupsData.data?.boards?.[0]?.groups || [];
    const targetGroup = groups.find((g: { id: string }) => g.id === destGroupId);

    if (!targetGroup) {
      console.log(`Group ${destGroupId} not found on board, skipping`);
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "Group not found" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const groupTitle = targetGroup.title.toLowerCase();
    const newStatus = GROUP_TO_STATUS[groupTitle];

    if (!newStatus) {
      console.log(`No status mapping for group "${targetGroup.title}", skipping`);
      return new Response(JSON.stringify({ success: true, skipped: true, reason: `No mapping for group: ${targetGroup.title}` }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find the ticket by monday_item_id
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: ticket, error: fetchError } = await supabaseAdmin
      .from("tickets")
      .select("*")
      .eq("monday_item_id", itemId)
      .single();

    if (fetchError || !ticket) {
      console.log(`No ticket found with monday_item_id ${itemId}, skipping`);
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "No matching ticket" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Don't update if already in the target status
    if (ticket.status === newStatus) {
      console.log(`Ticket ${ticket.id} already has status "${newStatus}", skipping`);
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "Already in target status" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update ticket status
    const { error: updateError } = await supabaseAdmin
      .from("tickets")
      .update({ status: newStatus })
      .eq("id", ticket.id);

    if (updateError) throw updateError;

    console.log(`Updated ticket ${ticket.id} to status "${newStatus}"`);

    // Send the appropriate email notification
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (newStatus === "Processing") {
      try {
        const emailRes = await fetch(`${supabaseUrl}/functions/v1/send-ticket-processing-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            ticketId: ticket.id,
            email: ticket.email,
            clientName: ticket.client_full_name,
            issueTitle: ticket.issue_title,
            priority: ticket.priority,
            issueCategory: ticket.issue_category,
            department: ticket.department,
            chatLink: `${Deno.env.get("PUBLIC_APP_URL") || "https://ticket-sync-co.lovable.app"}/t/${ticket.client_access_token}`,
          }),
        });
        console.log("Processing email sent, status:", emailRes.status);
      } catch (emailErr) {
        console.error("Processing email error (non-blocking):", emailErr);
      }
    } else if (newStatus === "Closed") {
      try {
        const emailRes = await fetch(`${supabaseUrl}/functions/v1/send-ticket-resolved-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            ticketId: ticket.id,
            email: ticket.email,
            clientName: ticket.client_full_name,
            issueTitle: ticket.issue_title,
            priority: ticket.priority,
            issueCategory: ticket.issue_category,
            department: ticket.department,
            resolvedBy: "Monday.com",
            chatLink: `${Deno.env.get("PUBLIC_APP_URL") || "https://ticket-sync-co.lovable.app"}/t/${ticket.client_access_token}`,
          }),
        });
        console.log("Resolved email sent, status:", emailRes.status);
      } catch (emailErr) {
        console.error("Resolved email error (non-blocking):", emailErr);
      }
    }

    return new Response(
      JSON.stringify({ success: true, ticketId: ticket.id, newStatus }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("monday-webhook error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
