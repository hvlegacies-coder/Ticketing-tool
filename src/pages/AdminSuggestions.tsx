import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ExternalLink, GitMerge, Loader2, MessageSquareQuote, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
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
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useOrganization } from "@/hooks/useOrganization";
import { supabase } from "@/integrations/supabase/client";
import { STATUS_STYLES, STATUS_TEMPLATES, SUGGESTION_STATUSES, type SuggestionStatus } from "@/lib/suggestions";

type Target = { id: string; title: string };
/** Respond dialog target; newStatus is set when it opened from a status change. */
type RespondTarget = Target & { status: SuggestionStatus; newStatus?: SuggestionStatus };

const AdminSuggestions = () => {
  const { organization, role } = useOrganization();
  const queryClient = useQueryClient();
  const orgId = organization?.id;
  const canModerate = role === "owner" || role === "admin" || role === "agent";
  const canDelete = role === "owner" || role === "admin";
  const key = ["admin-suggestions", orgId];

  const [respondTo, setRespondTo] = useState<RespondTarget | null>(null);
  const [responseDraft, setResponseDraft] = useState("");
  const [mergeFrom, setMergeFrom] = useState<Target | null>(null);
  const [mergeTarget, setMergeTarget] = useState<string | null>(null);
  const [mergeFilter, setMergeFilter] = useState("");
  const [merging, setMerging] = useState(false);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: key,
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suggestions")
        .select("*")
        .eq("organization_id", orgId!)
        .order("vote_count", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const update = async (id: string, patch: { status?: string; is_hidden?: boolean; staff_response?: string | null }) => {
    const { error } = await supabase.from("suggestions").update(patch).eq("id", id);
    if (error) toast.error("Couldn't update the suggestion");
    queryClient.invalidateQueries({ queryKey: key });
  };

  // One update for status + note, so the author's status email includes the note.
  const saveResponse = async (withNote = true) => {
    if (!respondTo) return;
    await update(respondTo.id, {
      ...(respondTo.newStatus ? { status: respondTo.newStatus } : {}),
      ...(withNote ? { staff_response: responseDraft.trim() || null } : {}),
    });
    setRespondTo(null);
  };

  const doMerge = async () => {
    if (!mergeFrom || !mergeTarget || merging) return;
    setMerging(true);
    const { error } = await supabase.rpc("merge_suggestion", { _from: mergeFrom.id, _into: mergeTarget });
    setMerging(false);
    if (error) {
      toast.error("Couldn't merge the suggestions");
      return;
    }
    toast.success("Merged — votes moved and the duplicate is hidden");
    setMergeFrom(null);
    queryClient.invalidateQueries({ queryKey: key });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("suggestions").delete().eq("id", id);
    if (error) toast.error("Couldn't delete the suggestion");
    else toast.success("Suggestion deleted");
    queryClient.invalidateQueries({ queryKey: key });
  };

  const titleById = new Map(rows.map((r) => [r.id, r.title]));
  const mergeOptions = mergeFrom
    ? rows.filter(
        (r) => r.id !== mergeFrom.id && !r.merged_into && r.title.toLowerCase().includes(mergeFilter.trim().toLowerCase()),
      )
    : [];

  return (
    <AppShell>
      <div className="container py-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">Suggestions</h1>
            <p className="mt-1 text-muted-foreground">Ideas from your customers. Set a status so they can see progress.</p>
            <div className="mt-3 h-0.5 w-12 rounded-full bg-gradient-gold" />
          </div>
          {organization && (
            <Button variant="outline" asChild>
              <a href={`/support/${organization.slug}/suggestions`} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" /> View public board
              </a>
            </Button>
          )}
        </div>

        <div className="glass overflow-x-auto rounded-2xl">
          {isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-cyan" /></div>
          ) : rows.length === 0 ? (
            <p className="py-16 text-center text-muted-foreground">No suggestions yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Suggestion</TableHead>
                  <TableHead>Author</TableHead>
                  <TableHead className="text-right">Votes</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Hidden</TableHead>
                  <TableHead className="sr-only">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((s) => (
                  <TableRow key={s.id} className={s.is_hidden ? "opacity-60" : ""}>
                    <TableCell className="max-w-sm">
                      <p className="font-medium">{s.title}</p>
                      <p className="line-clamp-2 text-xs text-muted-foreground">{s.description}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {s.category} · {format(new Date(s.created_at), "MMM d, yyyy")}
                      </p>
                      {s.merged_into && (
                        <p className="mt-1 text-[11px] text-violet">
                          Merged into: {titleById.get(s.merged_into) ?? "another suggestion"}
                        </p>
                      )}
                      {s.staff_response && (
                        <p className="mt-1 line-clamp-2 border-l-2 border-[#f5c84c]/60 pl-2 text-xs text-gold">{s.staff_response}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <p className="text-sm">{s.author_name}</p>
                      <a href={`mailto:${s.author_email}`} className="text-xs text-cyan hover:underline">{s.author_email}</a>
                    </TableCell>
                    <TableCell className="text-right font-bold text-gold">{s.vote_count}</TableCell>
                    <TableCell>
                      <Select
                        value={s.status}
                        onValueChange={(v) => {
                          setRespondTo({ id: s.id, title: s.title, status: s.status as SuggestionStatus, newStatus: v as SuggestionStatus });
                          setResponseDraft(s.staff_response ?? "");
                        }}
                        disabled={!canModerate}
                      >
                        <SelectTrigger className={`h-8 w-36 ${STATUS_STYLES[s.status as SuggestionStatus]}`} aria-label={`Status of ${s.title}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SUGGESTION_STATUSES.map((st) => (
                            <SelectItem key={st} value={st}>{st}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={s.is_hidden}
                        onCheckedChange={(v) => update(s.id, { is_hidden: v })}
                        disabled={!canModerate}
                        aria-label={`Hide ${s.title}`}
                      />
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {canModerate && (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Respond to ${s.title}`}
                          onClick={() => {
                            setRespondTo({ id: s.id, title: s.title, status: s.status as SuggestionStatus });
                            setResponseDraft(s.staff_response ?? "");
                          }}
                        >
                          <MessageSquareQuote className="h-4 w-4 text-gold" />
                        </Button>
                      )}
                      {canDelete && !s.merged_into && (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Merge ${s.title}`}
                          onClick={() => {
                            setMergeFrom({ id: s.id, title: s.title });
                            setMergeTarget(null);
                            setMergeFilter("");
                          }}
                        >
                          <GitMerge className="h-4 w-4 text-violet" />
                        </Button>
                      )}
                      {canDelete && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label={`Delete ${s.title}`}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete this suggestion?</AlertDialogTitle>
                              <AlertDialogDescription>
                                "{s.title}" and its votes will be removed permanently. Hide it instead to keep the record.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => remove(s.id)}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <Dialog open={respondTo !== null} onOpenChange={(o) => !o && setRespondTo(null)}>
        <DialogContent className="glass">
          <DialogHeader>
            <DialogTitle>{respondTo?.newStatus ? `Set status to "${respondTo.newStatus}"` : "Respond to suggestion"}</DialogTitle>
            <DialogDescription>
              Add a note for "{respondTo?.title}". It's shown publicly and included in the author's status email.
            </DialogDescription>
          </DialogHeader>
          {respondTo && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quick templates</p>
              {STATUS_TEMPLATES[respondTo.newStatus ?? respondTo.status]?.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setResponseDraft(t)}
                  className={`block w-full rounded-lg border px-3 py-2 text-left text-sm hover:bg-muted ${
                    responseDraft === t ? "border-[#f5c84c] bg-[#f5c84c]/10" : "border-border"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
          <Textarea
            aria-label="Official response"
            rows={5}
            maxLength={2000}
            value={responseDraft}
            onChange={(e) => setResponseDraft(e.target.value)}
            placeholder="Thanks! This is planned for the next release."
          />
          <DialogFooter className="gap-2">
            {respondTo?.newStatus && (
              <Button variant="outline" onClick={() => saveResponse(false)}>
                Change status without note
              </Button>
            )}
            <Button onClick={() => saveResponse()} className="bg-gradient-gold text-primary-foreground">
              {respondTo?.newStatus ? "Save status & note" : "Save response"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={mergeFrom !== null} onOpenChange={(o) => !o && setMergeFrom(null)}>
        <DialogContent className="glass">
          <DialogHeader>
            <DialogTitle>Merge "{mergeFrom?.title}" into…</DialogTitle>
            <DialogDescription>
              Votes move to the suggestion you pick (each voter counted once). This one gets hidden.
            </DialogDescription>
          </DialogHeader>
          <Input
            aria-label="Search suggestions"
            placeholder="Search suggestions…"
            value={mergeFilter}
            onChange={(e) => setMergeFilter(e.target.value)}
          />
          <ul role="listbox" aria-label="Merge target" className="max-h-60 space-y-1 overflow-y-auto">
            {mergeOptions.length === 0 ? (
              <li className="py-4 text-center text-sm text-muted-foreground">No other suggestions match.</li>
            ) : (
              mergeOptions.map((r) => (
                <li
                  key={r.id}
                  role="option"
                  aria-selected={mergeTarget === r.id}
                  tabIndex={0}
                  onClick={() => setMergeTarget(r.id)}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setMergeTarget(r.id)}
                  className={`cursor-pointer rounded-lg border px-3 py-2 text-sm ${
                    mergeTarget === r.id ? "border-violet bg-violet/10" : "border-transparent hover:bg-muted"
                  }`}
                >
                  {r.title} <span className="text-xs text-muted-foreground">· {r.vote_count} votes</span>
                </li>
              ))
            )}
          </ul>
          <DialogFooter>
            <Button onClick={doMerge} disabled={!mergeTarget || merging} className="bg-gradient-gold text-primary-foreground">
              {merging && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Merge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
};

export default AdminSuggestions;
