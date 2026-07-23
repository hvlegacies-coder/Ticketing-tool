import { Link } from "react-router-dom";
import { format } from "date-fns";
import { Eye, ExternalLink } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { supabase } from "@/integrations/supabase/client";
import { getSlaState, SLA_STATE_STYLES, SLA_STATE_LABELS } from "@/lib/sla";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

export type TicketRow = Tables<"tickets"> & {
  assignee: { full_name: string | null; email: string | null } | null;
  ticket_tags: { tags: { id: string; name: string; color: string } | null }[];
};

export type OrgMember = {
  user_id: string;
  role: string;
  profiles: { full_name: string | null; email: string | null } | null;
};

interface TicketTableProps {
  tickets: TicketRow[];
  isLoading: boolean;
  orgSlug: string;
  members?: OrgMember[];
  canAssign?: boolean;
  onAssigned?: () => void;
}

export function TicketTable({ tickets, isLoading, orgSlug, members = [], canAssign, onAssigned }: TicketTableProps) {
  const handleAssign = async (ticketId: string, userId: string) => {
    const { error } = await supabase
      .from("tickets")
      .update({ assigned_to_user_id: userId === "unassigned" ? null : userId } as never)
      .eq("id", ticketId);
    if (error) {
      toast.error("Failed to update assignee");
      return;
    }
    toast.success("Assignee updated");
    onAssigned?.();
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-16">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <Eye className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="mt-4 font-display font-semibold">No tickets yet</h3>
        <p className="mt-1 text-sm text-muted-foreground">Tickets will appear here once submitted.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card shadow-card overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="font-semibold">Date</TableHead>
            <TableHead className="font-semibold">Client</TableHead>
            <TableHead className="font-semibold">Title</TableHead>
            <TableHead className="font-semibold">Tags</TableHead>
            <TableHead className="font-semibold">Priority</TableHead>
            <TableHead className="font-semibold">Status</TableHead>
            <TableHead className="font-semibold">SLA</TableHead>
            <TableHead className="font-semibold">Assigned</TableHead>
            <TableHead className="font-semibold text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tickets.map((ticket) => {
            const isDone = ticket.status === "Resolved" || ticket.status === "Closed";
            const slaState = getSlaState(ticket.resolution_due_at, isDone, ticket.sla_breached);
            return (
              <TableRow key={ticket.id} className="group hover:bg-muted/30 transition-colors">
                <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                  {format(new Date(ticket.created_at), "MMM d, yyyy")}
                </TableCell>
                <TableCell>
                  <div>
                    <p className="text-sm font-medium">{ticket.client_full_name}</p>
                    <p className="text-xs text-muted-foreground">{ticket.company_name}</p>
                  </div>
                </TableCell>
                <TableCell className="max-w-[200px]">
                  <p className="truncate text-sm font-medium">{ticket.issue_title}</p>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1 max-w-[140px]">
                    {ticket.ticket_tags?.filter((tt) => tt.tags).map((tt) => (
                      <span
                        key={tt.tags!.id}
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
                        style={{ backgroundColor: tt.tags!.color }}
                      >
                        {tt.tags!.name}
                      </span>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <StatusBadge value={ticket.priority} type="priority" />
                </TableCell>
                <TableCell>
                  <StatusBadge value={ticket.status} type="status" />
                </TableCell>
                <TableCell>
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${SLA_STATE_STYLES[slaState]}`}
                  >
                    {SLA_STATE_LABELS[slaState]}
                  </span>
                </TableCell>
                <TableCell>
                  {canAssign ? (
                    <Select
                      value={ticket.assigned_to_user_id ?? "unassigned"}
                      onValueChange={(v) => handleAssign(ticket.id, v)}
                    >
                      <SelectTrigger className="h-8 w-[150px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {members.map((m) => (
                          <SelectItem key={m.user_id} value={m.user_id}>
                            {m.profiles?.full_name || m.profiles?.email || "Unknown"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      {ticket.assignee?.full_name || ticket.assignee?.email || "Unassigned"}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                    className="opacity-60 group-hover:opacity-100 transition-opacity hover:text-primary"
                  >
                    <Link to={`/app/${orgSlug}/ticket/${ticket.id}`}>
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
