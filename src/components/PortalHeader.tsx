import { Link, NavLink } from "react-router-dom";
import { Lightbulb, LifeBuoy } from "lucide-react";

interface PortalHeaderProps {
  orgName?: string;
  orgLogoUrl?: string | null;
  homeHref?: string;
  /** When set, shows links to the org's ticket portal and suggestions board. */
  orgSlug?: string;
}

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors ${
    isActive ? "bg-cyan/10 text-cyan" : "text-muted-foreground hover:text-foreground"
  }`;

/** Org-branded header for the public ticket portal (support form, chat, ticket status, suggestions). */
export function PortalHeader({ orgName, orgLogoUrl, homeHref = "/", orgSlug }: PortalHeaderProps) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-cyan/20 bg-navy/80 backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between gap-2">
        <Link to={homeHref} className="group flex min-w-0 items-center gap-3">
          {orgLogoUrl ? (
            <img
              src={orgLogoUrl}
              alt={orgName}
              className="h-9 w-9 rounded-md object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-gradient-gold font-display font-bold text-primary-foreground shadow-gold">
              {orgName?.[0]?.toUpperCase() ?? "?"}
            </div>
          )}
          <span className="truncate font-display font-semibold tracking-tight">{orgName ?? "Support"}</span>
        </Link>

        {orgSlug && (
          <nav className="flex items-center gap-1">
            <NavLink to={`/support/${orgSlug}`} end className={linkClass}>
              <LifeBuoy className="h-4 w-4" />
              <span className="hidden sm:inline">Support</span>
            </NavLink>
            <NavLink to={`/support/${orgSlug}/suggestions`} className={linkClass}>
              <Lightbulb className="h-4 w-4" />
              <span className="hidden sm:inline">Suggestions</span>
            </NavLink>
          </nav>
        )}
      </div>
    </header>
  );
}
