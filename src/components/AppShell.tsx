import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  LayoutDashboard,
  BarChart3,
  Users,
  MessageSquareText,
  Settings as SettingsIcon,
  LogOut,
  Moon,
  Sun,
  ChevronDown,
  Building2,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization, useMyOrganizations } from "@/hooks/useOrganization";
import { useTheme } from "@/components/ThemeProvider";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS, type OrgRole } from "@/lib/organization";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  allow: OrgRole[];
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { organization, role } = useOrganization();
  const { data: myOrgs } = useMyOrganizations();
  const { theme, setTheme } = useTheme();

  const nav: NavItem[] = [
    { to: `/app/${orgSlug}/dashboard`, label: "Dashboard", icon: LayoutDashboard, allow: ["owner", "admin", "agent", "viewer"] },
    { to: `/app/${orgSlug}/analytics`, label: "Analytics", icon: BarChart3, allow: ["owner", "admin", "agent", "viewer"] },
    { to: `/app/${orgSlug}/canned-responses`, label: "Canned Responses", icon: MessageSquareText, allow: ["owner", "admin", "agent"] },
    { to: `/app/${orgSlug}/team`, label: "Team", icon: Users, allow: ["owner", "admin"] },
    { to: `/app/${orgSlug}/settings`, label: "Settings", icon: SettingsIcon, allow: ["owner", "admin"] },
  ];

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const visibleNav = nav.filter((item) => role && item.allow.includes(role));

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-card md:flex">
        <div className="flex h-16 items-center gap-3 border-b px-5">
          {organization?.logo_url ? (
            <img src={organization.logo_url} alt={organization.name} className="h-8 w-8 rounded-md object-cover" />
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gradient-gold text-sm font-bold text-primary-foreground">
              {organization?.name?.[0]?.toUpperCase() ?? "?"}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-semibold">{organization?.name ?? "Loading…"}</p>
            {role && <p className="text-xs text-muted-foreground">{ROLE_LABELS[role]}</p>}
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {visibleNav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                location.pathname.startsWith(item.to)
                  ? "bg-gradient-gold text-primary-foreground shadow-gold"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="space-y-1 border-t p-3">
          {myOrgs && myOrgs.length > 1 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-between">
                  <span className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Switch org
                  </span>
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>Your organizations</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {myOrgs.map((o) => (
                  <DropdownMenuItem
                    key={o.organization.id}
                    onClick={() => navigate(`/app/${o.organization.slug}/dashboard`)}
                  >
                    {o.organization.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </Button>
          <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-14 items-center justify-between border-b bg-card px-4 md:hidden">
          <span className="font-display font-semibold">{organization?.name}</span>
          <Button variant="ghost" size="icon" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
