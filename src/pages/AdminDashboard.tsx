import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { motion } from "framer-motion";
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
import { toast } from "sonner";

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

  // Listen for new client messages in realtime
  useEffect(() => {
    if (!orgId) return;
    const channel = supabase
      .channel(`admin-new-messages-${orgId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: "sender_type=eq.client" },
        (payload) => {
          const msg = payload.new as { ticket_id: string; sender_name: string; message: string };
          toast.info(`New message from ${msg.sender_name}`, {
            description: msg.message.slice(0, 80),
            action: {
              label: "View",
              onClick: () => {
                window.location.href = `/app/${organization?.slug}/ticket/${msg.ticket_id}`;
              },
            },
          });
          queryClient.invalidateQueries({ queryKey: ["tickets", orgId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId, organization?.slug, queryClient]);

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
  };

  return (
    <AppShell>
      <div className="container py-8">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold tracking-tight">Ticket Dashboard</h1>
          <p className="mt-1 text-muted-foreground">Manage and track all support tickets for {organization?.name}.</p>
          <div className="mt-3 h-0.5 w-12 rounded-full bg-gradient-gold" />
        </div>

        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "Total Tickets", value: stats.total, accent: "border-l-primary" },
            { label: "Open", value: stats.open, accent: "border-l-info" },
            { label: "Unassigned", value: stats.unassigned, accent: "border-l-warning" },
            { label: "SLA Breached", value: stats.breached, accent: "border-l-urgent" },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ y: -2 }}
              className={`rounded-xl border border-l-4 ${stat.accent} bg-card p-4 shadow-card transition-shadow hover:shadow-elevated cursor-default`}
            >
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <p className="mt-1 font-display text-2xl font-bold">{stat.value}</p>
            </motion.div>
          ))}
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
