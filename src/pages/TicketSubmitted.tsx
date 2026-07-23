import { useLocation, useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, ArrowLeft, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PortalHeader } from "@/components/PortalHeader";

const TicketSubmitted = () => {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const location = useLocation();
  const clientAccessToken = location.state?.clientAccessToken as string | undefined;

  return (
    <div className="min-h-screen bg-background">
      <PortalHeader homeHref={`/support/${orgSlug}`} />
      <div className="container flex items-center justify-center py-20">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="mx-auto max-w-lg text-center"
        >
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-success/10">
            <CheckCircle2 className="h-10 w-10 text-success" />
          </div>
          <h1 className="mt-6 font-display text-3xl font-bold">
            Ticket Submitted!
          </h1>
          <p className="mt-3 text-muted-foreground">
            Your support ticket has been received. Our team will review it shortly.
          </p>
          {clientAccessToken && (
            <>
              <p className="mt-3 text-sm text-muted-foreground">
                Save this link to communicate with our support team:
              </p>
              <div className="mt-2 rounded-lg border bg-card p-3">
                <Link
                  to={`/t/${clientAccessToken}`}
                  className="text-sm text-primary hover:underline break-all"
                >
                  {window.location.origin}/t/{clientAccessToken}
                </Link>
              </div>
            </>
          )}
          <div className="mt-8 flex justify-center gap-3">
            <Button asChild>
              <Link to={`/support/${orgSlug}`}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Support
              </Link>
            </Button>
            {clientAccessToken && (
              <Button variant="outline" asChild className="hover:border-primary hover:text-primary">
                <Link to={`/t/${clientAccessToken}`}>
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Open Messages
                </Link>
              </Button>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default TicketSubmitted;
