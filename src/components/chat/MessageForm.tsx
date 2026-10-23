import { useState } from "react";
import { z } from "zod";
import { Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const messageSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(100, "Name is too long"),
  email: z.string().trim().email("Enter a valid email"),
  message: z.string().trim().min(5, "Tell us a bit more").max(4000, "Message is too long"),
});

interface Props {
  submitting: boolean;
  onSubmit: (name: string, email: string, message: string) => Promise<void>;
}

/** Backup when the AI is off or unreachable, so customers can always reach the team. */
export function MessageForm({ submitting, onSubmit }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    const parsed = messageSchema.safeParse({ name, email, message });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setError(null);
    void onSubmit(parsed.data.name, parsed.data.email, parsed.data.message);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2 rounded-xl border border-cyan/40 bg-navy/60 p-3">
      <p className="inline-flex items-center gap-1 text-xs font-semibold text-cyan">
        <Mail className="h-3.5 w-3.5" /> Send us a message
      </p>
      <p className="text-[11px] text-muted-foreground">We'll create a ticket and reply by email.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="msg-name" className="text-xs">Your name</Label>
          <Input id="msg-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className="h-8" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="msg-email" className="text-xs">Email</Label>
          <Input id="msg-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className="h-8" />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="msg-body" className="text-xs">Message</Label>
        <Textarea id="msg-body" rows={3} maxLength={4000} value={message} onChange={(e) => setMessage(e.target.value)} />
      </div>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      <Button
        type="submit"
        disabled={submitting}
        aria-label="Send message to team"
        className="h-8 w-full bg-gradient-gold text-primary-foreground"
      >
        {submitting ? <><Loader2 className="mr-2 h-3 w-3 animate-spin" />Sending…</> : "Send"}
      </Button>
    </form>
  );
}
