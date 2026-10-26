import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Camera, FilePlus2, MessageCircle, Search, Send, UserRound, X } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ClientTicketMessages } from "@/components/ClientTicketMessages";
import { AiOrb } from "@/components/chat/AiOrb";
import { HandoffForm } from "@/components/chat/HandoffForm";
import { MessageForm } from "@/components/chat/MessageForm";
import { ThinkingWave } from "@/components/chat/ThinkingWave";
import { TicketDraftCard } from "@/components/chat/TicketDraftCard";
import { TrackTicketCard } from "@/components/chat/TrackTicketCard";
import { formatTicketRef, trackTicket } from "@/lib/tracking";
import {
  type ChatImage,
  type ChatTurn,
  type LiveSession,
  type TicketDraft,
  clearLiveSession,
  createHandoffTicket,
  createTicketFromChat,
  loadLiveSession,
  saveLiveSession,
  sendAiMessage,
  shrinkImage,
} from "@/lib/supportChat";

const GREETING: ChatTurn = {
  role: "assistant",
  content: "Hi! Describe your issue and I'll help — or connect you to a person.",
};
const OPEN_TICKET_PROMPT = "I'd like to open a support ticket.";

interface SupportChatWidgetProps {
  organizationId: string;
  orgName?: string;
  /** Org slug for the public ticket-status lookup. */
  orgSlug?: string;
  /** Render as an inline panel (portal page) instead of a floating bubble. */
  embedded?: boolean;
}

export function SupportChatWidget({ organizationId, orgName, orgSlug, embedded = false }: SupportChatWidgetProps) {
  const [live, setLive] = useState<LiveSession | null>(() => loadLiveSession(organizationId));
  const [open, setOpen] = useState(() => embedded || live !== null);
  const [messages, setMessages] = useState<ChatTurn[]>([GREETING]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showHandoff, setShowHandoff] = useState(false);
  const [ticketDraft, setTicketDraft] = useState<TicketDraft | null>(null);
  const [showMessageForm, setShowMessageForm] = useState(false);
  const [showTracker, setShowTracker] = useState(false);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [agentName, setAgentName] = useState<string | null>(null);
  const submittingRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingPhoto, setPendingPhoto] = useState<ChatImage | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, showHandoff, ticketDraft, showMessageForm, showTracker, isLoading]);

  useEffect(() => {
    if (!open || embedded) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, embedded]);

  const handlePhoto = async (file: File | undefined) => {
    if (!file) return;
    setPhotoError(null);
    try {
      setPendingPhoto(await shrinkImage(file));
    } catch (err) {
      setPhotoError(
        err instanceof Error && err.message === "too_large"
          ? "That photo is too large (max 10 MB)."
          : "Couldn't read that photo — try a JPG or PNG.",
      );
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const send = async (text: string) => {
    const content = text.trim();
    if ((!content && !pendingPhoto) || isLoading) return;
    const turn: ChatTurn = pendingPhoto ? { role: "user", content, image: pendingPhoto } : { role: "user", content };
    const next = [...messages, turn];
    setMessages(next);
    setInput("");
    setPendingPhoto(null);
    setIsLoading(true);
    const result = await sendAiMessage(organizationId, next);
    setMessages((prev) => [...prev, { role: "assistant", content: result.reply }]);
    if (result.handoff) setShowHandoff(true);
    if (result.ticketDraft) setTicketDraft(result.ticketDraft);
    if (result.aiDisabled || result.unavailable) setShowMessageForm(true);
    setIsLoading(false);
  };

  // One submission at a time across the handoff form, ticket card and message form.
  const guarded = async (work: () => Promise<void>, failure: string) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await work();
    } catch (err) {
      console.error(failure, err);
      toast.error(failure);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const confirmCreated = (ticketId: string, token: string) => {
    const url = `${window.location.origin}/t/${token}`;
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: `✅ Ticket #${formatTicketRef(ticketId)} created. We emailed you a private chat link — you can also open it here: [${url}](/t/${token})`,
      },
    ]);
  };

  const startLiveChat = (name: string, email: string) =>
    guarded(async () => {
      const { ticketId, token } = await createHandoffTicket({ organizationId, orgName, name, email, turns: messages });
      const session = { ticketId, token, name, email };
      saveLiveSession(organizationId, session);
      setLive(session);
      setShowHandoff(false);
    }, "Couldn't reach an agent. Please try again.");

  const submitDraft = (name: string, email: string, company: string) =>
    guarded(async () => {
      const { ticketId, token } = await createTicketFromChat({
        organizationId,
        orgName,
        name,
        email,
        company,
        draft: ticketDraft!,
        turns: messages,
      });
      setTicketDraft(null);
      confirmCreated(ticketId, token);
    }, "Couldn't submit the ticket. Please try again.");

  const submitMessage = (name: string, email: string, message: string) =>
    guarded(async () => {
      const draft: TicketDraft = {
        title: message.length > 80 ? `${message.slice(0, 77)}…` : message,
        category: "Other",
        priority: "Moderate (single user or workaround available)",
        summary: message,
      };
      const { ticketId, token } = await createTicketFromChat({
        organizationId,
        orgName,
        name,
        email,
        company: "",
        draft,
        turns: messages,
      });
      setShowMessageForm(false);
      confirmCreated(ticketId, token);
    }, "Couldn't send your message. Please try again.");

  const lookUpTicket = async (input: string) => {
    if (!orgSlug) return;
    setChecking(true);
    let reply: string;
    try {
      const t = await trackTicket(orgSlug, input);
      reply = t
        ? `Ticket #${t.ticket_ref} · **${t.status}** · opened ${format(new Date(t.created_at), "MMM d")} · last update ${formatDistanceToNow(new Date(t.updated_at), { addSuffix: true })} · ${
            t.team_replied
              ? "our team has replied — check your email for your private chat link."
              : "our team will reply soon. Your private chat link is in your confirmation email."
          }`
        : "We couldn't find that ticket number. Check your confirmation email — it's the 8 characters after the #.";
      setShowTracker(false);
    } catch {
      reply = "Couldn't check right now — please try again in a moment.";
    } finally {
      setChecking(false);
    }
    setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
  };

  const endLiveChat = () => {
    clearLiveSession(organizationId);
    setLive(null);
    setAgentName(null);
    setMessages([GREETING]);
  };

  const handleSupportJoined = useCallback((name: string) => setAgentName(name), []);

  const chip = "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px]";

  const panelBody = (
    <>
      <header className="flex items-center gap-3 border-b border-cyan/20 px-4 py-3">
        <AiOrb className={embedded ? "h-11 w-11" : undefined} />
        <div className="min-w-0 flex-1">
          <p className={`font-display font-bold tracking-wider ${embedded ? "text-base" : "text-sm"}`}>
            HIGHERVIEW <span className="text-gold">AI</span>
          </p>
          <p className="text-[10px] tracking-[0.12em] text-cyan">
            {live ? `● LIVE · TICKET #${formatTicketRef(live.ticketId)}` : "● ONLINE · ASK ANYTHING OR OPEN A TICKET"}
          </p>
        </div>
        {!embedded && (
          <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close chat" className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        )}
      </header>

      {live ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="px-4 pt-3 text-center">
            {agentName ? (
              <p className="inline-block rounded-full border border-[#f5c84c]/40 px-3 py-1 text-[11px] tracking-wide text-gold">
                ⚡ {agentName} joined the chat
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">Waiting for an agent…</p>
            )}
          </div>
          <ClientTicketMessages token={live.token} senderName={live.name} senderEmail={live.email} onSupportJoined={handleSupportJoined} />
          <div className="flex items-center justify-between gap-2 border-t border-cyan/20 px-4 py-2 text-[11px] text-muted-foreground">
            <a href={`/t/${live.token}`} className="truncate text-cyan underline-offset-2 hover:underline">
              Resume later: {window.location.origin}/t/{live.token.slice(0, 8)}…
            </a>
            <button onClick={endLiveChat} className="shrink-0 hover:text-foreground">
              End chat
            </button>
          </div>
        </div>
      ) : (
        <>
          <div ref={scrollRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] px-3 py-2 text-sm ${
                    m.role === "user"
                      ? "rounded-2xl rounded-br-sm bg-gradient-gold font-medium text-primary-foreground"
                      : "rounded-2xl rounded-bl-sm border border-cyan/30 bg-cyan/[0.08]"
                  }`}
                >
                  {m.image?.previewUrl && (
                    <img src={m.image.previewUrl} alt="Your photo" className="mb-1.5 max-h-40 w-full rounded-lg object-cover ring-1 ring-black/20" />
                  )}
                  {m.role === "assistant" ? (
                    <div className="prose prose-sm prose-invert max-w-none break-words [&>p]:m-0 [&_a]:text-cyan">
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                  ) : (
                    m.content
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="inline-flex rounded-2xl rounded-bl-sm border border-cyan/30 bg-cyan/[0.08] px-3 py-2">
                <ThinkingWave />
              </div>
            )}
            {ticketDraft && <TicketDraftCard draft={ticketDraft} submitting={submitting} onSubmit={submitDraft} />}
            {showMessageForm && <MessageForm submitting={submitting} onSubmit={submitMessage} />}
            {showTracker && <TrackTicketCard checking={checking} onLookup={lookUpTicket} />}
            {showHandoff && <HandoffForm onSubmit={startLiveChat} submitting={submitting} />}
          </div>

          <div className="flex flex-wrap gap-1.5 px-4 pb-2">
            <button onClick={() => setShowHandoff(true)} className={`${chip} border-[#f5c84c] text-gold glow-gold`}>
              <UserRound className="h-3 w-3" /> Talk to an agent
            </button>
            <button onClick={() => send(OPEN_TICKET_PROMPT)} className={`${chip} border-violet/50 text-violet hover:bg-violet/10`}>
              <FilePlus2 className="h-3 w-3" /> Open a ticket
            </button>
            <button onClick={() => fileRef.current?.click()} className={`${chip} border-cyan/40 text-cyan hover:bg-cyan/10`}>
              <Camera className="h-3 w-3" /> Send a photo
            </button>
            {orgSlug && (
              <button
                onClick={() => setShowTracker(true)}
                className="inline-flex items-center gap-1.5 rounded-full border-2 border-[#f5c84c] bg-[#f5c84c]/15 px-3.5 py-1.5 text-sm font-semibold text-gold glow-gold"
              >
                <Search className="h-4 w-4" /> Track ticket
              </button>
            )}
          </div>

          {(pendingPhoto || photoError) && (
            <div className="flex items-center gap-2 border-t border-cyan/20 px-3 pt-2">
              {pendingPhoto?.previewUrl && (
                <div className="relative">
                  <img src={pendingPhoto.previewUrl} alt="Photo to send" className="h-14 w-14 rounded-lg object-cover ring-1 ring-cyan/40" />
                  <button
                    onClick={() => setPendingPhoto(null)}
                    aria-label="Remove photo"
                    className="absolute -right-1.5 -top-1.5 rounded-full bg-navy p-0.5 ring-1 ring-cyan/40"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
              {photoError && <p role="alert" className="text-xs text-destructive">{photoError}</p>}
              {pendingPhoto && <p className="text-[11px] text-muted-foreground">Add a note or just send.</p>}
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            aria-label="Photo file"
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => handlePhoto(e.target.files?.[0])}
          />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex gap-2 border-t border-cyan/20 p-3"
          >
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => fileRef.current?.click()}
              aria-label="Attach a photo"
              className="h-9 w-9 shrink-0 text-cyan"
            >
              <Camera className="h-4 w-4" />
            </Button>
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message…"
              maxLength={2000}
              className="h-9 border-violet/40 bg-navy/70"
            />
            <Button
              type="submit"
              size="icon"
              disabled={isLoading || (!input.trim() && !pendingPhoto)}
              aria-label="Send message"
              className="h-9 w-9 shrink-0 bg-gradient-gold text-primary-foreground"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </>
      )}
    </>
  );

  if (embedded) {
    return (
      <section
        aria-label="Support chat"
        className="glass flex h-[min(680px,calc(100vh-7rem))] min-h-[520px] w-full flex-col overflow-hidden rounded-2xl shadow-float"
      >
        {panelBody}
      </section>
    );
  }

  return (
    <>
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            whileHover={reduceMotion ? undefined : { scale: 1.08 }}
            onClick={() => setOpen(true)}
            aria-label="Open support chat"
            className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-gold glow-gold ring-2 ring-cyan/60 focus-visible:outline-none focus-visible:ring-4"
          >
            <MessageCircle className="h-6 w-6 text-primary-foreground" />
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.section
            role="dialog"
            aria-label="Support chat"
            initial={reduceMotion ? false : { opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            className="glass fixed bottom-6 right-4 z-50 flex max-h-[min(640px,calc(100vh-3rem))] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl shadow-float sm:right-6"
          >
            {panelBody}
          </motion.section>
        )}
      </AnimatePresence>
    </>
  );
}
