import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export type StaffNotification = {
  kind: "agent_requested" | "client_message";
  ticketId: string;
  customerName: string;
  preview: string;
  at: string;
};

type WaitingTicket = { id: string; client_full_name: string; issue_title: string; agent_requested_at: string };
type UnreadMessage = { id: string; ticket_id: string; sender_name: string; message: string; created_at: string };

/** One entry per ticket, newest first. A ticket waiting for an agent shows as agent_requested. */
export function mergeNotifications(waiting: WaitingTicket[], unread: UnreadMessage[]): StaffNotification[] {
  const latestByTicket = new Map<string, UnreadMessage>();
  for (const m of unread) {
    const prev = latestByTicket.get(m.ticket_id);
    if (!prev || m.created_at > prev.created_at) latestByTicket.set(m.ticket_id, m);
  }

  const items: StaffNotification[] = waiting.map((t) => {
    const latest = latestByTicket.get(t.id);
    latestByTicket.delete(t.id);
    return {
      kind: "agent_requested",
      ticketId: t.id,
      customerName: t.client_full_name,
      preview: latest?.message ?? t.issue_title,
      at: latest?.created_at ?? t.agent_requested_at,
    };
  });
  for (const m of latestByTicket.values()) {
    items.push({ kind: "client_message", ticketId: m.ticket_id, customerName: m.sender_name, preview: m.message, at: m.created_at });
  }
  return items.sort((a, b) => (a.at < b.at ? 1 : -1));
}

function playChime() {
  try {
    void new Audio("/notify.wav").play().catch(() => {});
  } catch {
    // autoplay blocked or Audio unavailable
  }
}

/**
 * Waiting/unread items for the staff bell. Pass live: true from exactly one
 * place (AppShell) to own the realtime subscription; other callers share the
 * cached queries.
 */
export function useStaffNotifications(
  orgId: string | undefined,
  { live = false }: { live?: boolean } = {},
): { items: StaffNotification[]; count: number } {
  const queryClient = useQueryClient();

  const { data: waiting = [] } = useQuery({
    queryKey: ["staff-waiting", orgId],
    enabled: !!orgId,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("id, client_full_name, issue_title, agent_requested_at")
        .eq("organization_id", orgId!)
        .not("agent_requested_at", "is", null);
      if (error) throw error;
      return (data ?? []) as WaitingTicket[];
    },
  });

  const { data: unread = [] } = useQuery({
    queryKey: ["staff-unread", orgId],
    enabled: !!orgId,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("id, ticket_id, sender_name, message, created_at, tickets!inner(organization_id)")
        .eq("sender_type", "client")
        .eq("is_read", false)
        .eq("tickets.organization_id", orgId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as UnreadMessage[];
    },
  });

  // Realtime rows are already limited to this user's orgs by RLS; tickets are
  // filtered to the current org server-side, messages are re-queried per org.
  useEffect(() => {
    if (!orgId || !live) return;
    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: ["staff-waiting", orgId] });
      queryClient.invalidateQueries({ queryKey: ["staff-unread", orgId] });
      queryClient.invalidateQueries({ queryKey: ["tickets", orgId] });
    };
    const channel = supabase
      .channel(`staff-notify-${orgId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: "sender_type=eq.client" },
        (payload) => {
          const msg = payload.new as UnreadMessage;
          toast.info(`New message from ${msg.sender_name}`, { description: msg.message.slice(0, 80) });
          playChime();
          refresh();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tickets", filter: `organization_id=eq.${orgId}` },
        (payload) => {
          // payload.old only carries the primary key (default replica identity),
          // so "newly waiting" = has agent_requested_at and isn't in our cache yet.
          const next = payload.new as Partial<WaitingTicket>;
          const known = queryClient.getQueryData<WaitingTicket[]>(["staff-waiting", orgId]) ?? [];
          if (next?.agent_requested_at && !known.some((t) => t.id === next.id)) {
            toast.info(`${next.client_full_name ?? "A customer"} wants to talk to an agent`);
            playChime();
          }
          refresh();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId, live, queryClient]);

  const items = useMemo(() => mergeNotifications(waiting, unread), [waiting, unread]);
  return { items, count: items.length };
}
