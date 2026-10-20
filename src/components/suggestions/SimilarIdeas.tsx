import { useQuery } from "@tanstack/react-query";
import { ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

interface Props {
  orgSlug: string;
  title: string;
  voted: Set<string>;
  onVote: (id: string) => void;
}

/** While a customer types a title, suggests existing ideas they could upvote instead. */
export function SimilarIdeas({ orgSlug, title, voted, onVote }: Props) {
  const query = useDebouncedValue(title.trim(), 400);
  const { data: matches = [] } = useQuery({
    queryKey: ["similar-suggestions", orgSlug, query],
    enabled: query.length >= 3,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("find_similar_suggestions", { _slug: orgSlug, _query: query });
      if (error) throw error;
      return data ?? [];
    },
  });

  if (query.length < 3 || matches.length === 0) return null;
  return (
    <div className="rounded-xl border border-cyan/30 bg-cyan/[0.05] p-3">
      <p className="mb-2 text-xs font-medium text-cyan">Similar ideas — vote instead?</p>
      <ul className="space-y-1.5">
        {matches.map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
            <span className="truncate">{m.title} <span className="text-xs text-muted-foreground">· {m.status}</span></span>
            <button
              type="button"
              onClick={() => onVote(m.id)}
              disabled={voted.has(m.id)}
              aria-label={`Vote for ${m.title}`}
              className="inline-flex shrink-0 items-center gap-0.5 rounded-lg border border-[#f5c84c]/50 px-2 py-0.5 text-xs font-bold text-gold disabled:opacity-60"
            >
              <ChevronUp className="h-3 w-3" />{m.vote_count}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
