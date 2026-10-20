import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Visible suggestions still "Under review" — the sidebar badge. 0 on any error. */
export function useSuggestionsBadge(orgId: string | undefined): number {
  const { data = 0 } = useQuery({
    queryKey: ["suggestions-badge", orgId],
    enabled: !!orgId,
    refetchInterval: 60_000,
    retry: false,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("suggestions")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId!)
        .eq("status", "Under review")
        .eq("is_hidden", false);
      if (error) return 0;
      return count ?? 0;
    },
  });
  return data;
}
