import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Map ticket status to monday.com group title
const STATUS_TO_GROUP: Record<string, string> = {
  Processing: "In Progress",
  Closed: "Resolved / Closed",
};

async function mondayQuery(token: string, query: string, variables?: Record<string, unknown>) {
  const res = await fetch("https://api.monday.com/v2", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: token },
    body: JSON.stringify({ query, variables }),
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
    const { ticketId, status } = await req.json();

    if (!ticketId || !status) {
      return new Response(JSON.stringify({ error: "ticketId and status are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const targetGroupTitle = STATUS_TO_GROUP[status];
    if (!targetGroupTitle) {
      return new Response(JSON.stringify({ error: `No group mapping for status: ${status}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the ticket's monday_item_id + org from the database
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: ticket, error: fetchError } = await supabaseAdmin
      .from("tickets")
      .select("monday_item_id, organization_id")
      .eq("id", ticketId)
      .single();

    if (fetchError || !ticket) {
      return new Response(JSON.stringify({ error: "Ticket not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: orgIntegration } = await supabaseAdmin
      .from("organization_integrations")
      .select("monday_api_token, monday_board_id")
      .eq("organization_id", ticket.organization_id)
      .maybeSingle();

    const MONDAY_API_TOKEN = orgIntegration?.monday_api_token || Deno.env.get("MONDAY_API_TOKEN");
    const MONDAY_BOARD_ID = orgIntegration?.monday_board_id || Deno.env.get("MONDAY_BOARD_ID");

    if (!MONDAY_API_TOKEN || !MONDAY_BOARD_ID) {
      return new Response(JSON.stringify({ error: "Monday.com configuration missing" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!ticket.monday_item_id) {
      console.log(`Ticket ${ticketId} has no monday_item_id, skipping group move`);
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "No monday item linked" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch all groups from the board to find the target group ID
    const groupsData = await mondayQuery(
      MONDAY_API_TOKEN,
      `query { boards(ids: [${MONDAY_BOARD_ID}]) { groups { id title } } }`
    );

    const groups = groupsData.data?.boards?.[0]?.groups || [];
    const targetGroup = groups.find(
      (g: { id: string; title: string }) =>
        g.title.toLowerCase() === targetGroupTitle.toLowerCase()
    );

    if (!targetGroup) {
      console.error(`Group "${targetGroupTitle}" not found on board. Available groups:`, groups.map((g: { title: string }) => g.title));
      return new Response(
        JSON.stringify({ error: `Group "${targetGroupTitle}" not found on monday.com board` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Move the item to the target group
    await mondayQuery(
      MONDAY_API_TOKEN,
      `mutation { move_item_to_group(item_id: ${ticket.monday_item_id}, group_id: "${targetGroup.id}") { id } }`
    );

    console.log(`Moved monday.com item ${ticket.monday_item_id} to group "${targetGroupTitle}" (${targetGroup.id})`);

    return new Response(
      JSON.stringify({ success: true, mondayItemId: ticket.monday_item_id, groupId: targetGroup.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("update-monday-group error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
