import { z } from "zod";

export const SUGGESTION_CATEGORIES = ["App", "System", "Service", "Other"] as const;
export const SUGGESTION_STATUSES = ["Under review", "Planned", "In progress", "Done", "Declined"] as const;
export type SuggestionStatus = (typeof SUGGESTION_STATUSES)[number];

/** Ready-made official responses, picked in the admin note box after a status change. */
export const STATUS_TEMPLATES: Record<SuggestionStatus, string[]> = {
  "Under review": [
    "Thanks for sharing this idea! Our team is reviewing it now, and we'll update you as soon as we've decided.",
    "Great suggestion! We're looking into how this could work for everyone. Keep the votes coming, they help us decide what to build first.",
  ],
  Planned: [
    "Good news! We've added this to our plans. We'll let you know when work begins.",
    "Thanks to everyone who voted. This is planned for an upcoming update.",
  ],
  "In progress": [
    "We're working on this right now! We'll let you know as soon as it's ready.",
    "Work has started on this idea. Thanks for your patience while we build and test it.",
  ],
  Done: [
    "This is now live! Thanks for the great idea. Try it out and let us know what you think.",
    "Done! This has been added. We appreciate you helping us make our apps better.",
  ],
  Declined: [
    "Thank you for the suggestion. After review, we've decided not to move forward with this right now, but we appreciate you sharing it.",
    "Thanks for the idea! This doesn't fit our current plans, but we'll keep it in mind for the future.",
  ],
};

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

export const ROADMAP_COLUMNS = ["Planned", "In progress", "Done"] as const;
type RoadmapColumn = (typeof ROADMAP_COLUMNS)[number];

export function groupRoadmap<T extends { status: string }>(rows: T[]): Record<RoadmapColumn, T[]> {
  const groups: Record<RoadmapColumn, T[]> = { Planned: [], "In progress": [], Done: [] };
  for (const r of rows) {
    if ((ROADMAP_COLUMNS as readonly string[]).includes(r.status)) groups[r.status as RoadmapColumn].push(r);
  }
  return groups;
}

/** Vote-button glow intensity: 0 (<5), 1 (5-19), 2 (20-49), 3 (50+). */
export function glowLevel(votes: number): 0 | 1 | 2 | 3 {
  if (votes >= 50) return 3;
  if (votes >= 20) return 2;
  if (votes >= 5) return 1;
  return 0;
}

/** Progress-bar step: Under review 1 … Done 4 (of 4); Declined 0. */
export function statusStep(status: string): number {
  return status === "Declined" ? 0 : SUGGESTION_STATUSES.indexOf(status as SuggestionStatus) + 1;
}
