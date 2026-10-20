import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ExternalLink, Loader2, Trash2 } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useOrganization } from "@/hooks/useOrganization";
import { supabase } from "@/integrations/supabase/client";
import { STATUS_STYLES, SUGGESTION_STATUSES, type SuggestionStatus } from "@/lib/suggestions";

const AdminSuggestions = () => {
  const { organization, role } = useOrganization();
  const queryClient = useQueryClient();
  const orgId = organization?.id;
  const canModerate = role === "owner" || role === "admin" || role === "agent";
  const canDelete = role === "owner" || role === "admin";
  const key = ["admin-suggestions", orgId];

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

  const update = async (id: string, patch: { status?: string; is_hidden?: boolean }) => {
    const { error } = await supabase.from("suggestions").update(patch).eq("id", id);
    if (error) toast.error("Couldn't update the suggestion");
    queryClient.invalidateQueries({ queryKey: key });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("suggestions").delete().eq("id", id);
    if (error) toast.error("Couldn't delete the suggestion");
    else toast.success("Suggestion deleted");
    queryClient.invalidateQueries({ queryKey: key });
  };

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
                  {canDelete && <TableHead className="sr-only">Delete</TableHead>}
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
                    </TableCell>
                    <TableCell>
                      <p className="text-sm">{s.author_name}</p>
                      <a href={`mailto:${s.author_email}`} className="text-xs text-cyan hover:underline">{s.author_email}</a>
                    </TableCell>
                    <TableCell className="text-right font-bold text-gold">{s.vote_count}</TableCell>
                    <TableCell>
                      <Select value={s.status} onValueChange={(v) => update(s.id, { status: v })} disabled={!canModerate}>
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
                    {canDelete && (
                      <TableCell>
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
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </AppShell>
  );
};

export default AdminSuggestions;
