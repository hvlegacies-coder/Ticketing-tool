import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Send, StickyNote } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TicketNotesProps {
  ticketId: string;
  authorId?: string;
  authorName: string;
  canWrite: boolean;
}

export function TicketNotes({ ticketId, authorId, authorName, canWrite }: TicketNotesProps) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ["ticket-notes", ticketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ticket_notes")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const handleAdd = async () => {
    if (!note.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from("ticket_notes").insert({
      ticket_id: ticketId,
      author_id: authorId ?? null,
      author_name: authorName,
      note: note.trim(),
    } as never);
    if (error) {
      toast.error("Failed to add note");
    } else {
      setNote("");
      queryClient.invalidateQueries({ queryKey: ["ticket-notes", ticketId] });
      queryClient.invalidateQueries({ queryKey: ["ticket-activity", ticketId] });
    }
    setSubmitting(false);
  };

  return (
    <div className="rounded-xl border bg-card shadow-card overflow-hidden">
      <div className="flex items-center gap-2 border-b bg-warning/10 px-4 py-3">
        <StickyNote className="h-4 w-4 text-warning" />
        <h3 className="font-display font-semibold text-sm">Internal Notes</h3>
        <span className="text-xs text-muted-foreground">(never visible to the client)</span>
      </div>

      <div className="max-h-64 space-y-3 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : notes.length === 0 ? (
          <p className="py-2 text-center text-sm text-muted-foreground">No internal notes yet.</p>
        ) : (
          notes.map((n) => (
            <div key={n.id} className="rounded-lg border border-warning/20 bg-warning/5 p-3">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-semibold">{n.author_name}</span>
                <span className="text-[10px] text-muted-foreground">
                  {format(new Date(n.created_at), "MMM d, h:mm a")}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-sm">{n.note}</p>
            </div>
          ))
        )}
      </div>

      {canWrite && (
        <div className="flex gap-2 border-t p-3">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a note for your team..."
            className="min-h-[44px] max-h-[120px] resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleAdd();
              }
            }}
          />
          <Button onClick={handleAdd} disabled={submitting || !note.trim()} size="icon" className="shrink-0 self-end">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      )}
    </div>
  );
}
