export type OrgRole = "owner" | "admin" | "agent" | "viewer";

export const ORG_ROLES: OrgRole[] = ["owner", "admin", "agent", "viewer"];

export const ROLE_LABELS: Record<OrgRole, string> = {
  owner: "Owner",
  admin: "Admin",
  agent: "Agent",
  viewer: "Viewer",
};

export const ROLE_DESCRIPTIONS: Record<OrgRole, string> = {
  owner: "Full control, including billing and deleting the organization.",
  admin: "Manage team members, settings, and all tickets.",
  agent: "Handle tickets: reply, assign, tag, and resolve.",
  viewer: "Read-only access to tickets and analytics.",
};

export function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .trim()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "")
    .slice(0, 48);
  return base || "org";
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}
