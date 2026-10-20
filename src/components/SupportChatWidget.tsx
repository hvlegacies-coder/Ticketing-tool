import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Camera, FileText, MessageCircle, Send, UserRound, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ClientTicketMessages } from "@/components/ClientTicketMessages";
import { AiOrb } from "@/components/chat/AiOrb";
import { HandoffForm } from "@/components/chat/HandoffForm";
import { ThinkingWave } from "@/components/chat/ThinkingWave";
import {
  type ChatImage,
  type ChatTurn,
  type LiveSession,
  clearLiveSession,
  createHandoffTicket,
  loadLiveSession,
  saveLiveSession,
  sendAiMessage,
  shrinkImage,
} from "@/lib/supportChat";

const GREETING: ChatTurn = {
  role: "assistant",
  content: "Hi! Describe your issue and I'll help — or connect you to a person.",
};
const QUICK_ACTIONS = ["Track refund"];

interface SupportChatWidgetProps {
  organizationId: string;
  onTicketDraft?: (
    data: {
      issue_title: string;
      issue_description: string;
      issue_category: string;
      priority: string;
      related_link: string;
    },
    transcript: ChatTurn[],
  ) => void;
}

export function SupportChatWidget({ organizationId, onTicketDraft }: SupportChatWidgetProps) {
  const [live, setLive] = useState<LiveSession | null>(() => loadLiveSession(organizationId));
  const [open, setOpen] = useState(() => live !== null);
  const [messages, setMessages] = useState<ChatTurn[]>([GREETING]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showHandoff, setShowHandoff] = useState(false);
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
  }, [messages, showHandoff, isLoading]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

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
    const { reply, handoff } = await sendAiMessage(organizationId, next);
    setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    if (handoff) setShowHandoff(true);
    setIsLoading(false);
  };

  const startLiveChat = async (name: string, email: string) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const { ticketId, token } = await createHandoffTicket({ organizationId, name, email, turns: messages });
      const session = { ticketId, token, name, email };
      saveLiveSession(organizationId, session);
      setLive(session);
      setShowHandoff(false);
    } catch (err) {
      console.error("Handoff error:", err);
      toast.error("Couldn't reach an agent. Please try again or submit a ticket.");
      submittingRef.current = false;
    } finally {
      setSubmitting(false);
    }
  };

  const endLiveChat = () => {
    clearLiveSession(organizationId);
    submittingRef.current = false;
    setLive(null);
    setAgentName(null);
    setMessages([GREETING]);
  };

  const handleSupportJoined = useCallback((name: string) => setAgentName(name), []);

  const handleCreateTicket = () => {
    if (!onTicketDraft) return;
    const userText = messages.filter((m) => m.role === "user").map((m) => m.content).join("\n\n");
    onTicketDraft(
      { issue_title: userText.slice(0, 100), issue_description: userText, issue_category: "", priority: "", related_link: "" },
      messages,
    );
    setOpen(false);
  };

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
            <header className="flex items-center gap-3 border-b border-cyan/20 px-4 py-3">
              <AiOrb />
              <div className="min-w-0 flex-1">
                <p className="font-display text-sm font-bold tracking-wider">
                  HIGHERVIEW <span className="text-gold">AI</span>
                </p>
                <p className="text-[10px] tracking-[0.12em] text-cyan">
                  {live ? `● LIVE · TICKET #${live.ticketId.slice(0, 4).toUpperCase()}` : "● ONLINE · AGENTS AVAILABLE"}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close chat" className="h-8 w-8">
                <X className="h-4 w-4" />
              </Button>
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
                <ClientTicketMessages
                  token={live.token}
                  senderName={live.name}
                  senderEmail={live.email}
                  onSupportJoined={handleSupportJoined}
                />
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
                          <img
                            src={m.image.previewUrl}
                            alt="Your photo"
                            className="mb-1.5 max-h-40 w-full rounded-lg object-cover ring-1 ring-black/20"
                          />
                        )}
                        {m.role === "assistant" ? (
                          <div className="prose prose-sm prose-invert max-w-none [&>p]:m-0">
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
                  {showHandoff && <HandoffForm onSubmit={startLiveChat} submitting={submitting} />}
                </div>

                <div className="flex flex-wrap gap-1.5 px-4 pb-2">
                  <button
                    onClick={() => setShowHandoff(true)}
                    className="inline-flex items-center gap-1 rounded-full border border-[#f5c84c] px-2.5 py-1 text-[11px] text-gold glow-gold"
                  >
                    <UserRound className="h-3 w-3" /> Talk to an agent
                  </button>
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="inline-flex items-center gap-1 rounded-full border border-cyan/40 px-2.5 py-1 text-[11px] text-cyan hover:bg-cyan/10"
                  >
                    <Camera className="h-3 w-3" /> Send a photo
                  </button>
                  {QUICK_ACTIONS.map((label) => (
                    <button
                      key={label}
                      onClick={() => send(label)}
                      className="rounded-full border border-cyan/40 px-2.5 py-1 text-[11px] text-cyan hover:bg-cyan/10"
                    >
                      {label}
                    </button>
                  ))}
                  {messages.length > 3 && onTicketDraft && (
                    <button
                      onClick={handleCreateTicket}
                      className="inline-flex items-center gap-1 rounded-full border border-violet/50 px-2.5 py-1 text-[11px] text-violet hover:bg-violet/10"
                    >
                      <FileText className="h-3 w-3" /> Create ticket from conversation
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
          </motion.section>
        )}
      </AnimatePresence>
    </>
  );
}
