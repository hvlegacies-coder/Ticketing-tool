import { motion } from "framer-motion";
import { Shield, MessageCircle, Clock } from "lucide-react";

interface HeroSectionProps {
  orgName?: string;
}

export function HeroSection({ orgName }: HeroSectionProps) {
  return (
    <section className="relative overflow-hidden bg-gradient-hero py-28 lg:py-36">
      {/* Subtle gold pattern overlay */}
      <div className="absolute inset-0 opacity-[0.07]">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)",
            backgroundSize: "48px 48px",
          }}
        />
      </div>

      {/* Gold accent line */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold-light/30 to-transparent" />

      <div className="container relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="mx-auto max-w-3xl text-center"
        >
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-gold-light/20 bg-gold/10 px-4 py-1.5 text-sm font-medium text-primary-foreground/90 dark:text-gold-light">
            <Shield className="h-3.5 w-3.5" />
            {orgName ? `${orgName} Support Portal` : "Enterprise Support Portal"}
          </div>
          <h1 className="font-display text-4xl font-bold tracking-tight text-primary-foreground dark:text-foreground sm:text-5xl lg:text-6xl leading-tight">
            How can we <span className="italic">assist</span>&nbsp;you?
          </h1>
          <p className="mt-5 text-lg text-primary-foreground/75 dark:text-muted-foreground">
            Submit a support ticket and our team will respond promptly.
            You can also chat with our AI assistant for instant guidance.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="mx-auto mt-14 grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3"
        >
          {[
            {
              icon: Shield,
              label: "Submit a Ticket",
              desc: "Describe your issue in detail",
            },
            {
              icon: MessageCircle,
              label: "Chat with AI",
              desc: "Get instant assistance",
            },
            {
              icon: Clock,
              label: "Fast Response",
              desc: "Under 2 hours SLA",
            },
          ].map((item) => (
            <motion.div
              key={item.label}
              whileHover={{ y: -4, scale: 1.02 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
              className="group flex flex-col items-center gap-2.5 rounded-xl border border-primary-foreground/10 dark:border-border bg-primary-foreground/5 dark:bg-card/50 p-6 backdrop-blur-sm cursor-default transition-colors hover:border-primary-foreground/20 dark:hover:border-gold/30"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary-foreground/10 dark:bg-gold/10 transition-colors group-hover:bg-primary-foreground/15 dark:group-hover:bg-gold/20">
                <item.icon className="h-5 w-5 text-primary-foreground dark:text-gold" />
              </div>
              <span className="font-display font-semibold text-primary-foreground dark:text-foreground">
                {item.label}
              </span>
              <span className="text-sm text-primary-foreground/60 dark:text-muted-foreground">
                {item.desc}
              </span>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
