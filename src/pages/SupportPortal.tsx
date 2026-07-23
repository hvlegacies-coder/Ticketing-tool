import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { PortalHeader } from "@/components/PortalHeader";
import { HeroSection } from "@/components/HeroSection";
import { TicketForm } from "@/components/TicketForm";
import { FAQSection } from "@/components/FAQSection";
import { SupportChatWidget } from "@/components/SupportChatWidget";
import NotFound from "@/pages/NotFound";
import { supabase } from "@/integrations/supabase/client";

type Message = { role: "user" | "assistant"; content: string };

const SupportPortal = () => {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const [prefillData, setPrefillData] = useState<
    | {
        issue_title: string;
        issue_description: string;
        issue_category: string;
        priority: string;
        related_link: string;
      }
    | undefined
  >();
  const [chatTranscript, setChatTranscript] = useState<Message[] | undefined>();

  const { data: org, isLoading } = useQuery({
    queryKey: ["org-public-profile", orgSlug],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_org_public_profile", { _slug: orgSlug! });
      if (error) throw error;
      return data?.[0] ?? null;
    },
    enabled: !!orgSlug,
  });

  const handleTicketDraft = (
    data: {
      issue_title: string;
      issue_description: string;
      issue_category: string;
      priority: string;
      related_link: string;
    },
    transcript: Message[]
  ) => {
    setPrefillData(data);
    setChatTranscript(transcript);
    document.getElementById("ticket-form")?.scrollIntoView({ behavior: "smooth" });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!org) return <NotFound />;

  return (
    <div className="min-h-screen bg-background">
      <PortalHeader orgName={org.name} orgLogoUrl={org.logo_url} homeHref={`/support/${orgSlug}`} />
      <HeroSection orgName={org.name} />

      <section id="ticket-form" className="py-12 lg:py-16">
        <div className="container max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="rounded-2xl border bg-card p-6 sm:p-8 shadow-elevated transition-shadow hover:shadow-float"
          >
            <div className="mb-6">
              <h2 className="font-display text-2xl font-bold tracking-tight">Submit a Support Ticket</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Fill out the form below and our team will get back to you shortly.
              </p>
              <div className="mt-3 h-0.5 w-12 rounded-full bg-gradient-gold" />
            </div>
            <TicketForm
              organizationId={org.id}
              orgSlug={orgSlug!}
              orgName={org.name}
              prefillData={prefillData}
              chatTranscript={chatTranscript}
            />
          </motion.div>
        </div>
      </section>

      <FAQSection />

      <SupportChatWidget organizationId={org.id} onTicketDraft={handleTicketDraft} />

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
