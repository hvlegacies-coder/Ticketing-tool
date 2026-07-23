import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ArrowLeft,
  ExternalLink,
  Paperclip,
  MessageSquare,
  CheckCircle2,
  Loader2,
  Settings,
  Copy,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TicketMessages } from "@/components/TicketMessages";
import { TicketNotes } from "@/components/TicketNotes";
import { TicketTagsEditor } from "@/components/TicketTagsEditor";
import { TicketActivityTimeline } from "@/components/TicketActivityTimeline";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { getSlaState, formatDueLabel, SLA_STATE_STYLES, SLA_STATE_LABELS } from "@/lib/sla";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type TicketWithAssignee = Tables<"tickets"> & {
  assignee: { full_name: string | null; email: string | null } | null;
};

const TicketDetails = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { organization, role } = useOrganization();
  const queryClient = useQueryClient();
  const [isClosing, setIsClosing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const canAct = role === "owner" || role === "admin" || role === "agent";

  const { data: ticket, isLoading } = useQuery({
    queryKey: ["ticket", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("*, assignee:profiles(full_name,email)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as unknown as TicketWithAssignee;
    },
    enabled: !!id,
  });

  const { data: members = [] } = useQuery({
    queryKey: ["org-members", organization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization_members")
        .select("user_id, profiles(full_name,email)")
        .eq("organization_id", organization!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!organization?.id,
  });

  const { data: cannedResponses = [] } = useQuery({
    queryKey: ["canned-responses", organization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("canned_responses")
        .select("id, title, body")
        .eq("organization_id", organization!.id)
        .order("title");
      if (error) throw error;
      return data;
    },
    enabled: !!organization?.id,
  });

  const invalidateTicket = () => queryClient.invalidateQueries({ queryKey: ["ticket", id] });

  const handleAssign = async (userId: string) => {
    const { error } = await supabase
      .from("tickets")
      .update({ assigned_to_user_id: userId === "unassigned" ? null : userId } as never)
      .eq("id", id!);
    if (error) toast.error("Failed to update assignee");
    else {
      toast.success("Assignee updated");
      invalidateTicket();
    }
  };

  const handleCloseTicket = async () => {
    if (!ticket) return;
    setIsClosing(true);
    try {
      const { error: updateError } = await supabase.from("tickets").update({ status: "Closed" } as never).eq("id", ticket.id);
      if (updateError) throw updateError;

      try {
        await supabase.functions.invoke("update-monday-group", { body: { ticketId: ticket.id, status: "Closed" } });
      } catch (mondayErr) {
        console.error("Monday group move error (non-blocking):", mondayErr);
      }

      try {
        await supabase.functions.invoke("send-ticket-resolved-email", {
          body: {
            ticketId: ticket.id,
            email: ticket.email,
            clientName: ticket.client_full_name,
            issueTitle: ticket.issue_title,
            priority: ticket.priority,
            issueCategory: ticket.issue_category,
            department: ticket.department,
            resolvedBy: user?.user_metadata?.full_name || user?.email || "Support Team",
            chatLink: `${window.location.origin}/t/${ticket.client_access_token}`,
            orgName: organization?.name,
          },
        });
      } catch (emailErr) {
        console.error("Resolution email error (non-blocking):", emailErr);
      }

      toast.success("Ticket closed and resolution email sent to client.");
      invalidateTicket();
    } catch (err) {
      console.error("Close ticket error:", err);
      toast.error("Failed to close ticket. Please try again.");
    } finally {
      setIsClosing(false);
    }
  };

  const handleProcessingTicket = async () => {
    if (!ticket) return;
    setIsProcessing(true);
    try {
      const { error: updateError } = await supabase.from("tickets").update({ status: "Processing" } as never).eq("id", ticket.id);
      if (updateError) throw updateError;

      try {
        await supabase.functions.invoke("update-monday-group", { body: { ticketId: ticket.id, status: "Processing" } });
      } catch (mondayErr) {
        console.error("Monday group move error (non-blocking):", mondayErr);
      }

      try {
        await supabase.functions.invoke("send-ticket-processing-email", {
          body: {
            ticketId: ticket.id,
            email: ticket.email,
            clientName: ticket.client_full_name,
            issueTitle: ticket.issue_title,
            priority: ticket.priority,
            issueCategory: ticket.issue_category,
            department: ticket.department,
            chatLink: `${window.location.origin}/t/${ticket.client_access_token}`,
            orgName: organization?.name,
          },
        });
      } catch (emailErr) {
        console.error("Processing email error (non-blocking):", emailErr);
      }

      toast.success("Ticket marked as Processing and notification sent to client.");
      invalidateTicket();
    } catch (err) {
      console.error("Processing ticket error:", err);
      toast.error("Failed to update ticket. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopyLink = () => {
    if (!ticket) return;
    navigator.clipboard.writeText(`${window.location.origin}/t/${ticket.client_access_token}`);
    toast.success("Client link copied to clipboard");
  };

  if (isLoading) {
    return (
      <AppShell>
        <div className="container py-8">
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-8 animate-pulse rounded bg-muted" />
            ))}
          </div>
        </div>
      </AppShell>
    );
  }

  if (!ticket) {
    return (
      <AppShell>
        <div className="container py-16 text-center">
          <h2 className="font-display text-2xl font-bold">Ticket not found</h2>
          <Button asChild className="mt-4">
            <Link to={`/app/${organization?.slug}/dashboard`}>Back to Dashboard</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  const transcript = ticket.chatbot_transcript as Array<{ role: string; content: string }> | null;
  const supportName = user?.user_metadata?.full_name || user?.email || "Support";
  const isClosed = ticket.status === "Closed";
  const isProcessingStatus = ticket.status === "Processing";
  const isDone = ticket.status === "Resolved" || ticket.status === "Closed";
  const slaState = getSlaState(ticket.resolution_due_at, isDone, ticket.sla_breached);

  return (
    <AppShell>
      <div className="container max-w-5xl py-8">
        <Button variant="ghost" size="sm" asChild className="mb-6">
          <Link to={`/app/${organization?.slug}/dashboard`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>

        <div className="space-y-6">
          <div className="rounded-2xl border bg-card p-6 shadow-card">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="font-display text-2xl font-bold">{ticket.issue_title}</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Submitted {format(new Date(ticket.created_at), "MMMM d, yyyy 'at' h:mm a")}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge value={ticket.priority} type="priority" />
                <StatusBadge value={ticket.status} type="status" />
                <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${SLA_STATE_STYLES[slaState]}`}>
                  {SLA_STATE_LABELS[slaState]}
                </span>

                {canAct && !isClosed && !isProcessingStatus && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="default" size="sm" disabled={isProcessing} className="ml-2 bg-blue-600 hover:bg-blue-700 text-white">
                        {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Settings className="mr-2 h-4 w-4" />}
                        Processing
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Mark as Processing?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will update the ticket status to "Processing" and send a notification email to <strong>{ticket.email}</strong>.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleProcessingTicket} className="bg-blue-600 hover:bg-blue-700">
                          Yes, mark & notify
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}

                {canAct && !isClosed && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="default" size="sm" disabled={isClosing} className="ml-2 bg-emerald-600 hover:bg-emerald-700 text-white">
                        {isClosing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                        Close Ticket
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Close this ticket?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will mark the ticket as resolved and notify <strong>{ticket.email}</strong>.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleCloseTicket} className="bg-emerald-600 hover:bg-emerald-700">
                          Yes, close & notify
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>

            {ticket.resolution_due_at && !isDone && (
              <p className="mt-3 text-xs text-muted-foreground">{formatDueLabel(ticket.resolution_due_at)} for resolution</p>
            )}
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <div className="rounded-xl border bg-card p-6 shadow-card">
                <h3 className="font-display font-semibold mb-3">Issue Description</h3>
                <p className="text-sm whitespace-pre-wrap">{ticket.issue_description}</p>
              </div>

              <TicketTagsEditor ticketId={ticket.id} organizationId={ticket.organization_id} canEdit={canAct} />

              <div className="rounded-xl border bg-card shadow-card overflow-hidden">
                <div className="bg-gradient-gold px-4 py-3 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary-foreground" />
                  <h3 className="font-display font-semibold text-primary-foreground">Messages</h3>
                </div>
                <TicketMessages
                  ticketId={ticket.id}
                  senderType="support"
                  senderName={supportName}
                  senderEmail={user?.email}
                  cannedResponses={canAct ? cannedResponses : undefined}
                />
              </div>

              <TicketNotes ticketId={ticket.id} authorId={user?.id} authorName={supportName} canWrite={canAct} />

              {ticket.attachments && ticket.attachments.length > 0 && (
                <div className="rounded-xl border bg-card p-6 shadow-card">
                  <h3 className="font-display font-semibold mb-3 flex items-center gap-2">
                    <Paperclip className="h-4 w-4" />
                    Attachments ({ticket.attachments.length})
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {ticket.attachments.map((url, i) => {
                      const isImg = /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
                      return isImg ? (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg border hover:shadow-elevated transition-shadow">
                          <img src={url} alt={`Attachment ${i + 1}`} className="h-40 w-full object-cover" />
                        </a>
                      ) : (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-lg border p-3 hover:bg-muted transition-colors">
                          <ExternalLink className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm truncate">Attachment {i + 1}</span>
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}

              {transcript && transcript.length > 0 && (
                <div className="rounded-xl border bg-card p-6 shadow-card">
                  <h3 className="font-display font-semibold mb-3 flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    AI Chatbot Transcript
                  </h3>
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {transcript.map((msg, i) => (
                      <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                          {msg.content}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <TicketActivityTimeline ticketId={ticket.id} />
            </div>

            <div className="space-y-6">
              <div className="rounded-xl border bg-card p-6 shadow-card space-y-4">
                <h3 className="font-display font-semibold">Assignment</h3>
                {canAct ? (
                  <Select value={ticket.assigned_to_user_id ?? "unassigned"} onValueChange={handleAssign}>
                    <SelectTrigger>
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
                  <p className="text-sm font-medium">{ticket.assignee?.full_name || ticket.assignee?.email || "Unassigned"}</p>
                )}
              </div>

              <div className="rounded-xl border bg-card p-6 shadow-card space-y-4">
                <h3 className="font-display font-semibold">Client Details</h3>
                {[
                  { label: "Name", value: ticket.client_full_name },
                  { label: "Company", value: ticket.company_name },
                  { label: "Email", value: ticket.email },
                  { label: "Phone", value: ticket.phone || "—" },
                  { label: "Preferred Contact", value: ticket.preferred_contact_method || "Email" },
                ].map((item) => (
                  <div key={item.label}>
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <p className="text-sm font-medium">{item.value}</p>
                  </div>
                ))}
                <div>
                  <p className="text-xs text-muted-foreground">Secure Client Link</p>
                  <Button variant="outline" size="sm" className="mt-1 w-full" onClick={handleCopyLink}>
                    <Copy className="mr-2 h-3.5 w-3.5" />
                    Copy client link
                  </Button>
                </div>
              </div>

              <div className="rounded-xl border bg-card p-6 shadow-card space-y-4">
                <h3 className="font-display font-semibold">Ticket Info</h3>
                {[
                  { label: "Category", value: ticket.issue_category },
                  { label: "Priority", value: ticket.priority },
                  { label: "Status", value: ticket.status },
                  { label: "Department", value: ticket.department || "—" },
                  { label: "Affected System", value: ticket.affected_system || "—" },
                  { label: "Related Link", value: ticket.related_link || "—" },
                ].map((item) => (
                  <div key={item.label}>
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    {item.label === "Related Link" && item.value !== "—" ? (
                      <a href={item.value} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary hover:underline flex items-center gap-1">
                        {item.value} <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <p className="text-sm font-medium">{item.value}</p>
                    )}
                  </div>
                ))}
              </div>

              <div className="rounded-xl border bg-card p-6 shadow-card space-y-4">
                <h3 className="font-display font-semibold">Monday.com Sync</h3>
                <div>
                  <p className="text-xs text-muted-foreground">Sync Status</p>
                  <StatusBadge value={ticket.sync_status} type="sync" />
                </div>
                {ticket.monday_item_id && (
                  <div>
                    <p className="text-xs text-muted-foreground">Monday Item ID</p>
                    <p className="text-sm font-mono">{ticket.monday_item_id}</p>
                  </div>
                )}
                {ticket.sync_error_message && (
                  <div>
                    <p className="text-xs text-muted-foreground">Error</p>
                    <p className="text-sm text-destructive">{ticket.sync_error_message}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
};

export default TicketDetails;
