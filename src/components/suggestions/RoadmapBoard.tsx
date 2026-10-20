import { ROADMAP_COLUMNS, groupRoadmap } from "@/lib/suggestions";
import { type PublicSuggestion, SuggestionCard } from "./SuggestionCard";

const COLUMN_ACCENT: Record<(typeof ROADMAP_COLUMNS)[number], string> = {
  Planned: "border-violet/50 text-violet",
  "In progress": "border-[#f5c84c]/60 text-gold",
  Done: "border-success/50 text-success",
};

interface Props {
  rows: PublicSuggestion[];
  voted: Set<string>;
  onVote: (id: string) => void;
}

export function RoadmapBoard({ rows, voted, onVote }: Props) {
  const groups = groupRoadmap(rows);
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {ROADMAP_COLUMNS.map((col) => (
        <section key={col} aria-label={col} className="min-w-0">
          <h2 className={`mb-3 border-b pb-2 font-display text-sm tracking-wider ${COLUMN_ACCENT[col]}`}>
            {col.toUpperCase()} <span className="text-muted-foreground">· {groups[col].length}</span>
          </h2>
          <div className="space-y-3">
            {groups[col].length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing here yet.</p>
            ) : (
              groups[col].map((s) => <SuggestionCard key={s.id} s={s} voted={voted.has(s.id)} onVote={onVote} compact />)
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
