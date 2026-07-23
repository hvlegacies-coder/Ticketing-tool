import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, MessageSquare, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { PortalHeader } from "@/components/PortalHeader";
import { ClientTicketMessages } from "@/components/ClientTicketMessages";
import { supabase } from "@/integrations/supabase/client";
import NotFound from "@/pages/NotFound";
import { format } from "date-fns";

/**
 * Client-facing ticket status + messaging page, reached via the unguessable
 * client_access_token link emailed to the submitter (/t/:token). There is no
 * "type your name to unlock" gate anymore — the token itself is the access
 * control, enforced server-side by the get_ticket_by_token /
 * get_ticket_messages_by_token / send_client_message_by_token RPCs.
 */
const TicketChat = () => {
  const { token } = useParams<{ token: string }>();

  const { data: ticket, isLoading } = useQuery({
    queryKey: ["client-ticket", token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_ticket_by_token", { _token: token! });
      if (error) throw error;
      return data?.[0] ?? null;
    },
    enabled: !!token,
    refetchInterval: 15000,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!ticket) return <NotFound />;

  return (
    <div className="min-h-screen bg-background">
      <PortalHeader orgName={ticket.organization_name} homeHref={`/t/${token}`} />
      <div className="container max-w-2xl py-8">
        <Button variant="ghost" size="sm" asChild className="mb-6">
          <Link to={`/support/${ticket.organization_slug}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Support
          </Link>
        </Button>

        <div className="mb-6 rounded-2xl border bg-card p-5 shadow-card">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="font-display text-lg font-bold">{ticket.issue_title}</h1>
              <p className="mt-1 text-xs text-muted-foreground">
                Submitted {format(new Date(ticket.created_at), "MMMM d, yyyy 'at' h:mm a")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge value={ticket.priority} type="priority" />
              <StatusBadge value={ticket.status} type="status" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border bg-card shadow-elevated overflow-hidden">
          <div className="bg-gradient-gold px-6 py-4 flex items-center gap-3">
            <MessageSquare className="h-5 w-5 text-primary-foreground" />
            <div>
              <h2 className="font-display text-lg font-bold text-primary-foreground">Ticket Messages</h2>
              <p className="text-xs text-primary-foreground/70">Ticket #{ticket.id.slice(0, 8).toUpperCase()}</p>
            </div>
          </div>

          <ClientTicketMessages token={token!} senderName={ticket.client_full_name} senderEmail={ticket.email} />
        </div>
      </div>
    </div>
  );
};

export default TicketChat;
