import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UploadField } from "@/components/UploadField";
import { supabase } from "@/integrations/supabase/client";
import {
  DEPARTMENTS,
  ISSUE_CATEGORIES,
  PRIORITY_OPTIONS,
  AFFECTED_SYSTEMS,
  CONTACT_METHODS,
} from "@/lib/mondayConfig";
import { generateClientAccessToken } from "@/lib/utils";
import { toast } from "sonner";

interface TicketFormProps {
  organizationId: string;
  orgSlug: string;
  orgName: string;
  prefillData?: {
    issue_title?: string;
    issue_description?: string;
    issue_category?: string;
    priority?: string;
    related_link?: string;
  };
  chatTranscript?: Array<{ role: string; content: string }>;
}

export function TicketForm({ organizationId, orgSlug, orgName, prefillData, chatTranscript }: TicketFormProps) {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [files, setFiles] = useState<File[]>([]);

  const [form, setForm] = useState({
    client_full_name: "",
    company_name: "",
    email: "",
    phone: "",
    department: "",
    issue_title: prefillData?.issue_title || "",
    issue_category: prefillData?.issue_category || "",
    priority: prefillData?.priority || "",
    issue_description: prefillData?.issue_description || "",
    affected_system: "",
    related_link: prefillData?.related_link || "",
    preferred_contact_method: "Email",
  });

  const updateField = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const uploadFiles = async (): Promise<string[]> => {
    const urls: string[] = [];
    for (const file of files) {
      const ext = file.name.split(".").pop();
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage
        .from("ticket-attachments")
        .upload(path, file);
      if (error) {
        console.error("Upload error:", error);
        continue;
      }
      const { data: urlData } = supabase.storage
        .from("ticket-attachments")
        .getPublicUrl(path);
      urls.push(urlData.publicUrl);
    }
    return urls;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !form.client_full_name ||
      !form.company_name ||
      !form.email ||
      !form.department ||
      !form.issue_title ||
      !form.issue_category ||
      !form.priority ||
      !form.issue_description ||
      !form.affected_system
    ) {
      toast.error("Please fill in all required fields.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email)) {
      toast.error("Please enter a valid email address.");
      return;
    }

    setIsSubmitting(true);

    try {
      const attachmentUrls = await uploadFiles();

      // Generated client-side (rather than reading back the server-assigned
      // defaults via `.select()`) because anon has no SELECT policy on
      // tickets — Postgres enforces the SELECT policy on RETURNING rows too,
      // so requesting the row back after an anon insert fails RLS entirely,
      // even though the insert itself is allowed.
      const ticketId = crypto.randomUUID();
      const clientAccessToken = generateClientAccessToken();

      const { error: insertError } = await supabase
        .from("tickets")
        .insert({
          id: ticketId,
          client_access_token: clientAccessToken,
          organization_id: organizationId,
          client_full_name: form.client_full_name,
          company_name: form.company_name,
          email: form.email,
          phone: form.phone || null,
          department: form.department,
          issue_title: form.issue_title,
          issue_category: form.issue_category,
          priority: form.priority,
          issue_description: form.issue_description,
          affected_system: form.affected_system,
          related_link: form.related_link || null,
          preferred_contact_method: form.preferred_contact_method,
          attachments: attachmentUrls,
          chatbot_transcript: chatTranscript || null,
        } as never);

      if (insertError) throw insertError;

      // Send confirmation email (non-blocking)
      try {
        await supabase.functions.invoke("send-ticket-email", {
          body: {
            ticketId,
            email: form.email,
            clientName: form.client_full_name,
            issueTitle: form.issue_title,
            priority: form.priority,
            department: form.department,
            issueCategory: form.issue_category,
            affectedSystem: form.affected_system,
            companyName: form.company_name,
            chatLink: `${window.location.origin}/t/${clientAccessToken}`,
            orgName,
          },
        });
      } catch (emailErr) {
        console.error("Email send error (non-blocking):", emailErr);
      }

      // Sync to Monday (non-blocking)
      try {
        await supabase.functions.invoke("sync-to-monday", {
          body: { ticketId },
        });
      } catch (syncErr) {
        console.error("Monday sync error (non-blocking):", syncErr);
      }

      toast.success("Ticket submitted successfully!");
      navigate(`/support/${orgSlug}/ticket-submitted`, { state: { ticketId, clientAccessToken } });
    } catch (err) {
      console.error("Submit error:", err);
      toast.error("Failed to submit ticket. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Personal Info */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="client_full_name">Full Name *</Label>
            <Input
              id="client_full_name"
              value={form.client_full_name}
              onChange={(e) => updateField("client_full_name", e.target.value)}
              placeholder="John Doe"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company_name">Company Name *</Label>
            <Input
              id="company_name"
              value={form.company_name}
              onChange={(e) => updateField("company_name", e.target.value)}
              placeholder="Acme Inc."
              required
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address *</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => updateField("email", e.target.value)}
              placeholder="john@acme.com"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              value={form.phone}
              onChange={(e) => updateField("phone", e.target.value)}
              placeholder="+1 (555) 123-4567"
            />
          </div>
        </div>

        {/* Department */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Department or Team *</Label>
            <Select
              value={form.department}
              onValueChange={(v) => updateField("department", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                {DEPARTMENTS.map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Preferred Contact</Label>
            <Select
              value={form.preferred_contact_method}
              onValueChange={(v) => updateField("preferred_contact_method", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONTACT_METHODS.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Issue Details */}
        <div className="space-y-2">
          <Label htmlFor="issue_title">Short Summary of the Issue *</Label>
          <Input
            id="issue_title"
            value={form.issue_title}
            onChange={(e) => updateField("issue_title", e.target.value)}
            placeholder="Brief summary of the issue"
            required
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Issue Type *</Label>
            <Select
              value={form.issue_category}
              onValueChange={(v) => updateField("issue_category", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select issue type" />
              </SelectTrigger>
              <SelectContent>
                {ISSUE_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Affected System or Application *</Label>
            <Select
              value={form.affected_system}
              onValueChange={(v) => updateField("affected_system", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select system" />
              </SelectTrigger>
              <SelectContent>
                {AFFECTED_SYSTEMS.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Impact and Urgency *</Label>
          <Select
            value={form.priority}
            onValueChange={(v) => updateField("priority", v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select impact level" />
            </SelectTrigger>
            <SelectContent>
              {PRIORITY_OPTIONS.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="issue_description">Detailed Description *</Label>
          <Textarea
            id="issue_description"
            value={form.issue_description}
            onChange={(e) => updateField("issue_description", e.target.value)}
            placeholder="Please describe your issue in detail. Include steps to reproduce, expected behavior, and what actually happened."
            rows={5}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="related_link">Related URL or Page Link</Label>
          <Input
            id="related_link"
            type="url"
            value={form.related_link}
            onChange={(e) => updateField("related_link", e.target.value)}
            placeholder="https://example.com/page"
          />
        </div>

        {/* File Upload */}
        <div className="space-y-2">
          <Label>Attachments (screenshots, error logs)</Label>
          <UploadField files={files} onFilesChange={setFiles} />
        </div>

        {/* Submit */}
        <Button
          type="submit"
          size="lg"
          disabled={isSubmitting}
          className="w-full"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              Submit Ticket
            </>
          )}
        </Button>
      </form>
    </motion.div>
  );
}
