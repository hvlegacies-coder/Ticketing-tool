import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Send, Loader2, MessageSquareText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

interface ChatMessage {
  id: string;
  ticket_id: string;
  sender_type: string;
  sender_name: string;
  sender_email: string | null;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface CannedResponseOption {
  id: string;
  title: string;
  body: string;
}

interface TicketMessagesProps {
  ticketId: string;
  senderType: "client" | "support";
  senderName: string;
  senderEmail?: string;
  cannedResponses?: CannedResponseOption[];
}

export function TicketMessages({ ticketId, senderType, senderName, senderEmail, cannedResponses }: TicketMessagesProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchMessages = async () => {
    const { data, error } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });

    if (!error && data) {
      setMessages(data as ChatMessage[]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchMessages();

    const channel = supabase
      .channel(`messages-${ticketId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `ticket_id=eq.${ticketId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as ChatMessage]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ticketId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Mark messages as read for support users
  useEffect(() => {
    if (senderType === "support" && messages.some((m) => m.sender_type === "client" && !m.is_read)) {
      const unreadIds = messages
        .filter((m) => m.sender_type === "client" && !m.is_read)
        .map((m) => m.id);
      if (unreadIds.length > 0) {
        supabase
          .from("chat_messages")
          .update({ is_read: true })
          .in("id", unreadIds)
          .then();
      }
    }
  }, [messages, senderType]);

  const handleSend = async () => {
    if (!newMessage.trim() || isSending) return;
    setIsSending(true);

    const { error } = await supabase.from("chat_messages").insert({
      ticket_id: ticketId,
      sender_type: senderType,
      sender_name: senderName,
      sender_email: senderEmail || null,
      message: newMessage.trim(),
    } as never);

    if (error) {
      toast.error("Failed to send message");
      console.error(error);
    } else {
      setNewMessage("");
    }
    setIsSending(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[400px]">
        {messages.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No messages yet. Start the conversation!
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${
                  msg.sender_type === senderType ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 transition-shadow hover:shadow-card ${
                    msg.sender_type === senderType
                      ? "bg-gradient-gold text-primary-foreground rounded-br-md"
                      : "bg-muted text-foreground rounded-bl-md"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold opacity-80">
                      {msg.sender_name}
                    </span>
                    <span className="text-[10px] opacity-60">
                      {format(new Date(msg.created_at), "MMM d, h:mm a")}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      <div className="border-t p-3 space-y-2">
        {cannedResponses && cannedResponses.length > 0 && (
          <Select
            onValueChange={(id) => {
              const resp = cannedResponses.find((c) => c.id === id);
              if (resp) setNewMessage((prev) => (prev ? `${prev}\n\n${resp.body}` : resp.body));
            }}
          >
            <SelectTrigger className="h-8 w-fit gap-2 text-xs">
              <MessageSquareText className="h-3.5 w-3.5" />
              <SelectValue placeholder="Insert canned response" />
            </SelectTrigger>
            <SelectContent>
              {cannedResponses.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <div className="flex gap-2">
          <Textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type your message..."
            className="min-h-[44px] max-h-[120px] resize-none transition-shadow focus-visible:shadow-gold"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <Button
            onClick={handleSend}
            disabled={isSending || !newMessage.trim()}
            size="icon"
            className="bg-gradient-gold hover:opacity-90 transition-opacity shrink-0 self-end"
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
