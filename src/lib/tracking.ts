import { supabase } from "@/integrations/supabase/client";

export type TrackedTicket = {
  ticket_ref: string;
  status: string;
  created_at: string;
  updated_at: string;
  team_replied: boolean;
};

/** The ticket number customers see: first 8 characters of the ticket id, uppercase. */
export const formatTicketRef = (ticketId: string) => ticketId.slice(0, 8).toUpperCase();

/** Accepts "#1a2b 3c4d"-style input; null unless it's exactly 8 hex characters. */
export function normalizeTicketRef(input: string): string | null {
  const ref = input.replace(/[#\s]/g, "").toUpperCase();
  return /^[0-9A-F]{8}$/.test(ref) ? ref : null;
}

/** Status-only lookup (no title, name, or messages — those stay behind the private chat link). */
export async function trackTicket(orgSlug: string, input: string): Promise<TrackedTicket | null> {
  const ref = normalizeTicketRef(input);
  if (!ref) return null;
  const { data, error } = await supabase.rpc("track_ticket", { _slug: orgSlug, _ticket_ref: ref });
  if (error) throw new Error(error.message);
  return data?.[0] ?? null;
}
