import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  History,
  PlusCircle,
  RefreshCw,
  UserCheck,
  Flag,
  AlertTriangle,
  Tag as TagIcon,
  MessageSquare,
  StickyNote,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface TicketActivityTimelineProps {
  ticketId: string;
}

const ACTION_ICONS: Record<string, typeof History> = {
  created: PlusCircle,
  status_changed: RefreshCw,
  assigned: UserCheck,
  priority_changed: Flag,
  sla_breached: AlertTriangle,
  tag_added: TagIcon,
  tag_removed: TagIcon,
  message_sent: MessageSquare,
  note_added: StickyNote,
};

function describeActivity(action: string, meta: Record<string, unknown>): string {
  switch (action) {
    case "created":
      return `Ticket created (${meta.category ?? "uncategorized"}, ${meta.priority ?? "no priority"})`;
    case "status_changed":
      return `Status changed from "${meta.from}" to "${meta.to}"`;
    case "assigned":
      return meta.to ? "Ticket reassigned" : "Ticket unassigned";
    case "priority_changed":
      return `Priority changed from "${meta.from}" to "${meta.to}"`;
    case "sla_breached":
      return "SLA resolution target breached";
    case "tag_added":
      return `Tag "${meta.tag}" added`;
    case "tag_removed":
      return `Tag "${meta.tag}" removed`;
    case "message_sent":
      return meta.sender_type === "client" ? "Client sent a message" : "Support replied";
    case "note_added":
      return "Internal note added";
    default:
      return action;
  }
}

export function TicketActivityTimeline({ ticketId }: TicketActivityTimelineProps) {
  const { data: activity = [], isLoading } = useQuery({
    queryKey: ["ticket-activity", ticketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ticket_activity")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="rounded-xl border bg-card p-6 shadow-card">
      <h3 className="mb-4 flex items-center gap-2 font-display font-semibold">
        <History className="h-4 w-4" />
        Activity
      </h3>

      {isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : activity.length === 0 ? (
        <p className="text-sm text-muted-foreground">No activity yet.</p>
      ) : (
        <ol className="space-y-4">
          {activity.map((a) => {
            const Icon = ACTION_ICONS[a.action] ?? History;
            return (
              <li key={a.id} className="flex gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{describeActivity(a.action, (a.meta as Record<string, unknown>) ?? {})}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.actor_name ?? "System"} · {format(new Date(a.created_at), "MMM d, h:mm a")}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
