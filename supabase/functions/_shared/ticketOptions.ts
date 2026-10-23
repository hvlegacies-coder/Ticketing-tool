// Mirrors src/lib/mondayConfig.ts (kept in sync by ticketOptions.test.ts).
// SLA policies are keyed on these exact priority strings.
export const TICKET_CATEGORIES = [
  "Incident (something is broken)",
  "Service Request (access/software/hardware)",
  "Password/Account",
  "Network/Connectivity",
  "Email/Collaboration",
  "Hardware",
  "Software/Application",
  "Other",
] as const;

export const TICKET_PRIORITIES = [
  "High impact & high urgency (critical outage or many users blocked)",
  "High impact or high urgency (major function degraded or deadline risk)",
  "Moderate (single user or workaround available)",
  "Low (minor issue or general inquiry)",
] as const;

export const DEFAULT_PRIORITY = TICKET_PRIORITIES[2];
