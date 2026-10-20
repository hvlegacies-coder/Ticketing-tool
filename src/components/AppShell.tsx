import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronsUpDown, Menu } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization, useMyOrganizations } from "@/hooks/useOrganization";
import { useStaffNotifications } from "@/hooks/useStaffNotifications";
import { useSuggestionsBadge } from "@/hooks/useSuggestionsBadge";
import { NeonRail } from "@/components/NeonRail";
import { NotificationBell } from "@/components/NotificationBell";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { buildNavSections } from "@/lib/navigation";
import { ROLE_LABELS } from "@/lib/organization";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { organization, role } = useOrganization();
  const { data: myOrgs } = useMyOrganizations();
  const reduceMotion = useReducedMotion();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // The shell owns the single realtime subscription for staff notifications.
  const { items } = useStaffNotifications(organization?.id, { live: true });
  const suggestions = useSuggestionsBadge(organization?.id);
  const sections = buildNavSections(role, orgSlug, {
    waiting: items.filter((n) => n.kind === "agent_requested").length,
    unread: items.filter((n) => n.kind === "client_message").length,
    suggestions,
  });

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const orgSwitcher =
    myOrgs && myOrgs.length > 1 ? (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Switch organization">
            <ChevronsUpDown className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>Your organizations</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {myOrgs.map((o) => (
            <DropdownMenuItem key={o.organization.id} onClick={() => navigate(`/app/${o.organization.slug}/dashboard`)}>
              {o.organization.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    ) : null;

  const rail = (onNavigate?: () => void) => (
    <NeonRail
      sections={sections}
      activePath={location.pathname}
      orgName={organization?.name}
      orgLogoUrl={organization?.logo_url}
      roleLabel={role ? ROLE_LABELS[role] : undefined}
      userLabel={(user?.user_metadata?.full_name as string | undefined) ?? user?.email}
      onSignOut={handleSignOut}
      orgSwitcher={orgSwitcher}
      onNavigate={onNavigate}
    />
  );

  return (
    <div className="flex min-h-screen grid-bg">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-cyan/20 bg-navy/85 backdrop-blur md:block">
        {rail()}
      </aside>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="left" className="w-72 border-cyan/20 bg-navy/95 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          {rail(() => setDrawerOpen(false))}
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-cyan/15 bg-navy/70 px-4 backdrop-blur">
          <div className="flex items-center gap-2 md:invisible">
            <Button variant="ghost" size="icon" onClick={() => setDrawerOpen(true)} aria-label="Open navigation">
              <Menu className="h-5 w-5" />
            </Button>
            <span className="font-display text-sm font-semibold">{organization?.name}</span>
          </div>
          <NotificationBell items={items} orgSlug={orgSlug} />
        </header>
        <motion.main
          key={location.pathname}
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="flex-1"
        >
          {children}
        </motion.main>
      </div>
    </div>
  );
}
