import { useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { normalizeTicketRef } from "@/lib/tracking";

interface Props {
  checking: boolean;
  onLookup: (input: string) => Promise<void>;
}

/** Ticket-number lookup for status only; details stay behind the emailed chat link. */
export function TrackTicketCard({ checking, onLookup }: Props) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (checking) return;
    if (!normalizeTicketRef(value)) {
      setError("Enter the 8 characters from your confirmation email, e.g. 1A2B3C4D.");
      return;
    }
    setError(null);
    void onLookup(value);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border-2 border-[#f5c84c]/60 bg-navy/60 p-4">
      <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-cyan">
        <Search className="h-3.5 w-3.5" /> Track a ticket
      </p>
      <div className="space-y-1">
        <Label htmlFor="track-ref" className="text-sm font-semibold">Ticket number</Label>
        <Input
          id="track-ref"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. 1A2B3C4D"
          maxLength={12}
          autoComplete="off"
          className="h-12 text-center font-numeric text-xl uppercase tracking-[0.25em]"
        />
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={checking} className="h-11 w-full bg-gradient-gold text-base font-semibold text-primary-foreground">
        {checking ? <><Loader2 className="mr-2 h-3 w-3 animate-spin" />Checking…</> : "Check status"}
      </Button>
    </form>
  );
}
