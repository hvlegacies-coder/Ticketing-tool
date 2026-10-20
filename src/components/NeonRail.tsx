import { Link } from "react-router-dom";
import { LogOut } from "lucide-react";
import { initials } from "@/lib/organization";
import type { NavSection } from "@/lib/navigation";

interface NeonRailProps {
  sections: NavSection[];
  activePath: string;
  orgName?: string;
  orgLogoUrl?: string | null;
  roleLabel?: string;
  userLabel?: string;
  onSignOut: () => void;
  /** Org switcher (dropdown) rendered inside the org card when the user has several orgs. */
  orgSwitcher?: React.ReactNode;
  onNavigate?: () => void;
}

/** Command Center sidebar: org card, grouped nav with live badges, profile card. */
export function NeonRail({
  sections,
  activePath,
  orgName,
  orgLogoUrl,
  roleLabel,
  userLabel,
  onSignOut,
  orgSwitcher,
  onNavigate,
}: NeonRailProps) {
  return (
    <div className="flex h-full flex-col px-3 py-4">
      <div className="flex items-center gap-3 rounded-xl border border-cyan/20 bg-card/70 p-2.5">
        {orgLogoUrl ? (
          <img src={orgLogoUrl} alt="" className="h-9 w-9 rounded-lg object-cover" />
        ) : (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-gold font-bold text-primary-foreground shadow-gold">
            {orgName?.[0]?.toUpperCase() ?? "?"}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{orgName ?? "Loading…"}</p>
          {roleLabel && <p className="text-[11px] text-muted-foreground">{roleLabel}</p>}
        </div>
        {orgSwitcher}
      </div>

      <nav className="mt-2 flex-1 overflow-y-auto" aria-label="Main">
        {sections.map((section) => (
          <div key={section.title}>
            <p className="mb-1 mt-4 px-2 text-[9px] font-semibold tracking-[0.2em] text-muted-foreground/70">{section.title}</p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = activePath.startsWith(item.to);
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      aria-label={item.badge ? `${item.label}, ${item.badge} new` : undefined}
                      className={`relative flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors ${
                        active
                          ? "bg-gradient-to-r from-cyan/15 to-violet/5 text-foreground shadow-[inset_0_0_0_1px_hsl(var(--cyan)/0.3)]"
                          : "text-muted-foreground hover:bg-cyan/[0.06] hover:text-foreground"
                      }`}
                    >
                      {active && (
                        <span
                          aria-hidden
                          className="absolute -left-3 bottom-1.5 top-1.5 w-[3px] rounded-r bg-gradient-to-b from-cyan to-violet shadow-[0_0_8px_hsl(var(--cyan))]"
                        />
                      )}
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${
                          active
                            ? "bg-gradient-to-br from-cyan to-violet text-navy shadow-[0_0_10px_hsl(var(--cyan)/0.6)]"
                            : "bg-muted/60"
                        }`}
                      >
                        <item.icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.badge !== undefined && (
                        <span
                          aria-hidden
                          className={`min-w-[18px] rounded-full px-1.5 text-center font-numeric text-[10px] font-semibold leading-[18px] ${
                            item.tone === "gold" ? "bg-gradient-gold text-primary-foreground shadow-gold" : "bg-cyan/15 text-cyan"
                          }`}
                        >
                          {item.badge > 99 ? "99+" : item.badge}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="mt-3 flex items-center gap-2.5 rounded-xl border border-border/60 bg-card/70 p-2.5">
        <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-gold text-[11px] font-semibold text-primary-foreground">
          {initials(userLabel ?? "?")}
          <span
            aria-hidden
            className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-green-500 shadow-[0_0_6px_#22c55e]"
          />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium">{userLabel}</p>
          <p className="text-[10px] text-green-400">Online</p>
        </div>
        <button
          onClick={onSignOut}
          aria-label="Sign out"
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
