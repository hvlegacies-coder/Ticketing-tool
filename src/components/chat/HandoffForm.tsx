import { useState } from "react";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const handoffSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(100, "Name is too long"),
  email: z.string().trim().email("Enter a valid email"),
});

interface HandoffFormProps {
  onSubmit: (name: string, email: string) => Promise<void>;
  submitting: boolean;
}

export function HandoffForm({ onSubmit, submitting }: HandoffFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    const parsed = handoffSchema.safeParse({ name, email });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setError(null);
    void onSubmit(parsed.data.name, parsed.data.email);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2 rounded-xl border border-[#f5c84c]/40 bg-navy/60 p-3">
      <p className="text-xs font-medium text-gold">Connect with a team member</p>
      <div className="space-y-1">
        <Label htmlFor="handoff-name" className="text-xs">Your name</Label>
        <Input id="handoff-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className="h-8" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="handoff-email" className="text-xs">Email</Label>
        <Input id="handoff-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className="h-8" />
      </div>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      <Button type="submit" disabled={submitting} className="h-8 w-full bg-gradient-gold text-primary-foreground glow-gold">
        {submitting ? <><Loader2 className="mr-2 h-3 w-3 animate-spin" />Connecting…</> : "Connect me"}
      </Button>
    </form>
  );
}
