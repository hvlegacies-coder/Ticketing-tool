import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { Bell, MessageSquare, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useStaffNotifications } from "@/hooks/useStaffNotifications";

export function NotificationBell({ orgId, orgSlug }: { orgId: string | undefined; orgSlug: string | undefined }) {
  const navigate = useNavigate();
  const { items, count } = useStaffNotifications(orgId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={count ? `Notifications: ${count} waiting` : "Notifications"}
        >
          <Bell className={`h-5 w-5 ${count ? "text-cyan" : ""}`} />
          {count > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gradient-gold px-1 text-[10px] font-bold text-primary-foreground shadow-gold">
              {count > 9 ? "9+" : count}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="glass w-80 p-1">
        <DropdownMenuLabel className="font-display text-xs tracking-wider">LIVE CHATS</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">No one waiting</p>
        ) : (
          items.slice(0, 20).map((n) => (
            <DropdownMenuItem
              key={n.ticketId}
              onClick={() => navigate(`/app/${orgSlug}/ticket/${n.ticketId}`)}
              className="flex items-start gap-2 py-2"
            >
              {n.kind === "agent_requested" ? (
                <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
              ) : (
                <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-cyan" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {n.customerName}
                  {n.kind === "agent_requested" && <span className="ml-1 text-xs text-gold">· wants an agent</span>}
                </p>
                <p className="truncate text-xs text-muted-foreground">{n.preview}</p>
              </div>
              <span className="shrink-0 text-[10px] text-muted-foreground">
                {formatDistanceToNow(new Date(n.at), { addSuffix: true })}
              </span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
