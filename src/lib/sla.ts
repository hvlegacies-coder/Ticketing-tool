export type SlaState = "breached" | "due-soon" | "on-track" | "met" | "none";

const DUE_SOON_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export function getSlaState(
  dueAt: string | null,
  isResolvedOrClosed: boolean,
  breachedFlag: boolean
): SlaState {
  if (!dueAt) return "none";
  if (isResolvedOrClosed) return breachedFlag ? "breached" : "met";
  if (breachedFlag) return "breached";

  const remaining = new Date(dueAt).getTime() - Date.now();
  if (remaining < 0) return "breached";
  if (remaining < DUE_SOON_WINDOW_MS) return "due-soon";
  return "on-track";
}

export function formatDuration(ms: number): string {
  const abs = Math.abs(ms);
  const minutes = Math.round(abs / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  return `${days}d`;
}

export function formatDueLabel(dueAt: string): string {
  const diffMs = new Date(dueAt).getTime() - Date.now();
  const label = formatDuration(diffMs);
  return diffMs < 0 ? `Overdue by ${label}` : `Due in ${label}`;
}

export const SLA_STATE_STYLES: Record<SlaState, string> = {
  breached: "bg-urgent/10 text-urgent border-urgent/20",
  "due-soon": "bg-warning/10 text-warning border-warning/20",
  "on-track": "bg-success/10 text-success border-success/20",
  met: "bg-muted text-muted-foreground border-border",
  none: "bg-muted text-muted-foreground border-border",
};

export const SLA_STATE_LABELS: Record<SlaState, string> = {
  breached: "SLA Breached",
  "due-soon": "Due Soon",
  "on-track": "On Track",
  met: "SLA Met",
  none: "No SLA",
};
