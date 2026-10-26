import { cn } from "@/lib/utils";
import { priorityLabel } from "@/lib/ticketActions";

interface StatusBadgeProps {
  value: string;
  type?: "status" | "priority" | "sync";
  className?: string;
}

const statusStyles: Record<string, string> = {
  // Ticket status
  "New": "bg-info/10 text-info border-info/20",
  "Open": "bg-info/10 text-info border-info/20",
  "In Progress": "bg-warning/10 text-warning border-warning/20",
  "Processing": "bg-info/10 text-info border-info/20",
  "Resolved": "bg-success/10 text-success border-success/20",
  "Closed": "bg-muted text-muted-foreground border-border",

  // Priority
  "Low": "bg-muted text-muted-foreground border-border",
  "Medium": "bg-info/10 text-info border-info/20",
  "High": "bg-warning/10 text-warning border-warning/20",
  "Urgent": "bg-urgent/10 text-urgent border-urgent/20",
  "Critical": "bg-urgent/10 text-urgent border-urgent/20",
  "Moderate": "bg-info/10 text-info border-info/20",

  // Sync status
  "pending": "bg-warning/10 text-warning border-warning/20",
  "synced": "bg-success/10 text-success border-success/20",
  "failed": "bg-urgent/10 text-urgent border-urgent/20",
};

export function StatusBadge({ value, type, className }: StatusBadgeProps) {
  // Priorities are stored as long SLA strings; show the short word.
  const label = type === "priority" ? priorityLabel(value) : value;
  const style = statusStyles[label] || "bg-muted text-muted-foreground border-border";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize",
        style,
        className
      )}
    >
      {label}
    </span>
  );
}
