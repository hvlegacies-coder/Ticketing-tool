import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { PortalHeader } from "@/components/PortalHeader";
import { HeroSection } from "@/components/HeroSection";
import { FAQSection } from "@/components/FAQSection";
import { SupportChatWidget } from "@/components/SupportChatWidget";
import NotFound from "@/pages/NotFound";
import { supabase } from "@/integrations/supabase/client";

/** Public portal: the AI chat is the way in — it answers, opens tickets, and hands off to agents. */
const SupportPortal = () => {
  const { orgSlug } = useParams<{ orgSlug: string }>();

  const { data: org, isLoading } = useQuery({
    queryKey: ["org-public-profile", orgSlug],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_org_public_profile", { _slug: orgSlug! });
      if (error) throw error;
      return data?.[0] ?? null;
    },
    enabled: !!orgSlug,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center grid-bg">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!org) return <NotFound />;

  return (
    <div className="min-h-screen grid-bg">
      <PortalHeader orgName={org.name} orgLogoUrl={org.logo_url} homeHref={`/support/${orgSlug}`} orgSlug={orgSlug} />
      <HeroSection orgName={org.name} />

      <section id="chat" className="pb-16 pt-8 lg:pb-20">
        <div className="container max-w-3xl">
          <SupportChatWidget organizationId={org.id} orgName={org.name} orgSlug={orgSlug} embedded />
        </div>
      </section>

      <FAQSection />

      <footer className="border-t py-8">
        <div className="container text-center text-sm text-muted-foreground">
          <p>
            © {new Date().getFullYear()} {org.name}. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default SupportPortal;
