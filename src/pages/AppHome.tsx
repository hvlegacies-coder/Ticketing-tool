import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Building2, ArrowRight, Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useMyOrganizations } from "@/hooks/useOrganization";
import { supabase } from "@/integrations/supabase/client";
import { slugify } from "@/lib/organization";
import { toast } from "sonner";
import logo from "@/assets/logo.png";

const AppHome = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { data: orgs, isLoading, invalidate } = useMyOrganizations();
  const [orgName, setOrgName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (orgs && orgs.length === 1) {
      navigate(`/app/${orgs[0].organization.slug}/dashboard`, { replace: true });
    }
  }, [orgs, navigate]);

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim() || !user) return;
    setSubmitting(true);

    try {
      let slug = slugify(orgName);
      let lastError: { code?: string; message: string } | null = null;

      for (let attempt = 0; attempt < 5; attempt++) {
        const { data, error } = await supabase
          .from("organizations")
          .insert({ name: orgName.trim(), slug, owner_id: user.id })
          .select()
          .single();

        if (!error && data) {
          toast.success("Organization created!");
          invalidate();
          navigate(`/app/${data.slug}/dashboard`);
          return;
        }

        lastError = error;
        if (error?.code === "23505") {
          slug = `${slugify(orgName)}-${Math.random().toString(36).slice(2, 6)}`;
          continue;
        }
        break;
      }

      throw new Error(lastError?.message || "Failed to create organization");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create organization");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/80 backdrop-blur-md">
        <div className="container flex h-16 items-center justify-between">
          <img src={logo} alt="Client Connect" className="h-9" />
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        </div>
      </header>

      <div className="container max-w-2xl py-16">
        {orgs && orgs.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
            <h2 className="font-display text-xl font-bold">Your organizations</h2>
            <div className="mt-4 space-y-3">
              {orgs.map((o) => (
                <button
                  key={o.organization.id}
                  onClick={() => navigate(`/app/${o.organization.slug}/dashboard`)}
                  className="flex w-full items-center justify-between rounded-xl border bg-card p-4 text-left shadow-card transition-shadow hover:shadow-elevated"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-gold font-display font-bold text-primary-foreground">
                      {o.organization.name[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium">{o.organization.name}</p>
                      <p className="text-xs capitalize text-muted-foreground">{o.role}</p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl border bg-card p-8 shadow-elevated"
        >
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gold/10">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold">
                {orgs && orgs.length > 0 ? "Create another organization" : "Create your organization"}
              </h2>
              <p className="text-sm text-muted-foreground">This becomes your team's dedicated support desk.</p>
            </div>
          </div>

          <form onSubmit={handleCreateOrg} className="flex gap-3">
            <div className="flex-1 space-y-2">
              <Label htmlFor="orgName" className="sr-only">
                Organization name
              </Label>
              <Input
                id="orgName"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="Acme Inc."
                required
                className="transition-shadow focus-visible:shadow-gold"
              />
            </div>
            <Button type="submit" disabled={submitting} className="bg-gradient-gold hover:opacity-90">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
            </Button>
          </form>
        </motion.div>
      </div>
    </div>
  );
};

export default AppHome;
