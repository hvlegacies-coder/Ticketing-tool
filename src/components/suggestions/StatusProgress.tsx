import { STATUS_STYLES, type SuggestionStatus, statusStep } from "@/lib/suggestions";

const STEPS = 4;

/** Status as a 4-segment progress bar (Under review → Done); Declined is muted and struck through. */
export function StatusProgress({ status }: { status: string }) {
  const step = statusStep(status);
  const declined = status === "Declined";
  return (
    <div className="inline-flex items-center gap-2">
      <div className="flex gap-0.5" aria-hidden>
        {Array.from({ length: STEPS }, (_, i) => (
          <span
            key={i}
            className={`h-1.5 w-4 rounded-full ${
              declined ? "bg-muted-foreground/30" : i < step ? "bg-gradient-neon shadow-[0_0_6px_hsl(var(--cyan)/0.6)]" : "bg-muted"
            }`}
          />
        ))}
      </div>
      <span className={`text-xs ${STATUS_STYLES[status as SuggestionStatus] ?? ""} ${declined ? "line-through" : ""}`}>
        {status}
      </span>
    </div>
  );
}
