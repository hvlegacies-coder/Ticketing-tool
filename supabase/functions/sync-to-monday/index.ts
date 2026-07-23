import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Column IDs from the monday.com board
const COL = {
  EMAIL: "emailfs9p4vfw",
  DEPARTMENT: "single_selecte24tng4",
  ISSUE_TYPE: "single_selectsasiz69",
  IMPACT_URGENCY: "single_selecthkab6xs",
  SHORT_SUMMARY: "short_text8psrvpap",
  DETAILED_DESCRIPTION: "long_textjd8dxlm9",
  AFFECTED_SYSTEM: "single_selectsf0p7tv",
  ATTACHMENTS: "filewl6l2ccm",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ticketId } = await req.json();
    if (!ticketId) {
      return new Response(
        JSON.stringify({ error: "ticketId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch ticket
    const { data: ticket, error: fetchError } = await supabaseAdmin.from("tickets").select("*").eq("id", ticketId).single();
    if (fetchError || !ticket) {
      return new Response(JSON.stringify({ error: "Ticket not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Per-org Monday config, falling back to the project-wide secrets so the
    // original single-tenant deployment keeps working without reconfiguration.
    const { data: orgIntegration } = await supabaseAdmin
      .from("organization_integrations")
      .select("monday_api_token, monday_board_id, monday_group_id")
      .eq("organization_id", ticket.organization_id)
      .maybeSingle();

    const MONDAY_API_TOKEN = orgIntegration?.monday_api_token || Deno.env.get("MONDAY_API_TOKEN");
    const MONDAY_BOARD_ID = orgIntegration?.monday_board_id || Deno.env.get("MONDAY_BOARD_ID");
    const MONDAY_GROUP_ID = orgIntegration?.monday_group_id || Deno.env.get("MONDAY_GROUP_ID");

    if (!MONDAY_API_TOKEN) {
      await supabaseAdmin.from("tickets").update({ sync_status: "failed", sync_error_message: "Monday API token not configured" }).eq("id", ticketId);
      return new Response(JSON.stringify({ error: "Monday API token not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!MONDAY_BOARD_ID) {
      await supabaseAdmin.from("tickets").update({ sync_status: "failed", sync_error_message: "Monday Board ID not configured" }).eq("id", ticketId);
      return new Response(JSON.stringify({ error: "Monday Board ID not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Build column values matching the board structure
    const columnValues: Record<string, unknown> = {
      [COL.EMAIL]: { email: ticket.email, text: ticket.email },
      [COL.SHORT_SUMMARY]: ticket.issue_title,
      [COL.DETAILED_DESCRIPTION]: { text: ticket.issue_description },
    };

    // Status-type columns use { label: "value" }
    if (ticket.department) {
      columnValues[COL.DEPARTMENT] = { label: ticket.department };
    }
    if (ticket.issue_category) {
      columnValues[COL.ISSUE_TYPE] = { label: ticket.issue_category };
    }
    if (ticket.priority) {
      columnValues[COL.IMPACT_URGENCY] = { label: ticket.priority };
    }
    if (ticket.affected_system) {
      columnValues[COL.AFFECTED_SYSTEM] = { label: ticket.affected_system };
    }

    // Item name = client name + company
    const itemName = `${ticket.client_full_name} – ${ticket.company_name}`;

    const mutation = `
      mutation {
        create_item (
          board_id: ${MONDAY_BOARD_ID}
          ${MONDAY_GROUP_ID ? `group_id: "${MONDAY_GROUP_ID}"` : ""}
          item_name: "${itemName.replace(/"/g, '\\"')}"
          column_values: ${JSON.stringify(JSON.stringify(columnValues))}
        ) {
          id
        }
      }
    `;

    // Call monday.com API with retry
    let mondayResponse: Response | null = null;
    let retries = 3;

    while (retries > 0) {
      try {
        mondayResponse = await fetch("https://api.monday.com/v2", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: MONDAY_API_TOKEN },
          body: JSON.stringify({ query: mutation }),
        });
        if (mondayResponse.ok) break;
        if (mondayResponse.status === 429) { retries--; await new Promise(r => setTimeout(r, 2000)); continue; }
        break;
      } catch (fetchErr) {
        retries--;
        if (retries === 0) throw fetchErr;
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    if (!mondayResponse || !mondayResponse.ok) {
      const errorText = mondayResponse ? await mondayResponse.text() : "No response";
      console.error("Monday API error:", errorText);
      await supabaseAdmin.from("tickets").update({ sync_status: "failed", sync_error_message: `Monday API error: ${errorText.slice(0, 500)}` }).eq("id", ticketId);
      return new Response(JSON.stringify({ error: "Monday API call failed", details: errorText }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const mondayData = await mondayResponse.json();

    if (mondayData.errors) {
      const errorMsg = mondayData.errors.map((e: { message: string }) => e.message).join("; ");
      console.error("Monday GraphQL errors:", errorMsg);
      await supabaseAdmin.from("tickets").update({ sync_status: "failed", sync_error_message: errorMsg.slice(0, 500) }).eq("id", ticketId);
      return new Response(JSON.stringify({ error: "Monday GraphQL error", details: errorMsg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const mondayItemId = mondayData.data?.create_item?.id;
    await supabaseAdmin.from("tickets").update({ monday_item_id: mondayItemId?.toString() || null, sync_status: "synced", sync_error_message: null }).eq("id", ticketId);

    console.log(`Ticket ${ticketId} synced to monday.com as item ${mondayItemId}`);

    // Upload attachments to monday.com file column
    if (mondayItemId && ticket.attachments && ticket.attachments.length > 0) {
      for (const fileUrl of ticket.attachments) {
        try {
          // Download the file from Supabase storage
          const fileResponse = await fetch(fileUrl);
          if (!fileResponse.ok) {
            console.error(`Failed to download attachment: ${fileUrl}`);
            continue;
          }

          const fileBlob = await fileResponse.blob();
          // Extract filename from URL
          const urlPath = new URL(fileUrl).pathname;
          const fileName = urlPath.split("/").pop() || "attachment";

          // Upload to monday.com using add_file_to_column mutation
          const boundary = "----MondayFormBoundary" + Math.random().toString(36).slice(2);
          const query = `mutation ($file: File!) { add_file_to_column (item_id: ${mondayItemId}, column_id: "${COL.ATTACHMENTS}", file: $file) { id } }`;

          // Build multipart form data manually for Deno
          const encoder = new TextEncoder();
          const fileArrayBuffer = await fileBlob.arrayBuffer();
          const fileBytes = new Uint8Array(fileArrayBuffer);

          const parts: Uint8Array[] = [];
          // Query part
          parts.push(encoder.encode(`--${boundary}\r\nContent-Disposition: form-data; name="query"\r\n\r\n${query}\r\n`));
          // File part
          const contentType = fileBlob.type || "application/octet-stream";
          parts.push(encoder.encode(`--${boundary}\r\nContent-Disposition: form-data; name="variables[file]"; filename="${fileName}"\r\nContent-Type: ${contentType}\r\n\r\n`));
          parts.push(fileBytes);
          parts.push(encoder.encode(`\r\n--${boundary}--\r\n`));

          // Combine all parts
          const totalLength = parts.reduce((sum, p) => sum + p.length, 0);
          const body = new Uint8Array(totalLength);
          let offset = 0;
          for (const part of parts) {
            body.set(part, offset);
            offset += part.length;
          }

          const uploadResponse = await fetch("https://api.monday.com/v2/file", {
            method: "POST",
            headers: {
              Authorization: MONDAY_API_TOKEN,
              "Content-Type": `multipart/form-data; boundary=${boundary}`,
            },
            body: body,
          });

          if (uploadResponse.ok) {
            const uploadResult = await uploadResponse.json();
            if (uploadResult.errors) {
              console.error(`Monday file upload error for ${fileName}:`, uploadResult.errors);
            } else {
              console.log(`Uploaded attachment ${fileName} to monday.com item ${mondayItemId}`);
            }
          } else {
            console.error(`Monday file upload HTTP error for ${fileName}:`, uploadResponse.status, await uploadResponse.text());
          }
        } catch (fileErr) {
          console.error(`Error uploading attachment to monday.com:`, fileErr);
        }
      }
    }

    return new Response(JSON.stringify({ success: true, mondayItemId }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: unknown) {
    console.error("sync-to-monday error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
