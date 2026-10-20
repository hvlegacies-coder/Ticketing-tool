import { formatDistanceToNow } from "date-fns";
import { ChevronUp, ShieldCheck } from "lucide-react";
import { glowLevel } from "@/lib/suggestions";
import { StatusProgress } from "./StatusProgress";

export type PublicSuggestion = {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  vote_count: number;
  author_name: string;
  created_at: string;
  staff_response: string | null;
  responded_at: string | null;
};

const GLOW = ["", "shadow-[0_0_10px_rgba(245,200,76,0.35)]", "shadow-[0_0_16px_rgba(245,200,76,0.55)]", "shadow-[0_0_24px_rgba(245,200,76,0.8)]"];

interface Props {
  s: PublicSuggestion;
  voted: boolean;
  onVote: (id: string) => void;
  featured?: boolean;
  compact?: boolean;
}

export function SuggestionCard({ s, voted, onVote, featured = false, compact = false }: Props) {
  return (
    <div className={`relative rounded-2xl ${featured ? "neon-border p-[1px]" : ""}`}>
      <div className={`glass flex gap-4 rounded-2xl ${compact ? "p-3" : "p-4"} transition-shadow hover:shadow-elevated`}>
        <button
          onClick={() => onVote(s.id)}
          disabled={voted}
          aria-label={`Upvote ${s.title} (${s.vote_count} votes)`}
          className={`flex h-14 w-12 shrink-0 flex-col items-center justify-center rounded-xl border text-sm font-bold transition ${
            voted ? "border-[#f5c84c] bg-gradient-gold text-primary-foreground" : "border-[#f5c84c]/50 text-gold"
          } ${GLOW[glowLevel(s.vote_count)]}`}
        >
          <ChevronUp className="h-4 w-4" />
          {s.vote_count}
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="font-sans text-base font-semibold">{s.title}</h2>
          <div className="mt-1"><StatusProgress status={s.status} /></div>
          {!compact && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{s.description}</p>}
          {s.staff_response && (
            <div className="mt-3 rounded-xl border border-[#f5c84c]/50 bg-[#f5c84c]/[0.06] p-3">
              <p className="mb-1 inline-flex items-center gap-1 text-[11px] font-semibold tracking-wider text-gold">
                <ShieldCheck className="h-3.5 w-3.5" /> Official response
              </p>
              <p className="whitespace-pre-wrap text-sm">{s.staff_response}</p>
            </div>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            {s.category} · {s.author_name} · {formatDistanceToNow(new Date(s.created_at), { addSuffix: true })}
          </p>
        </div>
      </div>
    </div>
  );
}
