import { useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ExternalLink, Plus } from "lucide-react";
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
import { getSlaState, SLA_STATE_STYLES, SLA_STATE_LABELS, slaProgress } from "@/lib/sla";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { AiOrb } from "@/components/chat/AiOrb";
import { initials } from "@/lib/organization";
import { TicketTagsEditor } from "@/components/TicketTagsEditor";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PRIORITY_CHOICES, TICKET_STATUSES, type TicketStatus, changeTicketStatus, setTicketPriority } from "@/lib/ticketActions";

const inlineSelect =
  "h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50";

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
  /** Routing team key -> display name, for the team label on each row. */
  teamNames?: Record<string, string>;
  /** For status emails (org name/portal link) and "resolved by". */
  orgName?: string;
  actorName?: string;
}

export function TicketTable({
  tickets,
  isLoading,
  orgSlug,
  members = [],
  canAssign,
  onAssigned,
  teamNames = {},
  orgName,
  actorName = "Support Team",
}: TicketTableProps) {
  const [pendingClose, setPendingClose] = useState<TicketRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const handlePriority = async (ticket: TicketRow, priority: string) => {
    setBusyId(ticket.id);
    const ok = await setTicketPriority(ticket.id, priority);
    setBusyId(null);
    if (ok) toast.success("Priority updated");
    else toast.error("Failed to update priority");
    onAssigned?.();
  };

  const runStatus = async (ticket: TicketRow, status: TicketStatus) => {
    setBusyId(ticket.id);
    try {
      const { emailSent } = await changeTicketStatus(ticket, status, { orgName, orgSlug, actorName });
      if (emailSent === false) toast.warning(`Status set to ${status}, but the customer email couldn't be sent.`);
      else toast.success(emailSent ? `Status set to ${status} — customer emailed` : `Status set to ${status}`);
    } catch {
      toast.error("Failed to update status");
    } finally {
      setBusyId(null);
      onAssigned?.();
    }
  };

  const handleStatus = (ticket: TicketRow, status: TicketStatus) => {
    if (status === "Closed") setPendingClose(ticket);
    else void runStatus(ticket, status);
  };

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
      <div className="glass flex flex-col items-center justify-center rounded-2xl py-16">
        <AiOrb className="h-14 w-14" />
        <h3 className="mt-4 font-display font-semibold">No tickets yet</h3>
        <p className="mt-1 text-sm text-muted-foreground">Tickets will appear here once submitted.</p>
      </div>
    );
  }

  return (
    <div className="glass overflow-x-auto rounded-2xl">
      <Table>
        <TableHeader>
          <TableRow className="border-cyan/15 hover:bg-transparent">
            <TableHead className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Date</TableHead>
            <TableHead className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Client</TableHead>
            <TableHead className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Title</TableHead>
            <TableHead className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Tags</TableHead>
            <TableHead className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Priority</TableHead>
            <TableHead className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Status</TableHead>
            <TableHead className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">SLA</TableHead>
            <TableHead className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Assigned</TableHead>
            <TableHead className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tickets.map((ticket) => {
            const isDone = ticket.status === "Resolved" || ticket.status === "Closed";
            const slaState = getSlaState(ticket.resolution_due_at, isDone, ticket.sla_breached);
            const progress = slaProgress(ticket.created_at, ticket.resolution_due_at);
            return (
              <TableRow key={ticket.id} className="group border-cyan/10 transition-colors hover:bg-cyan/[0.04]">
                <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                  {format(new Date(ticket.created_at), "MMM d, yyyy")}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <span
                      aria-hidden
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan/30 to-violet/40 text-[11px] font-semibold ring-1 ring-cyan/40"
                    >
                      {initials(ticket.client_full_name)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{ticket.client_full_name}</p>
                      <p className="truncate text-xs text-muted-foreground">{ticket.company_name}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="max-w-[200px]">
                  <p className="truncate text-sm font-medium">{ticket.issue_title}</p>
                  {ticket.team_key && teamNames[ticket.team_key] && (
                    <span className="mt-1 inline-block rounded-full border border-violet/40 bg-violet/10 px-2 py-0.5 text-[10px] text-violet">
                      {teamNames[ticket.team_key]}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex max-w-[160px] flex-wrap items-center gap-1">
                    {ticket.ticket_tags?.filter((tt) => tt.tags).map((tt) => (
                      <span
                        key={tt.tags!.id}
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
                        style={{ backgroundColor: tt.tags!.color }}
                      >
                        {tt.tags!.name}
                      </span>
                    ))}
                    {canAssign && (
                      <Popover onOpenChange={(open) => !open && onAssigned?.()}>
                        <PopoverTrigger asChild>
                          <button
                            aria-label={`Edit tags for ${ticket.issue_title}`}
                            className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-muted-foreground/50 text-muted-foreground hover:border-cyan hover:text-cyan"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="w-72">
                          <TicketTagsEditor ticketId={ticket.id} organizationId={ticket.organization_id} canEdit />
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {canAssign ? (
                    <select
                      aria-label={`Priority for ${ticket.issue_title}`}
                      value={ticket.priority}
                      disabled={busyId === ticket.id}
                      onChange={(e) => handlePriority(ticket, e.target.value)}
                      className={inlineSelect}
                    >
                      {!PRIORITY_CHOICES.some((c) => c.value === ticket.priority) && (
                        <option value={ticket.priority}>{ticket.priority}</option>
                      )}
                      {PRIORITY_CHOICES.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  ) : (
                    <StatusBadge value={ticket.priority} type="priority" />
                  )}
                </TableCell>
                <TableCell>
                  {canAssign ? (
                    <select
                      aria-label={`Status for ${ticket.issue_title}`}
                      value={ticket.status}
                      disabled={busyId === ticket.id}
                      onChange={(e) => handleStatus(ticket, e.target.value as TicketStatus)}
                      className={inlineSelect}
                    >
                      {!(TICKET_STATUSES as readonly string[]).includes(ticket.status) && (
                        <option value={ticket.status}>{ticket.status}</option>
                      )}
                      {TICKET_STATUSES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  ) : (
                    <StatusBadge value={ticket.status} type="status" />
                  )}
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${SLA_STATE_STYLES[slaState]}`}
                    >
                      {SLA_STATE_LABELS[slaState]}
                    </span>
                    {!isDone && progress !== null && (
                      <div className="h-1 w-20 overflow-hidden rounded-full bg-muted" aria-hidden>
                        <div
                          className={`h-full rounded-full ${progress >= 1 ? "bg-red-500" : progress > 0.75 ? "bg-gradient-gold" : "bg-gradient-neon"}`}
                          style={{ width: `${Math.round(progress * 100)}%` }}
                        />
                      </div>
                    )}
                  </div>
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
      <AlertDialog open={pendingClose !== null} onOpenChange={(open) => !open && setPendingClose(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close this ticket?</AlertDialogTitle>
            <AlertDialogDescription>
              This marks "{pendingClose?.issue_title}" as resolved and will email the customer that it's closed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingClose) void runStatus(pendingClose, "Closed");
                setPendingClose(null);
              }}
            >
              Close ticket
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
