import {
  BarChart3,
  LayoutDashboard,
  Lightbulb,
  MessageSquareText,
  MessagesSquare,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { OrgRole } from "@/lib/organization";

export type NavBadges = { waiting: number; unread: number; suggestions: number };
export type NavItem = { to: string; label: string; icon: LucideIcon; badge?: number; tone?: "gold" | "cyan" };
export type NavSection = { title: string; items: NavItem[] };

const ALL: OrgRole[] = ["owner", "admin", "agent", "viewer"];
const AGENTS: OrgRole[] = ["owner", "admin", "agent"];
const ADMINS: OrgRole[] = ["owner", "admin"];

type Def = { path: string; label: string; icon: LucideIcon; allow: OrgRole[]; badge?: keyof NavBadges; tone?: "gold" | "cyan" };

const SECTIONS: { title: string; items: Def[] }[] = [
  {
    title: "WORKSPACE",
    items: [
      { path: "dashboard", label: "Dashboard", icon: LayoutDashboard, allow: ALL, badge: "waiting", tone: "gold" },
      { path: "live-chats", label: "Live chats", icon: MessagesSquare, allow: AGENTS, badge: "unread", tone: "cyan" },
      { path: "analytics", label: "Analytics", icon: BarChart3, allow: ALL },
    ],
  },
  {
    title: "CUSTOMERS",
    items: [
      { path: "suggestions", label: "Suggestions", icon: Lightbulb, allow: ALL, badge: "suggestions", tone: "cyan" },
      { path: "canned-responses", label: "Canned responses", icon: MessageSquareText, allow: AGENTS },
    ],
  },
  {
    title: "ADMIN",
    items: [
      { path: "team", label: "Team", icon: Users, allow: ADMINS },
      { path: "settings", label: "Settings", icon: Settings, allow: ADMINS },
    ],
  },
];

/** Sidebar groups visible to this role, with live badge counts (zero badges omitted). */
export function buildNavSections(role: OrgRole | null, orgSlug: string | undefined, badges: NavBadges): NavSection[] {
  if (!role) return [];
  return SECTIONS.map((section) => ({
    title: section.title,
    items: section.items
      .filter((d) => d.allow.includes(role))
      .map((d) => {
        const count = d.badge ? badges[d.badge] : 0;
        return {
          to: `/app/${orgSlug}/${d.path}`,
          label: d.label,
          icon: d.icon,
          ...(count > 0 ? { badge: count, tone: d.tone } : {}),
        };
      }),
  })).filter((s) => s.items.length > 0);
}
