import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus, Loader2, Trash2, Mail, Clock } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/hooks/useAuth";
import { ROLE_LABELS, ROLE_DESCRIPTIONS, type OrgRole } from "@/lib/organization";
import { toast } from "sonner";
import { format } from "date-fns";

const INVITABLE_ROLES: OrgRole[] = ["admin", "agent", "viewer"];

const Team = () => {
  const { organization, role: myRole } = useOrganization();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<OrgRole>("agent");
  const [inviting, setInviting] = useState(false);

  const orgId = organization?.id;

  const { data: members = [], isLoading: loadingMembers } = useQuery({
    queryKey: ["team-members", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization_members")
        .select("id, user_id, role, created_at, profiles(full_name,email)")
        .eq("organization_id", orgId!)
        .order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  const { data: invitations = [] } = useQuery({
    queryKey: ["team-invitations", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization_invitations")
        .select("*")
        .eq("organization_id", orgId!)
        .is("accepted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !orgId) return;
    setInviting(true);
    try {
      const { data: invite, error } = await supabase
        .from("organization_invitations")
        .insert({
          organization_id: orgId,
          email: inviteEmail.trim().toLowerCase(),
          role: inviteRole,
          invited_by: user?.id,
        } as never)
        .select()
        .single();
      if (error) throw error;

      try {
        await supabase.functions.invoke("send-invitation-email", {
          body: {
            email: invite.email,
            orgName: organization?.name,
            role: inviteRole,
            inviteLink: `${window.location.origin}/invite/${invite.token}`,
          },
        });
      } catch (emailErr) {
        console.error("Invite email error (non-blocking):", emailErr);
        toast.info("Invite created, but the email couldn't be sent — share the link manually.");
      }

      toast.success(`Invitation sent to ${invite.email}`);
      setInviteEmail("");
      queryClient.invalidateQueries({ queryKey: ["team-invitations", orgId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send invitation");
    } finally {
      setInviting(false);
    }
  };

  const handleRevoke = async (invitationId: string) => {
    const { error } = await supabase.from("organization_invitations").delete().eq("id", invitationId);
    if (error) toast.error("Failed to revoke invitation");
    else {
      toast.success("Invitation revoked");
      queryClient.invalidateQueries({ queryKey: ["team-invitations", orgId] });
    }
  };

  const handleRoleChange = async (memberId: string, newRole: OrgRole) => {
    const { error } = await supabase.from("organization_members").update({ role: newRole } as never).eq("id", memberId);
    if (error) toast.error("Failed to update role");
    else {
      toast.success("Role updated");
      queryClient.invalidateQueries({ queryKey: ["team-members", orgId] });
    }
  };

  const handleRemove = async (memberId: string) => {
    const { error } = await supabase.from("organization_members").delete().eq("id", memberId);
    if (error) toast.error("Failed to remove member");
    else {
      toast.success("Member removed");
      queryClient.invalidateQueries({ queryKey: ["team-members", orgId] });
    }
  };

  return (
    <AppShell>
      <div className="container max-w-4xl py-8">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold tracking-tight">Team</h1>
          <p className="mt-1 text-muted-foreground">Manage who has access to {organization?.name}'s support desk.</p>
          <div className="mt-3 h-0.5 w-12 rounded-full bg-gradient-gold" />
        </div>

        <div className="mb-8 rounded-xl border bg-card p-6 shadow-card">
          <h2 className="mb-4 flex items-center gap-2 font-display font-semibold">
            <UserPlus className="h-4 w-4" />
            Invite a teammate
          </h2>
          <form onSubmit={handleInvite} className="flex flex-wrap gap-3">
            <div className="min-w-[220px] flex-1 space-y-1.5">
              <Label htmlFor="inviteEmail" className="sr-only">Email</Label>
              <Input
                id="inviteEmail"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="teammate@company.com"
                required
              />
            </div>
            <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as OrgRole)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INVITABLE_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="submit" disabled={inviting} className="bg-gradient-gold hover:opacity-90">
              {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send Invite"}
            </Button>
          </form>
          <p className="mt-2 text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[inviteRole]}</p>
        </div>

        {invitations.length > 0 && (
          <div className="mb-8 rounded-xl border bg-card p-6 shadow-card">
            <h2 className="mb-4 flex items-center gap-2 font-display font-semibold">
              <Clock className="h-4 w-4" />
              Pending invitations
            </h2>
            <div className="space-y-2">
              {invitations.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{inv.email}</p>
                      <p className="text-xs text-muted-foreground">
                        {ROLE_LABELS[inv.role as OrgRole] ?? inv.role} · expires {format(new Date(inv.expires_at), "MMM d, yyyy")}
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleRevoke(inv.id)} className="text-muted-foreground hover:text-destructive">
                    Revoke
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-xl border bg-card p-6 shadow-card">
          <h2 className="mb-4 font-display font-semibold">Members</h2>
          {loadingMembers ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-2">
              {members.map((m) => (
                <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">{m.profiles?.full_name || m.profiles?.email || "Unknown"}</p>
                    <p className="text-xs text-muted-foreground">{m.profiles?.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {m.role === "owner" ? (
                      <span className="rounded-full bg-gold/10 px-3 py-1 text-xs font-medium text-primary">Owner</span>
                    ) : (
                      <>
                        <Select value={m.role} onValueChange={(v) => handleRoleChange(m.id, v as OrgRole)}>
                          <SelectTrigger className="h-8 w-[120px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {INVITABLE_ROLES.map((r) => (
                              <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove this member?</AlertDialogTitle>
                              <AlertDialogDescription>
                                They will immediately lose access to {organization?.name}'s tickets and dashboard.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleRemove(m.id)} className="bg-destructive hover:bg-destructive/90">
                                Remove
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
};

export default Team;
