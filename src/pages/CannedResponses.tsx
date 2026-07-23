import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2, Pencil, Trash2, MessageSquareText } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type CannedResponse = Tables<"canned_responses">;

const emptyForm = { id: "", title: "", body: "", category: "" };

const CannedResponses = () => {
  const { organization } = useOrganization();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const orgId = organization?.id;
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const { data: responses = [], isLoading } = useQuery({
    queryKey: ["canned-responses-manage", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("canned_responses")
        .select("*")
        .eq("organization_id", orgId!)
        .order("category")
        .order("title");
      if (error) throw error;
      return data as CannedResponse[];
    },
    enabled: !!orgId,
  });

  const openCreate = () => {
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (r: CannedResponse) => {
    setForm({ id: r.id, title: r.title, body: r.body, category: r.category ?? "" });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.body.trim() || !orgId) return;
    setSaving(true);
    try {
      if (form.id) {
        const { error } = await supabase
          .from("canned_responses")
          .update({ title: form.title.trim(), body: form.body.trim(), category: form.category.trim() || null } as never)
          .eq("id", form.id);
        if (error) throw error;
        toast.success("Canned response updated");
      } else {
        const { error } = await supabase.from("canned_responses").insert({
          organization_id: orgId,
          title: form.title.trim(),
          body: form.body.trim(),
          category: form.category.trim() || null,
          created_by: user?.id,
        } as never);
        if (error) throw error;
        toast.success("Canned response created");
      }
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["canned-responses-manage", orgId] });
      queryClient.invalidateQueries({ queryKey: ["canned-responses", orgId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("canned_responses").delete().eq("id", id);
    if (error) toast.error("Failed to delete");
    else {
      toast.success("Deleted");
      queryClient.invalidateQueries({ queryKey: ["canned-responses-manage", orgId] });
    }
  };

  return (
    <AppShell>
      <div className="container max-w-3xl py-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">Canned Responses</h1>
            <p className="mt-1 text-muted-foreground">Reusable reply templates your team can insert into ticket messages.</p>
            <div className="mt-3 h-0.5 w-12 rounded-full bg-gradient-gold" />
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate} className="bg-gradient-gold hover:opacity-90">
                <Plus className="mr-2 h-4 w-4" />
                New Response
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{form.id ? "Edit" : "New"} Canned Response</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="title">Title</Label>
                  <Input id="title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Requesting more info" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="category">Category (optional)</Label>
                  <Input id="category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Onboarding" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="body">Message</Label>
                  <Textarea id="body" rows={6} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Hi {name}, thanks for reaching out..." />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={handleSave} disabled={saving} className="bg-gradient-gold hover:opacity-90">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : responses.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-16">
            <MessageSquareText className="h-8 w-8 text-muted-foreground" />
            <h3 className="mt-4 font-display font-semibold">No canned responses yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">Create your first reusable reply template.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {responses.map((r) => (
              <div key={r.id} className="rounded-xl border bg-card p-4 shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{r.title}</p>
                    {r.category && <p className="text-xs text-muted-foreground">{r.category}</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(r.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{r.body}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default CannedResponses;
