import { Link } from "react-router-dom";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/ThemeProvider";

interface PortalHeaderProps {
  orgName?: string;
  orgLogoUrl?: string | null;
  homeHref?: string;
}

/** Org-branded header for the public ticket portal (support form, chat, ticket status). */
export function PortalHeader({ orgName, orgLogoUrl, homeHref = "/" }: PortalHeaderProps) {
  const { theme, setTheme } = useTheme();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-card/80 backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between">
        <Link to={homeHref} className="flex items-center gap-3 group">
          {orgLogoUrl ? (
            <img
              src={orgLogoUrl}
              alt={orgName}
              className="h-9 w-9 rounded-md object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-gradient-gold font-display font-bold text-primary-foreground">
              {orgName?.[0]?.toUpperCase() ?? "?"}
            </div>
          )}
          <span className="font-display font-semibold tracking-tight">{orgName ?? "Support"}</span>
        </Link>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="hover:bg-accent transition-colors"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </div>
    </header>
  );
}
