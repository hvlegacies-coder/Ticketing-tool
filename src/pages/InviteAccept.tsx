import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ROLE_LABELS, type OrgRole } from "@/lib/organization";
import logo from "@/assets/logo.png";

type Preview = {
  organization_name: string;
  email: string;
  role: string;
  expires_at: string;
  accepted_at: string | null;
};

const InviteAccept = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    supabase
      .rpc("get_invitation_preview", { _token: token })
      .then(({ data, error }) => {
        if (!error && data && data.length > 0) setPreview(data[0] as Preview);
        setLoadingPreview(false);
      });
  }, [token]);

  useEffect(() => {
    if (!token || !user || authLoading || !preview || preview.accepted_at) return;
    setAccepting(true);
    supabase
      .rpc("accept_invitation", { _token: token })
      .then(({ error }) => {
        if (error) {
          setAcceptError(error.message);
          setAccepting(false);
          return;
        }
        // AppHome resolves useMyOrganizations() fresh and will redirect
        // straight into this org's dashboard since it's now the only (or
        // newest) membership for this user.
        navigate("/app", { replace: true });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user, authLoading, preview]);

  if (loadingPreview) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!preview) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-center">
        <XCircle className="h-12 w-12 text-destructive" />
        <h1 className="mt-4 font-display text-xl font-bold">Invitation not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">This invite link is invalid or has been revoked.</p>
        <Button asChild className="mt-6">
          <Link to="/">Back home</Link>
        </Button>
      </div>
    );
  }

  const isExpired = new Date(preview.expires_at) < new Date();

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="rounded-2xl border border-primary-foreground/10 bg-card p-8 shadow-elevated text-center">
          <img src={logo} alt="Client Connect" className="mx-auto h-14 mb-6" />
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gold/10">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <h1 className="mt-4 font-display text-xl font-bold">
            You're invited to join <span className="text-gradient-gold">{preview.organization_name}</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            As <strong>{ROLE_LABELS[preview.role as OrgRole] ?? preview.role}</strong>, invited to{" "}
            <strong>{preview.email}</strong>
          </p>

          {preview.accepted_at ? (
            <p className="mt-6 flex items-center justify-center gap-2 text-sm text-success">
              <CheckCircle2 className="h-4 w-4" /> This invitation has already been accepted.
            </p>
          ) : isExpired ? (
            <p className="mt-6 text-sm text-destructive">This invitation has expired. Ask an admin to resend it.</p>
          ) : acceptError ? (
            <p className="mt-6 text-sm text-destructive">{acceptError}</p>
          ) : accepting ? (
            <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Joining organization…
            </div>
          ) : (
            <div className="mt-6 flex flex-col gap-2">
              <Button asChild className="bg-gradient-gold hover:opacity-90">
                <Link to="/login" state={{ from: `/invite/${token}` }}>
                  Sign in to accept
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/signup" state={{ from: `/invite/${token}` }}>
                  Create an account
                </Link>
              </Button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default InviteAccept;
