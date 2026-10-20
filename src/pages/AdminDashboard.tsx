import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { TicketTable, type TicketRow } from "@/components/TicketTable";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { ISSUE_CATEGORIES } from "@/lib/mondayConfig";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/hooks/useAuth";
import { getSlaState } from "@/lib/sla";
import { KpiTile } from "@/components/dashboard/KpiTile";
import { useStaffNotifications } from "@/hooks/useStaffNotifications";
import { dailyCounts, weekOverWeek } from "@/lib/dashboardStats";

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
};
const deltaNote = (d: number | null) => (d === null ? "— vs last week" : `${d >= 0 ? "▲" : "▼"} ${Math.abs(d)}% vs last week`);

const AdminDashboard = () => {
  const { organization, role } = useOrganization();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterTag, setFilterTag] = useState("all");
  const [filterSla, setFilterSla] = useState("all");
  const [mineOnly, setMineOnly] = useState(false);

  const orgId = organization?.id;

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["tickets", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("*, assignee:profiles(full_name,email), ticket_tags(tags(id,name,color))")
        .eq("organization_id", orgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as TicketRow[];
    },
    enabled: !!orgId,
  });

  const { data: members = [] } = useQuery({
    queryKey: ["org-members", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization_members")
        .select("user_id, role, profiles(full_name,email)")
        .eq("organization_id", orgId!);
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  const { data: tags = [] } = useQuery({
    queryKey: ["org-tags", orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("tags").select("*").eq("organization_id", orgId!).order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  const filtered = useMemo(() => {
    return tickets.filter((t) => {
      if (search) {
        const s = search.toLowerCase();
        if (
          !t.client_full_name.toLowerCase().includes(s) &&
          !t.issue_title.toLowerCase().includes(s) &&
          !t.email.toLowerCase().includes(s) &&
          !t.company_name.toLowerCase().includes(s)
        )
          return false;
      }
      if (filterCategory !== "all" && t.issue_category !== filterCategory) return false;
      if (filterPriority !== "all" && t.priority !== filterPriority) return false;
      if (filterStatus !== "all" && t.status !== filterStatus) return false;
      if (filterTag !== "all" && !t.ticket_tags?.some((tt) => tt.tags?.id === filterTag)) return false;
      if (mineOnly && t.assigned_to_user_id !== user?.id) return false;
      if (filterSla !== "all") {
        const isDone = t.status === "Resolved" || t.status === "Closed";
        const state = getSlaState(t.resolution_due_at, isDone, t.sla_breached);
        if (filterSla !== state) return false;
      }
      return true;
    });
  }, [tickets, search, filterCategory, filterPriority, filterStatus, filterTag, filterSla, mineOnly, user?.id]);

  const stats = {
    total: tickets.length,
    breached: tickets.filter((t) => t.sla_breached).length,
    unassigned: tickets.filter((t) => !t.assigned_to_user_id && t.status !== "Closed").length,
    open: tickets.filter((t) => t.status !== "Closed" && t.status !== "Resolved").length,
    highOpen: tickets.filter(
      (t) => t.status !== "Closed" && t.status !== "Resolved" && (t.priority === "High" || t.priority === "Critical"),
    ).length,
  };
  const trend = dailyCounts(tickets);
  const delta = weekOverWeek(tickets);
  const { items: staffItems } = useStaffNotifications(orgId);
  const waitingCount = staffItems.filter((n) => n.kind === "agent_requested").length;
  const firstName = (user?.user_metadata?.full_name as string | undefined)?.split(" ")[0];

  return (
    <AppShell>
      <div className="container py-8">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-[0.08em] sm:text-3xl">COMMAND CENTER</h1>
            <p className="mt-1 text-muted-foreground">
              {greeting()}
              {firstName ? `, ${firstName}` : ""} · {organization?.name}
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] tracking-[0.14em] ${
              waitingCount ? "border-[#f5c84c]/50 text-gold" : "border-cyan/30 text-cyan"
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${waitingCount ? "animate-pulse bg-[#f5c84c]" : "bg-cyan"}`} />
            LIVE · {waitingCount} WAITING
          </span>
        </div>

        <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiTile label="Total tickets" value={stats.total} tone="gold" trend={trend} note={deltaNote(delta)} />
          <KpiTile label="Open" value={stats.open} tone="cyan" note={`${stats.highOpen} high priority`} />
          <KpiTile label="Unassigned" value={stats.unassigned} tone="cyan" note={stats.unassigned ? "needs an owner" : "all assigned"} />
          <KpiTile
            label="SLA breached"
            value={stats.breached}
            tone="red"
            note={stats.breached ? "needs action" : "all on track"}
          />
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tickets..."
              className="pl-10 transition-shadow focus-visible:shadow-gold"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="New">New</SelectItem>
              <SelectItem value="Open">Open</SelectItem>
              <SelectItem value="Processing">Processing</SelectItem>
              <SelectItem value="Resolved">Resolved</SelectItem>
              <SelectItem value="Closed">Closed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {ISSUE_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterTag} onValueChange={setFilterTag}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Tag" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tags</SelectItem>
              {tags.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterSla} onValueChange={setFilterSla}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="SLA" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All SLA</SelectItem>
              <SelectItem value="breached">Breached</SelectItem>
              <SelectItem value="due-soon">Due Soon</SelectItem>
              <SelectItem value="on-track">On Track</SelectItem>
              <SelectItem value="met">Met</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant={mineOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setMineOnly((v) => !v)}
            className={mineOnly ? "bg-gradient-gold hover:opacity-90" : ""}
          >
            My Tickets
          </Button>
        </div>

        <TicketTable
          tickets={filtered}
          isLoading={isLoading}
          orgSlug={organization?.slug ?? ""}
          members={members}
          canAssign={role === "owner" || role === "admin" || role === "agent"}
          onAssigned={() => queryClient.invalidateQueries({ queryKey: ["tickets", orgId] })}
        />
      </div>
    </AppShell>
  );
};

export default AdminDashboard;
