import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronUp, Lightbulb, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { PortalHeader } from "@/components/PortalHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import {
  STATUS_STYLES,
  SUGGESTION_CATEGORIES,
  SUGGESTION_STATUSES,
  type SuggestionStatus,
  getVoterEmail,
  mapSuggestionError,
  setVoterEmail,
  suggestionSchema,
} from "@/lib/suggestions";
import NotFound from "@/pages/NotFound";

type Sort = "top" | "new";
const EMPTY_FORM = { name: "", email: "", title: "", description: "", category: "App" };

export default function Suggestions() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const queryClient = useQueryClient();
  const reduceMotion = useReducedMotion();
  const [sort, setSort] = useState<Sort>("top");
  const [statusFilter, setStatusFilter] = useState<"All" | SuggestionStatus>("All");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [voted, setVoted] = useState<Set<string>>(new Set());
  const [pendingVote, setPendingVote] = useState<string | null>(null);
  const [voterEmailDraft, setVoterEmailDraft] = useState("");

  const { data: org, isLoading: orgLoading } = useQuery({
    queryKey: ["org-public-profile", orgSlug],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_org_public_profile", { _slug: orgSlug! });
      if (error) throw error;
      return data?.[0] ?? null;
    },
    enabled: !!orgSlug,
  });

  const listKey = ["public-suggestions", orgSlug, sort];
  const { data: suggestions = [], isLoading, isError } = useQuery({
    queryKey: listKey,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_public_suggestions", { _slug: orgSlug!, _sort: sort });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!org,
  });

  const visible = statusFilter === "All" ? suggestions : suggestions.filter((s) => s.status === statusFilter);

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = suggestionSchema.safeParse(form);
    if (!parsed.success) {
      setFormError(parsed.error.issues[0].message);
      return;
    }
    setFormError(null);
    setPosting(true);
    const { error } = await supabase.rpc("create_suggestion", {
      _slug: orgSlug!,
      _name: parsed.data.name,
      _email: parsed.data.email,
      _title: parsed.data.title,
      _description: parsed.data.description,
      _category: parsed.data.category,
    });
    setPosting(false);
    if (error) {
      setFormError(mapSuggestionError(error));
      return;
    }
    if (!getVoterEmail()) setVoterEmail(parsed.data.email);
    toast.success("Thanks! Your suggestion is live.");
    setForm(EMPTY_FORM);
    setFormOpen(false);
    queryClient.invalidateQueries({ queryKey: ["public-suggestions", orgSlug] });
  };

  const castVote = async (id: string, email: string) => {
    setVoted((prev) => new Set(prev).add(id));
    queryClient.setQueryData<typeof suggestions>(listKey, (rows) =>
      rows?.map((r) => (r.id === id ? { ...r, vote_count: r.vote_count + 1 } : r)),
    );
    const { data, error } = await supabase.rpc("vote_suggestion", { _id: id, _email: email });
    if (error) {
      setVoted((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["public-suggestions", orgSlug] });
      toast.error("Couldn't record your vote. Please try again.");
      return;
    }
    queryClient.setQueryData<typeof suggestions>(listKey, (rows) =>
      rows?.map((r) => (r.id === id ? { ...r, vote_count: data } : r)),
    );
  };

  const handleVote = (id: string) => {
    if (voted.has(id)) return;
    const email = getVoterEmail();
    if (email) void castVote(id, email);
    else setPendingVote(id);
  };

  const confirmVoterEmail = (e: React.FormEvent) => {
    e.preventDefault();
    const email = voterEmailDraft.trim();
    if (!suggestionSchema.shape.email.safeParse(email).success) {
      toast.error("Enter a valid email to vote.");
      return;
    }
    setVoterEmail(email);
    const id = pendingVote!;
    setPendingVote(null);
    void castVote(id, email);
  };

  if (orgLoading) {
    return (
      <div className="grid-bg flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-cyan" />
      </div>
    );
  }
  if (!org) return <NotFound />;

  return (
    <div className="grid-bg min-h-screen">
      <PortalHeader orgName={org.name} orgLogoUrl={org.logo_url} homeHref={`/support/${orgSlug}`} orgSlug={orgSlug} />

      <main className="container max-w-3xl py-10">
        <motion.div initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mb-2 inline-flex items-center gap-1.5 text-xs tracking-[0.15em] text-cyan">
                <Lightbulb className="h-3.5 w-3.5" /> SUGGESTIONS
              </p>
              <h1 className="text-3xl font-bold">Help us build a better {org.name}</h1>
              <p className="mt-2 text-muted-foreground">Share an idea for our apps and systems, or upvote the ones you want most.</p>
            </div>
            <Button onClick={() => setFormOpen(true)} className="shrink-0 bg-gradient-gold text-primary-foreground glow-gold">
              <Plus className="mr-1 h-4 w-4" /> Suggest an improvement
            </Button>
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="glass inline-flex rounded-full p-1" role="group" aria-label="Sort">
              {(["top", "new"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSort(s)}
                  aria-pressed={sort === s}
                  className={`rounded-full px-3 py-1 text-sm ${sort === s ? "bg-cyan/15 text-cyan" : "text-muted-foreground"}`}
                >
                  {s === "top" ? "Top" : "New"}
                </button>
              ))}
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
              <SelectTrigger className="h-9 w-44" aria-label="Filter by status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All statuses</SelectItem>
                {SUGGESTION_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isError ? (
            <div role="alert" className="glass rounded-2xl py-16 text-center text-muted-foreground">
              Couldn't load suggestions. Please refresh the page.
            </div>
          ) : isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-cyan" /></div>
          ) : visible.length === 0 ? (
            <div className="glass rounded-2xl py-16 text-center text-muted-foreground">
              No suggestions yet. Be the first to share an idea!
            </div>
          ) : (
            <ul className="space-y-3">
              {visible.map((s) => (
                <li key={s.id} className="glass flex gap-4 rounded-2xl p-4 transition-shadow hover:shadow-elevated">
                  <button
                    onClick={() => handleVote(s.id)}
                    disabled={voted.has(s.id)}
                    aria-label={`Upvote ${s.title} (${s.vote_count} votes)`}
                    className={`flex h-14 w-12 shrink-0 flex-col items-center justify-center rounded-xl border text-sm font-bold transition ${
                      voted.has(s.id)
                        ? "border-[#f5c84c] bg-gradient-gold text-primary-foreground"
                        : "border-[#f5c84c]/50 text-gold hover:glow-gold"
                    }`}
                  >
                    <ChevronUp className="h-4 w-4" />
                    {s.vote_count}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-sans text-base font-semibold">{s.title}</h2>
                      <Badge variant="outline" className={STATUS_STYLES[s.status as SuggestionStatus]}>{s.status}</Badge>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{s.description}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {s.category} · {s.author_name} · {formatDistanceToNow(new Date(s.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </motion.div>
      </main>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="glass">
          <DialogHeader>
            <DialogTitle>Suggest an improvement</DialogTitle>
            <DialogDescription>Your name is shown publicly. Your email is only visible to our team.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePost} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="sg-name">Name</Label>
                <Input id="sg-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={100} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sg-email">Email</Label>
                <Input id="sg-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="sg-title">Title</Label>
              <Input id="sg-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={140} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sg-category">Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger id="sg-category"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SUGGESTION_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="sg-description">Description</Label>
              <Textarea
                id="sg-description"
                rows={4}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                maxLength={4000}
              />
            </div>
            {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}
            <Button type="submit" disabled={posting} className="w-full bg-gradient-gold text-primary-foreground">
              {posting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Post suggestion
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={pendingVote !== null} onOpenChange={(o) => !o && setPendingVote(null)}>
        <DialogContent className="glass max-w-sm">
          <DialogHeader>
            <DialogTitle>Your email</DialogTitle>
            <DialogDescription>One vote per email. We'll remember it on this device.</DialogDescription>
          </DialogHeader>
          <form onSubmit={confirmVoterEmail} className="space-y-3">
            <Label htmlFor="voter-email" className="sr-only">Email</Label>
            <Input id="voter-email" type="email" value={voterEmailDraft} onChange={(e) => setVoterEmailDraft(e.target.value)} autoFocus />
            <Button type="submit" className="w-full bg-gradient-gold text-primary-foreground">Vote</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
