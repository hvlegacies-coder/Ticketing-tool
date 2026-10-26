import { supabase } from "@/integrations/supabase/client";
import { PRIORITY_OPTIONS } from "@/lib/mondayConfig";

/** Short word for the long SLA priority strings ("Moderate (single user…)" -> "Moderate"). */
export function priorityLabel(priority: string): string {
  if (priority.startsWith("High impact & high urgency")) return "Critical";
  if (priority.startsWith("High impact or high urgency")) return "High";
  return priority.split(" ")[0];
}

export const PRIORITY_CHOICES = PRIORITY_OPTIONS.map((value) => ({ value, label: priorityLabel(value) }));

export const TICKET_STATUSES = ["New", "Processing", "Closed"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

type StatusTicket = {
  id: string;
  email: string;
  client_full_name: string;
  issue_title: string;
  priority: string;
  issue_category: string | null;
  department: string | null;
  client_access_token: string;
};

export async function setTicketPriority(ticketId: string, priority: string): Promise<boolean> {
  if (!(PRIORITY_OPTIONS as readonly string[]).includes(priority)) return false;
  const { error } = await supabase.from("tickets").update({ priority } as never).eq("id", ticketId);
  return !error;
}

/**
 * Changes status the same way everywhere (dashboard table and ticket page).
 * Processing / Closed also sync Monday and email the customer.
 * emailSent: null when no email applies, false when it failed (invoke returns
 * { error } instead of throwing, so this is checked explicitly).
 */
export async function changeTicketStatus(
  ticket: StatusTicket,
  status: TicketStatus,
  ctx: { orgName?: string; orgSlug?: string; actorName: string },
): Promise<{ emailSent: boolean | null }> {
  const { error } = await supabase.from("tickets").update({ status } as never).eq("id", ticket.id);
  if (error) throw new Error(error.message);
  if (status === "New") return { emailSent: null };

  try {
    await supabase.functions.invoke("update-monday-group", { body: { ticketId: ticket.id, status } });
  } catch (mondayErr) {
    console.error("Monday group move error (non-blocking):", mondayErr);
  }

  const origin = window.location.origin;
  try {
    const { error: emailError } = await supabase.functions.invoke(
      status === "Closed" ? "send-ticket-resolved-email" : "send-ticket-processing-email",
      {
        body: {
          ticketId: ticket.id,
          email: ticket.email,
          clientName: ticket.client_full_name,
          issueTitle: ticket.issue_title,
          priority: ticket.priority,
          issueCategory: ticket.issue_category,
          department: ticket.department,
          ...(status === "Closed" ? { resolvedBy: ctx.actorName } : {}),
          chatLink: `${origin}/t/${ticket.client_access_token}`,
          orgName: ctx.orgName,
          portalUrl: ctx.orgSlug ? `${origin}/support/${ctx.orgSlug}` : undefined,
        },
      },
    );
    if (emailError) console.error("Status email failed:", emailError);
    return { emailSent: !emailError };
  } catch (emailErr) {
    console.error("Status email failed:", emailErr);
    return { emailSent: false };
  }
}
