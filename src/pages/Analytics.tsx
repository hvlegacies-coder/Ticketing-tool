import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subDays, startOfDay, differenceInMilliseconds } from "date-fns";
import { Bar, BarChart, Line, LineChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";
import { AppShell } from "@/components/AppShell";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useTheme } from "@/components/ThemeProvider";
import { categoricalColors, STATUS_COLORS } from "@/lib/chartColors";
import { formatDuration } from "@/lib/sla";
import { Loader2 } from "lucide-react";

const PRIORITY_SHORT: Record<string, string> = {
  "High impact & high urgency (critical outage or many users blocked)": "Critical",
  "High impact or high urgency (major function degraded or deadline risk)": "High",
  "Moderate (single user or workaround available)": "Moderate",
  "Low (minor issue or general inquiry)": "Low",
};

const Analytics = () => {
  const { organization } = useOrganization();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const colors = categoricalColors(isDark);
  const orgId = organization?.id;

  const { data: tickets, isLoading } = useQuery({
    queryKey: ["analytics-tickets", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select(
          "id, created_at, status, priority, issue_category, resolved_at, first_responded_at, resolution_due_at, sla_breached, assigned_to_user_id, assignee:profiles(full_name,email)"
        )
        .eq("organization_id", orgId!);
      if (error) throw error;
      return data as Array<{
        id: string;
        created_at: string;
        status: string;
        priority: string;
        issue_category: string;
        resolved_at: string | null;
        first_responded_at: string | null;
        resolution_due_at: string | null;
        sla_breached: boolean;
        assigned_to_user_id: string | null;
        assignee: { full_name: string | null; email: string | null } | null;
      }>;
    },
    enabled: !!orgId,
  });

  const stats = useMemo(() => {
    if (!tickets) return null;

    const days = Array.from({ length: 30 }, (_, i) => startOfDay(subDays(new Date(), 29 - i)));
    const volume = days.map((day) => {
      const dayKey = format(day, "MMM d");
      const count = tickets.filter((t) => format(startOfDay(new Date(t.created_at)), "MMM d") === dayKey).length;
      return { date: dayKey, tickets: count };
    });

    const statusCounts: Record<string, number> = {};
    const categoryCounts: Record<string, number> = {};
    const priorityCounts: Record<string, number> = {};
    for (const t of tickets) {
      statusCounts[t.status] = (statusCounts[t.status] ?? 0) + 1;
      categoryCounts[t.issue_category] = (categoryCounts[t.issue_category] ?? 0) + 1;
      const p = PRIORITY_SHORT[t.priority] ?? t.priority.slice(0, 12);
      priorityCounts[p] = (priorityCounts[p] ?? 0) + 1;
    }

    const statusData = Object.entries(statusCounts).map(([status, count]) => ({ status, count }));
    const categoryData = Object.entries(categoryCounts)
      .map(([category, count]) => ({ category: category.split(" (")[0], count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
    const priorityData = Object.entries(priorityCounts).map(([priority, count]) => ({ priority, count }));

    const agentCounts = new Map<string, { name: string; count: number }>();
    for (const t of tickets) {
      if (!t.assigned_to_user_id) continue;
      const name = t.assignee?.full_name || t.assignee?.email || "Unknown";
      const existing = agentCounts.get(t.assigned_to_user_id);
      agentCounts.set(t.assigned_to_user_id, { name, count: (existing?.count ?? 0) + 1 });
    }
    const agentData = Array.from(agentCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const withSlaTarget = tickets.filter((t) => t.resolution_due_at);
    const slaCompliance =
      withSlaTarget.length > 0
        ? Math.round((withSlaTarget.filter((t) => !t.sla_breached).length / withSlaTarget.length) * 100)
        : null;

    const resolvedTickets = tickets.filter((t) => t.resolved_at);
    const avgResolutionMs =
      resolvedTickets.length > 0
        ? resolvedTickets.reduce((sum, t) => sum + differenceInMilliseconds(new Date(t.resolved_at!), new Date(t.created_at)), 0) /
          resolvedTickets.length
        : null;

    const respondedTickets = tickets.filter((t) => t.first_responded_at);
    const avgFirstResponseMs =
      respondedTickets.length > 0
        ? respondedTickets.reduce(
            (sum, t) => sum + differenceInMilliseconds(new Date(t.first_responded_at!), new Date(t.created_at)),
            0
          ) / respondedTickets.length
        : null;

    return { volume, statusData, categoryData, priorityData, agentData, slaCompliance, avgResolutionMs, avgFirstResponseMs, total: tickets.length };
  }, [tickets]);

  const volumeConfig: ChartConfig = { tickets: { label: "Tickets", color: colors[0] } };
  const statusConfig: ChartConfig = { count: { label: "Tickets" } };
  const categoryConfig: ChartConfig = { count: { label: "Tickets" } };
  const priorityConfig: ChartConfig = { count: { label: "Tickets" } };
  const agentConfig: ChartConfig = { count: { label: "Resolved" } };

  const slaColor = stats?.slaCompliance == null ? undefined
    : stats.slaCompliance >= 90 ? STATUS_COLORS.good
    : stats.slaCompliance >= 75 ? STATUS_COLORS.warning
    : STATUS_COLORS.critical;

  return (
    <AppShell>
      <div className="container py-8">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="mt-1 text-muted-foreground">Ticket volume, SLA performance, and team workload for {organization?.name}.</p>
          <div className="mt-3 h-0.5 w-12 rounded-full bg-gradient-gold" />
        </div>

        {isLoading || !stats ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-xl border bg-card p-4 shadow-card">
                <p className="text-sm text-muted-foreground">Total Tickets</p>
                <p className="mt-1 font-display text-2xl font-bold">{stats.total}</p>
              </div>
              <div className="rounded-xl border bg-card p-4 shadow-card">
                <p className="text-sm text-muted-foreground">SLA Compliance</p>
                <p className="mt-1 font-display text-2xl font-bold" style={{ color: slaColor }}>
                  {stats.slaCompliance != null ? `${stats.slaCompliance}%` : "—"}
                </p>
              </div>
              <div className="rounded-xl border bg-card p-4 shadow-card">
                <p className="text-sm text-muted-foreground">Avg. Resolution Time</p>
                <p className="mt-1 font-display text-2xl font-bold">
                  {stats.avgResolutionMs != null ? formatDuration(stats.avgResolutionMs) : "—"}
                </p>
              </div>
              <div className="rounded-xl border bg-card p-4 shadow-card">
                <p className="text-sm text-muted-foreground">Avg. First Response</p>
                <p className="mt-1 font-display text-2xl font-bold">
                  {stats.avgFirstResponseMs != null ? formatDuration(stats.avgFirstResponseMs) : "—"}
                </p>
              </div>
            </div>

            <div className="rounded-xl border bg-card p-6 shadow-card">
              <h3 className="mb-4 font-display font-semibold">Ticket Volume — Last 30 Days</h3>
              <ChartContainer config={volumeConfig} className="h-[240px] w-full">
                <LineChart data={stats.volume} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} interval={5} fontSize={11} />
                  <YAxis tickLine={false} axisLine={false} width={28} fontSize={11} allowDecimals={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line type="monotone" dataKey="tickets" stroke={colors[0]} strokeWidth={2} dot={false} />
                </LineChart>
              </ChartContainer>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-xl border bg-card p-6 shadow-card">
                <h3 className="mb-4 font-display font-semibold">Tickets by Status</h3>
                <ChartContainer config={statusConfig} className="h-[220px] w-full">
                  <BarChart data={stats.statusData} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="status" tickLine={false} axisLine={false} fontSize={11} />
                    <YAxis tickLine={false} axisLine={false} width={28} fontSize={11} allowDecimals={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {stats.statusData.map((_, i) => (
                        <Cell key={i} fill={colors[i % colors.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              </div>

              <div className="rounded-xl border bg-card p-6 shadow-card">
                <h3 className="mb-4 font-display font-semibold">Tickets by Priority</h3>
                <ChartContainer config={priorityConfig} className="h-[220px] w-full">
                  <BarChart data={stats.priorityData} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="priority" tickLine={false} axisLine={false} fontSize={11} />
                    <YAxis tickLine={false} axisLine={false} width={28} fontSize={11} allowDecimals={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {stats.priorityData.map((_, i) => (
                        <Cell key={i} fill={colors[i % colors.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              </div>

              <div className="rounded-xl border bg-card p-6 shadow-card">
                <h3 className="mb-4 font-display font-semibold">Top Categories</h3>
                <ChartContainer config={categoryConfig} className="h-[240px] w-full">
                  <BarChart data={stats.categoryData} layout="vertical" margin={{ left: 8, right: 12, top: 8, bottom: 0 }}>
                    <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                    <XAxis type="number" tickLine={false} axisLine={false} fontSize={11} allowDecimals={false} />
                    <YAxis dataKey="category" type="category" tickLine={false} axisLine={false} width={110} fontSize={11} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]} fill={colors[0]} />
                  </BarChart>
                </ChartContainer>
              </div>

              <div className="rounded-xl border bg-card p-6 shadow-card">
                <h3 className="mb-4 font-display font-semibold">Agent Workload (Assigned Tickets)</h3>
                {stats.agentData.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">No tickets assigned yet.</p>
                ) : (
                  <ChartContainer config={agentConfig} className="h-[240px] w-full">
                    <BarChart data={stats.agentData} layout="vertical" margin={{ left: 8, right: 12, top: 8, bottom: 0 }}>
                      <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                      <XAxis type="number" tickLine={false} axisLine={false} fontSize={11} allowDecimals={false} />
                      <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} width={110} fontSize={11} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]} fill={colors[1]} />
                    </BarChart>
                  </ChartContainer>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default Analytics;
