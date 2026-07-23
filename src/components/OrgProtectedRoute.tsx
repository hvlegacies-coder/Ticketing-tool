import { useEffect } from "react";
import { Navigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useOrganization } from "@/hooks/useOrganization";
import type { OrgRole } from "@/lib/organization";

interface OrgProtectedRouteProps {
  children: React.ReactNode;
  /** Roles allowed to view this route. Omit to allow any member of the org. */
  allow?: OrgRole[];
}

export function OrgProtectedRoute({ children, allow }: OrgProtectedRouteProps) {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const { organization, role, isLoading, error } = useOrganization();

  const forbidden = !isLoading && !!organization && !!role && !!allow && !allow.includes(role);
  const notAMember = !isLoading && !!organization && !role;

  useEffect(() => {
    if (forbidden) toast.error("You don't have permission to view this page.");
    if (notAMember) toast.error("You don't have access to this organization.");
  }, [forbidden, notAMember]);

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !organization) {
    return <Navigate to="/app" replace />;
  }

  if (!role) {
    return <Navigate to="/app" replace />;
  }

  if (allow && !allow.includes(role)) {
    return <Navigate to={`/app/${orgSlug}/dashboard`} replace />;
  }

  return <>{children}</>;
}
