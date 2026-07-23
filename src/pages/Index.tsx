import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Ticket,
  Timer,
  BarChart3,
  Users,
  Tag,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  MessageCircle,
  Check,
} from "lucide-react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";

const FEATURES = [
  {
    icon: Ticket,
    title: "Unified ticket queue",
    desc: "Every request from your web form and AI chat assistant lands in one organized, searchable queue.",
  },
  {
    icon: Timer,
    title: "SLA tracking & alerts",
    desc: "Set response and resolution targets per priority. Breaches are flagged automatically — no spreadsheets.",
  },
  {
    icon: BarChart3,
    title: "Analytics that matter",
    desc: "Volume trends, resolution time, SLA compliance, and agent performance in one dashboard.",
  },
  {
    icon: Users,
    title: "Team roles & assignment",
    desc: "Invite agents with owner, admin, agent, or viewer roles. Assign tickets and track workload.",
  },
  {
    icon: Tag,
    title: "Tags & canned responses",
    desc: "Organize tickets with custom tags and reply faster with saved response templates.",
  },
  {
    icon: ShieldCheck,
    title: "Secure by design",
    desc: "Row-level tenant isolation, token-gated client links, and a full audit trail on every ticket.",
  },
];

const PLANS = [
  {
    name: "Starter",
    price: "Free",
    desc: "For small teams getting started",
    features: ["Up to 2 agents", "Unlimited tickets", "Email notifications", "Basic analytics"],
  },
  {
    name: "Pro",
    price: "$49/mo",
    desc: "For growing support teams",
    features: ["Unlimited agents", "SLA policies & alerts", "Canned responses", "Full analytics suite"],
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "Talk to us",
    desc: "For larger organizations",
    features: ["Custom integrations", "Dedicated support", "Advanced audit logs", "SSO (coming soon)"],
  },
];

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-hero py-28 lg:py-36">
        <div className="absolute inset-0 opacity-[0.07]">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)",
              backgroundSize: "48px 48px",
            }}
          />
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold-light/30 to-transparent" />

        <div className="container relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="mx-auto max-w-3xl text-center"
          >
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-gold-light/20 bg-gold/10 px-4 py-1.5 text-sm font-medium text-primary-foreground/90 dark:text-gold-light">
              <Sparkles className="h-3.5 w-3.5" />
              Support desk CRM for growing teams
            </div>
            <h1 className="font-display text-4xl font-bold tracking-tight text-primary-foreground dark:text-foreground sm:text-5xl lg:text-6xl leading-tight">
              Support tickets, <span className="italic">handled</span> like a real business.
            </h1>
            <p className="mt-5 text-lg text-primary-foreground/75 dark:text-muted-foreground">
              Client Connect gives your team a branded support portal, an AI intake assistant, SLA tracking, and
              analytics — all scoped securely to your organization.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button size="lg" asChild className="bg-gradient-gold hover:opacity-90 transition-opacity">
                <Link to="/signup">
                  Start free <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 dark:border-border dark:text-foreground">
                <Link to="/login">Sign in</Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 lg:py-24">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mx-auto mb-14 max-w-2xl text-center"
          >
            <h2 className="font-display text-3xl font-bold tracking-tight">Everything a support team needs</h2>
            <p className="mt-3 text-muted-foreground">
              Built for real businesses running a real help desk — not a toy contact form.
            </p>
            <div className="mt-4 mx-auto h-0.5 w-12 rounded-full bg-gradient-gold" />
          </motion.div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                whileHover={{ y: -3 }}
                className="rounded-xl border bg-card p-6 shadow-card transition-shadow hover:shadow-elevated"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-gold/10">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-display font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* AI assistant callout */}
      <section className="border-y bg-muted/30 py-16">
        <div className="container flex flex-col items-center gap-6 text-center lg:flex-row lg:text-left">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-gold shadow-gold">
            <MessageCircle className="h-7 w-7 text-primary-foreground" />
          </div>
          <div>
            <h3 className="font-display text-xl font-bold">An AI assistant that triages before you do</h3>
            <p className="mt-1 text-muted-foreground">
              Clients chat with a branded assistant that gathers the details your team needs, then hands off a
              fully-drafted ticket — cutting back-and-forth before an agent ever gets involved.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 lg:py-24">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mx-auto mb-14 max-w-2xl text-center"
          >
            <h2 className="font-display text-3xl font-bold tracking-tight">Simple, honest pricing</h2>
            <p className="mt-3 text-muted-foreground">Start free. Upgrade when your team grows.</p>
            <div className="mt-4 mx-auto h-0.5 w-12 rounded-full bg-gradient-gold" />
          </motion.div>

          <div className="mx-auto grid max-w-4xl gap-6 sm:grid-cols-3">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl border p-6 shadow-card transition-shadow hover:shadow-elevated ${
                  plan.highlighted ? "border-primary bg-card ring-1 ring-primary/30" : "bg-card"
                }`}
              >
                <h3 className="font-display font-semibold">{plan.name}</h3>
                <p className="mt-2 font-display text-2xl font-bold">{plan.price}</p>
                <p className="mt-1 text-xs text-muted-foreground">{plan.desc}</p>
                <ul className="mt-5 space-y-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                      <span className="text-muted-foreground">{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  asChild
                  className={`mt-6 w-full ${plan.highlighted ? "bg-gradient-gold hover:opacity-90" : ""}`}
                  variant={plan.highlighted ? "default" : "outline"}
                >
                  <Link to="/signup">Get started</Link>
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t py-8">
        <div className="container text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} Client Connect. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
