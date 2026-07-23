import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { X, Plus, Tag as TagIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TicketTagsEditorProps {
  ticketId: string;
  organizationId: string;
  canEdit: boolean;
}

const TAG_COLORS = ["#B8860B", "#3b82f6", "#10b981", "#ef4444", "#8b5cf6", "#f59e0b", "#ec4899", "#6b7280"];

export function TicketTagsEditor({ ticketId, organizationId, canEdit }: TicketTagsEditorProps) {
  const queryClient = useQueryClient();
  const [newTagName, setNewTagName] = useState("");
  const [creating, setCreating] = useState(false);

  const { data: allTags = [] } = useQuery({
    queryKey: ["org-tags", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase.from("tags").select("*").eq("organization_id", organizationId).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: ticketTags = [] } = useQuery({
    queryKey: ["ticket-tags", ticketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ticket_tags")
        .select("tag_id, tags(id, name, color)")
        .eq("ticket_id", ticketId);
      if (error) throw error;
      return data;
    },
  });

  const appliedIds = new Set(ticketTags.map((t) => t.tag_id));
  const availableTags = allTags.filter((t) => !appliedIds.has(t.id));

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["ticket-tags", ticketId] });
    queryClient.invalidateQueries({ queryKey: ["ticket-activity", ticketId] });
    queryClient.invalidateQueries({ queryKey: ["tickets", organizationId] });
  };

  const handleAddExisting = async (tagId: string) => {
    const { error } = await supabase.from("ticket_tags").insert({ ticket_id: ticketId, tag_id: tagId } as never);
    if (error) toast.error("Failed to add tag");
    else invalidate();
  };

  const handleRemove = async (tagId: string) => {
    const { error } = await supabase.from("ticket_tags").delete().eq("ticket_id", ticketId).eq("tag_id", tagId);
    if (error) toast.error("Failed to remove tag");
    else invalidate();
  };

  const handleCreateAndAdd = async () => {
    if (!newTagName.trim()) return;
    setCreating(true);
    const color = TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];
    const { data: tag, error } = await supabase
      .from("tags")
      .insert({ organization_id: organizationId, name: newTagName.trim(), color } as never)
      .select()
      .single();
    if (error || !tag) {
      toast.error(error?.message.includes("duplicate") ? "That tag already exists" : "Failed to create tag");
      setCreating(false);
      return;
    }
    await handleAddExisting(tag.id);
    queryClient.invalidateQueries({ queryKey: ["org-tags", organizationId] });
    setNewTagName("");
    setCreating(false);
  };

  return (
    <div className="rounded-xl border bg-card p-6 shadow-card">
      <h3 className="mb-3 flex items-center gap-2 font-display font-semibold">
        <TagIcon className="h-4 w-4" />
        Tags
      </h3>

      <div className="flex flex-wrap gap-2">
        {ticketTags.length === 0 && <p className="text-sm text-muted-foreground">No tags yet.</p>}
        {ticketTags.map((tt) =>
          tt.tags ? (
            <span
              key={tt.tag_id}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-white"
              style={{ backgroundColor: tt.tags.color }}
            >
              {tt.tags.name}
              {canEdit && (
                <button onClick={() => handleRemove(tt.tag_id)} className="hover:opacity-70">
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          ) : null
        )}
      </div>

      {canEdit && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {availableTags.length > 0 && (
            <Select onValueChange={handleAddExisting}>
              <SelectTrigger className="h-8 w-[160px] text-xs">
                <SelectValue placeholder="Add existing tag" />
              </SelectTrigger>
              <SelectContent>
                {availableTags.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="flex items-center gap-1">
            <Input
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder="New tag"
              className="h-8 w-28 text-xs"
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleCreateAndAdd())}
            />
            <Button size="icon" variant="outline" className="h-8 w-8" disabled={creating} onClick={handleCreateAndAdd}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
