import { useState } from "react";
import { z } from "zod";
import { FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TicketDraft } from "@/lib/supportChat";

const contactSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(100, "Name is too long"),
  email: z.string().trim().email("Enter a valid email"),
  company: z.string().trim().max(120, "Company name is too long"),
});

/** Short label for the long SLA priority strings ("Moderate (single user…)" → "Moderate"). */
export function priorityLabel(priority: string): string {
  if (priority.startsWith("High impact & high urgency")) return "Critical";
  if (priority.startsWith("High impact or high urgency")) return "High";
  return priority.split(" ")[0];
}

interface Props {
  draft: TicketDraft;
  submitting: boolean;
  onSubmit: (name: string, email: string, company: string) => Promise<void>;
}

/** The ticket the AI prepared; the customer adds contact details and confirms. */
export function TicketDraftCard({ draft, submitting, onSubmit }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    const parsed = contactSchema.safeParse({ name, email, company });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setError(null);
    void onSubmit(parsed.data.name, parsed.data.email, parsed.data.company);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2 rounded-xl border border-violet/50 bg-navy/60 p-3">
      <p className="inline-flex items-center gap-1 text-[11px] font-semibold tracking-wider text-violet">
        <FileText className="h-3.5 w-3.5" /> TICKET READY
      </p>
      <p className="text-sm font-semibold">{draft.title}</p>
      <div className="flex flex-wrap gap-1.5 text-[10px]">
        <span className="rounded-full border border-cyan/40 px-2 py-0.5 text-cyan">{draft.category}</span>
        <span className="rounded-full border border-[#f5c84c]/50 px-2 py-0.5 text-gold">{priorityLabel(draft.priority)}</span>
      </div>
      <p className="line-clamp-3 text-xs text-muted-foreground">{draft.summary}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="ticket-name" className="text-xs">Your name</Label>
          <Input id="ticket-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className="h-8" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ticket-email" className="text-xs">Email</Label>
          <Input id="ticket-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className="h-8" />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="ticket-company" className="text-xs">Company (optional)</Label>
        <Input id="ticket-company" value={company} onChange={(e) => setCompany(e.target.value)} autoComplete="organization" className="h-8" />
      </div>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      <Button type="submit" disabled={submitting} className="h-8 w-full bg-gradient-gold text-primary-foreground glow-gold">
        {submitting ? <><Loader2 className="mr-2 h-3 w-3 animate-spin" />Submitting…</> : "Submit ticket"}
      </Button>
    </form>
  );
}
