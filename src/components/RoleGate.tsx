import { useOrganization } from "@/hooks/useOrganization";
import type { OrgRole } from "@/lib/organization";

interface RoleGateProps {
  allow: OrgRole[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function RoleGate({ allow, children, fallback = null }: RoleGateProps) {
  const { role } = useOrganization();
  if (!role || !allow.includes(role)) return <>{fallback}</>;
  return <>{children}</>;
}
