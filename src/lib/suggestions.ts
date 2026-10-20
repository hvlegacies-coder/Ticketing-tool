import { z } from "zod";

export const SUGGESTION_CATEGORIES = ["App", "System", "Service", "Other"] as const;
export const SUGGESTION_STATUSES = ["Under review", "Planned", "In progress", "Done", "Declined"] as const;
export type SuggestionStatus = (typeof SUGGESTION_STATUSES)[number];

// Mirrors the CHECK constraints on public.suggestions.
export const suggestionSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(100),
  email: z.string().trim().email("Enter a valid email"),
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(140),
  description: z.string().trim().min(1, "Describe your idea").max(4000),
  category: z.enum(SUGGESTION_CATEGORIES),
});
export type SuggestionInput = z.infer<typeof suggestionSchema>;

export const STATUS_STYLES: Record<SuggestionStatus, string> = {
  "Under review": "border-cyan/50 text-cyan",
  Planned: "border-violet/50 text-violet",
  "In progress": "border-[#f5c84c]/60 text-gold",
  Done: "border-success/50 text-success",
  Declined: "border-muted-foreground/40 text-muted-foreground",
};

export function mapSuggestionError(e: { message?: string }): string {
  if (e.message?.includes("rate_limited")) return "You've posted 5 suggestions today. Please try again tomorrow.";
  return "Couldn't save your suggestion. Please try again.";
}

const VOTER_KEY = "hv-voter-email";

export function getVoterEmail(): string | null {
  try {
    return localStorage.getItem(VOTER_KEY);
  } catch {
    return null;
  }
}

export function setVoterEmail(email: string): void {
  try {
    localStorage.setItem(VOTER_KEY, email);
  } catch {
    // storage blocked: the voter is asked again next time
  }
}
