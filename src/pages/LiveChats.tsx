import { Link, useParams } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare, UserRound } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AiOrb } from "@/components/chat/AiOrb";
import { useOrganization } from "@/hooks/useOrganization";
import { useStaffNotifications } from "@/hooks/useStaffNotifications";
import { initials } from "@/lib/organization";

const LiveChats = () => {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const { organization } = useOrganization();
  const { items } = useStaffNotifications(organization?.id);

  return (
    <AppShell>
      <div className="container max-w-3xl py-8">
        <div className="mb-8">
          <h1 className="font-display text-2xl font-bold tracking-[0.08em] sm:text-3xl">LIVE CHATS</h1>
          <p className="mt-1 text-muted-foreground">Customers waiting for an agent or with unread messages.</p>
        </div>

        {items.length === 0 ? (
          <div className="glass flex flex-col items-center gap-3 rounded-2xl py-16 text-center">
            <AiOrb className="h-12 w-12" />
            <p className="font-display">No one is waiting right now</p>
            <p className="text-sm text-muted-foreground">New chats appear here instantly.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((n) => {
              const waiting = n.kind === "agent_requested";
              return (
                <li key={n.ticketId}>
                  <Link
                    to={`/app/${orgSlug}/ticket/${n.ticketId}`}
                    className={`glass flex items-center gap-3 rounded-xl p-3 transition-shadow hover:shadow-elevated ${
                      waiting ? "border-[#f5c84c]/50" : ""
                    }`}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan/30 to-violet/40 text-xs font-semibold ring-1 ring-cyan/40">
                      {initials(n.customerName)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{n.customerName}</p>
                      <p className="truncate text-sm text-muted-foreground">{n.preview}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${
                          waiting ? "bg-gradient-gold text-primary-foreground" : "bg-cyan/15 text-cyan"
                        }`}
                      >
                        {waiting ? <UserRound className="h-3 w-3" /> : <MessageSquare className="h-3 w-3" />}
                        {waiting ? "Wants an agent" : "Unread message"}
                      </span>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {formatDistanceToNow(new Date(n.at), { addSuffix: true })}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AppShell>
  );
};

export default LiveChats;
