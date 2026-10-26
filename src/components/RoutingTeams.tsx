import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Route, X } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

type Member = { user_id: string; role: string; profiles: { full_name: string | null; email: string | null } | null };
type Team = { id: string; key: string; name: string; description: string; sort: number };
type Link = { team_id: string; user_id: string };

const label = (m: Member) => m.profiles?.full_name || m.profiles?.email || "Unknown";

/** Staff (owner/admin/agent — not viewers) not already on the team. */
export function staffOptions(members: Member[], onTeam: string[]): Member[] {
  return members.filter((m) => m.role !== "viewer" && !onTeam.includes(m.user_id));
}

interface Props {
  orgId: string | undefined;
  members: Member[];
  canManage: boolean;
}

/** Who handles which topic. The AI picks a team per ticket; the least-busy member is assigned. */
export function RoutingTeams({ orgId, members, canManage }: Props) {
  const queryClient = useQueryClient();
  const key = ["routing", orgId];

  const { data } = useQuery({
    queryKey: key,
    enabled: !!orgId,
    queryFn: async () => {
      const { data: teams, error } = await supabase
        .from("routing_teams")
        .select("id, key, name, description, sort")
        .eq("organization_id", orgId!)
        .order("sort");
      if (error) throw error;
      const ids = (teams ?? []).map((t) => t.id);
      const { data: links, error: linkError } = ids.length
        ? await supabase.from("routing_team_members").select("team_id, user_id").in("team_id", ids)
        : { data: [], error: null };
      if (linkError) throw linkError;
      return { teams: (teams ?? []) as Team[], links: (links ?? []) as Link[] };
    },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: key });
  const byId = new Map(members.map((m) => [m.user_id, m]));

  const addMember = async (team: Team, userId: string) => {
    if (!userId) return;
    const { error } = await supabase.from("routing_team_members").insert({ team_id: team.id, user_id: userId });
    if (error) toast.error("Couldn't add to team");
    refresh();
  };

  const removeMember = async (team: Team, userId: string) => {
    const { error } = await supabase.from("routing_team_members").delete().eq("team_id", team.id).eq("user_id", userId);
    if (error) toast.error("Couldn't remove from team");
    refresh();
  };

  const saveDescription = async (team: Team, description: string) => {
    if (description.trim() === team.description) return;
    const { error } = await supabase.from("routing_teams").update({ description: description.trim() }).eq("id", team.id);
    if (error) toast.error("Couldn't save the description");
    else toast.success(`${team.name} updated`);
    refresh();
  };

  return (
    <div className="mt-10">
      <div className="mb-4">
        <h2 className="inline-flex items-center gap-2 font-display text-xl font-bold tracking-tight">
          <Route className="h-5 w-5 text-cyan" /> Routing
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The AI picks a team for every ticket and live chat, then assigns the team member with the fewest open tickets.
          The description tells the AI what each team handles.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {data?.teams.map((team) => {
          const onTeam = data.links.filter((l) => l.team_id === team.id).map((l) => l.user_id);
          const options = staffOptions(members, onTeam);
          return (
            <section key={team.id} aria-label={team.name} className="glass rounded-2xl p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display text-base font-semibold">{team.name}</h3>
                <code className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{team.key}</code>
              </div>

              {canManage ? (
                <Textarea
                  aria-label={`What ${team.name} handles`}
                  defaultValue={team.description}
                  rows={2}
                  maxLength={300}
                  onBlur={(e) => saveDescription(team, e.target.value)}
                  className="mt-2 text-sm"
                />
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">{team.description}</p>
              )}

              <div className="mt-3 flex flex-wrap gap-1.5">
                {onTeam.length === 0 && (
                  <p className="text-xs text-gold">No one yet — tickets go to the owner until you add someone.</p>
                )}
                {onTeam.map((uid) => {
                  const m = byId.get(uid);
                  const name = m ? label(m) : "Former member";
                  return (
                    <span key={uid} className="inline-flex items-center gap-1 rounded-full border border-cyan/40 bg-cyan/10 px-2.5 py-1 text-xs">
                      {name}
                      {canManage && (
                        <button
                          onClick={() => removeMember(team, uid)}
                          aria-label={`Remove ${name} from ${team.name}`}
                          className="rounded-full p-0.5 hover:bg-cyan/20"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </span>
                  );
                })}
              </div>

              {canManage && options.length > 0 && (
                <select
                  aria-label={`Add member to ${team.name}`}
                  value=""
                  onChange={(e) => addMember(team, e.target.value)}
                  className="mt-3 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                >
                  <option value="">+ Add team member…</option>
                  {options.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {label(m)}
                    </option>
                  ))}
                </select>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
