import { createContext, useContext, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Tables } from "@/integrations/supabase/types";
import type { OrgRole } from "@/lib/organization";

interface OrganizationContextValue {
  organization: Tables<"organizations"> | null;
  role: OrgRole | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

const OrganizationContext = createContext<OrganizationContextValue | undefined>(undefined);

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const { user, loading: authLoading } = useAuth();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["organization-context", orgSlug, user?.id],
    queryFn: async () => {
      const { data: org, error: orgError } = await supabase
        .from("organizations")
        .select("*")
        .eq("slug", orgSlug!)
        .single();
      if (orgError) throw orgError;

      const { data: member, error: memberError } = await supabase
        .from("organization_members")
        .select("role")
        .eq("organization_id", org.id)
        .eq("user_id", user!.id)
        .maybeSingle();
      if (memberError) throw memberError;

      return { organization: org, role: (member?.role as OrgRole) ?? null };
    },
    enabled: !!orgSlug && !!user && !authLoading,
    retry: false,
  });

  const value = useMemo<OrganizationContextValue>(
    () => ({
      organization: data?.organization ?? null,
      role: data?.role ?? null,
      isLoading: authLoading || isLoading,
      error: error as Error | null,
      refetch,
    }),
    [data, isLoading, authLoading, error, refetch]
  );

  return <OrganizationContext.Provider value={value}>{children}</OrganizationContext.Provider>;
}

export function useOrganization() {
  const ctx = useContext(OrganizationContext);
  if (!ctx) throw new Error("useOrganization must be used within an OrganizationProvider");
  return ctx;
}

export interface MyOrganization {
  role: OrgRole;
  organization: Tables<"organizations">;
}

export function useMyOrganizations() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["my-organizations", user?.id],
    queryFn: async (): Promise<MyOrganization[]> => {
      const { data, error } = await supabase
        .from("organization_members")
        .select("role, organizations(*)")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? [])
        .filter((row) => row.organizations)
        .map((row) => ({
          role: row.role as OrgRole,
          organization: row.organizations as unknown as Tables<"organizations">,
        }));
    },
    enabled: !!user,
  });

  return {
    ...query,
    invalidate: () => queryClient.invalidateQueries({ queryKey: ["my-organizations", user?.id] }),
  };
}
