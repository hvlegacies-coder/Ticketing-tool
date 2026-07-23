import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save, ExternalLink, Copy, ShieldAlert } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { toast } from "sonner";

const Settings = () => {
  const { organization, role, refetch } = useOrganization();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const orgId = organization?.id;
  const isOwner = role === "owner";

  const [orgName, setOrgName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [brandColor, setBrandColor] = useState("#B8860B");
  const [supportEmail, setSupportEmail] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  useEffect(() => {
    if (organization) {
      setOrgName(organization.name);
      setLogoUrl(organization.logo_url ?? "");
      setBrandColor(organization.brand_color);
      setSupportEmail(organization.support_email ?? "");
    }
  }, [organization]);

  const { data: slaPolicies = [] } = useQuery({
    queryKey: ["sla-policies", orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("sla_policies").select("*").eq("organization_id", orgId!).order("first_response_minutes");
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  const { data: integration } = useQuery({
    queryKey: ["org-integration", orgId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_org_integration_settings", { _org_id: orgId! });
      if (error) throw error;
      return data?.[0] ?? null;
    },
    enabled: !!orgId,
  });

  const [mondayBoardId, setMondayBoardId] = useState("");
  const [mondayGroupId, setMondayGroupId] = useState("");
  const [mondayToken, setMondayToken] = useState("");
  const [aiEnabled, setAiEnabled] = useState(true);
  const [aiPrompt, setAiPrompt] = useState("");
  const [savingIntegration, setSavingIntegration] = useState(false);

  useEffect(() => {
    if (integration) {
      setMondayBoardId(integration.monday_board_id ?? "");
      setMondayGroupId(integration.monday_group_id ?? "");
      setAiEnabled(integration.ai_chat_enabled);
      setAiPrompt(integration.ai_system_prompt_override ?? "");
    }
  }, [integration]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId) return;
    setSavingProfile(true);
    const { error } = await supabase
      .from("organizations")
      .update({
        name: orgName.trim(),
        logo_url: logoUrl.trim() || null,
        brand_color: brandColor,
        support_email: supportEmail.trim() || null,
      } as never)
      .eq("id", orgId);
    if (error) toast.error("Failed to save");
    else {
      toast.success("Organization profile updated");
      refetch();
    }
    setSavingProfile(false);
  };

  const handleSlaChange = async (id: string, field: "first_response_minutes" | "resolution_minutes", value: number) => {
    const { error } = await supabase.from("sla_policies").update({ [field]: value } as never).eq("id", id);
    if (error) toast.error("Failed to update SLA policy");
    else queryClient.invalidateQueries({ queryKey: ["sla-policies", orgId] });
  };

  const handleSaveIntegration = async () => {
    if (!orgId) return;
    setSavingIntegration(true);
    const { error } = await supabase.rpc("upsert_org_integration_settings", {
      _org_id: orgId,
      _monday_api_token: mondayToken,
      _monday_board_id: mondayBoardId || null,
      _monday_group_id: mondayGroupId || null,
      _ai_chat_enabled: aiEnabled,
      _ai_system_prompt_override: aiPrompt || null,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Integration settings saved");
      setMondayToken("");
      queryClient.invalidateQueries({ queryKey: ["org-integration", orgId] });
    }
    setSavingIntegration(false);
  };

  const handleCopySupportLink = () => {
    if (!organization) return;
    navigator.clipboard.writeText(`${window.location.origin}/support/${organization.slug}`);
    toast.success("Support portal link copied");
  };

  const handleDeleteOrg = async () => {
    if (!orgId) return;
    const { error } = await supabase.from("organizations").delete().eq("id", orgId);
    if (error) {
      toast.error("Failed to delete organization");
      return;
    }
    toast.success("Organization deleted");
    navigate("/app");
  };

  if (!organization) {
    return (
      <AppShell>
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="container max-w-3xl space-y-8 py-8">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Settings</h1>
          <p className="mt-1 text-muted-foreground">Manage {organization.name}'s profile, SLA targets, and integrations.</p>
          <div className="mt-3 h-0.5 w-12 rounded-full bg-gradient-gold" />
        </div>

        <form onSubmit={handleSaveProfile} className="rounded-xl border bg-card p-6 shadow-card space-y-4">
          <h2 className="font-display font-semibold">Organization Profile</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="orgName">Name</Label>
              <Input id="orgName" value={orgName} onChange={(e) => setOrgName(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="supportEmail">Support Email</Label>
              <Input id="supportEmail" type="email" value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} placeholder="support@company.com" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="logoUrl">Logo URL</Label>
              <Input id="logoUrl" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://…/logo.png" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="brandColor">Brand Color</Label>
              <div className="flex items-center gap-2">
                <Input id="brandColor" type="color" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} className="h-10 w-16 p-1" />
                <Input value={brandColor} onChange={(e) => setBrandColor(e.target.value)} className="flex-1" />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
            <div className="text-sm">
              <p className="font-medium">Public support portal</p>
              <p className="text-muted-foreground">{window.location.origin}/support/{organization.slug}</p>
            </div>
            <div className="flex gap-1">
              <Button type="button" variant="ghost" size="icon" onClick={handleCopySupportLink}>
                <Copy className="h-4 w-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon" asChild>
                <a href={`/support/${organization.slug}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>

          <Button type="submit" disabled={savingProfile} className="bg-gradient-gold hover:opacity-90">
            {savingProfile ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Profile
          </Button>
        </form>

        <div className="rounded-xl border bg-card p-6 shadow-card space-y-4">
          <div>
            <h2 className="font-display font-semibold">SLA Policies</h2>
            <p className="text-sm text-muted-foreground">Response and resolution targets, per priority level.</p>
          </div>
          <div className="space-y-3">
            {slaPolicies.map((p) => (
              <div key={p.id} className="grid items-center gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_140px_140px]">
                <p className="text-sm font-medium">{p.priority}</p>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">First response (min)</Label>
                  <Input
                    type="number"
                    min={1}
                    defaultValue={p.first_response_minutes}
                    onBlur={(e) => handleSlaChange(p.id, "first_response_minutes", Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Resolution (min)</Label>
                  <Input
                    type="number"
                    min={1}
                    defaultValue={p.resolution_minutes}
                    onBlur={(e) => handleSlaChange(p.id, "resolution_minutes", Number(e.target.value))}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-card space-y-4">
          <div>
            <h2 className="font-display font-semibold">Integrations</h2>
            <p className="text-sm text-muted-foreground">Connect Monday.com and configure the AI intake assistant.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="mondayBoardId">Monday Board ID</Label>
              <Input id="mondayBoardId" value={mondayBoardId} onChange={(e) => setMondayBoardId(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mondayGroupId">Monday Group ID</Label>
              <Input id="mondayGroupId" value={mondayGroupId} onChange={(e) => setMondayGroupId(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mondayToken">Monday API Token</Label>
            <Input
              id="mondayToken"
              type="password"
              value={mondayToken}
              onChange={(e) => setMondayToken(e.target.value)}
              placeholder={integration?.monday_configured ? "•••••••••••••• (leave blank to keep current)" : "Paste your Monday.com API token"}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">AI intake assistant</p>
              <p className="text-xs text-muted-foreground">Let clients chat with an AI assistant before submitting a ticket.</p>
            </div>
            <Switch checked={aiEnabled} onCheckedChange={setAiEnabled} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="aiPrompt">AI Assistant Instructions (optional)</Label>
            <Textarea
              id="aiPrompt"
              rows={4}
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Add company-specific context the AI assistant should know about..."
            />
          </div>

          <Button onClick={handleSaveIntegration} disabled={savingIntegration} className="bg-gradient-gold hover:opacity-90">
            {savingIntegration ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Integration Settings
          </Button>
        </div>

        {isOwner && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 shadow-card space-y-3">
            <h2 className="flex items-center gap-2 font-display font-semibold text-destructive">
              <ShieldAlert className="h-4 w-4" />
              Danger Zone
            </h2>
            <p className="text-sm text-muted-foreground">
              Deleting this organization permanently removes all tickets, messages, and team access. This cannot be undone.
            </p>
            <AlertDialog onOpenChange={() => setDeleteConfirm("")}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">Delete Organization</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {organization.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Type <strong>{organization.name}</strong> to confirm. This action is permanent.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <Input value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} placeholder={organization.name} />
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={deleteConfirm !== organization.name}
                    onClick={handleDeleteOrg}
                    className="bg-destructive hover:bg-destructive/90"
                  >
                    Delete Permanently
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default Settings;
