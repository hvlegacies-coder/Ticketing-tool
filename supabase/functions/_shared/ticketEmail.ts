// Ticket emails (received / processing / resolved) on one mobile-first layout.
// Single column, never wider than the screen: no fixed-width columns, details
// stacked label-over-value, long words wrap. Pure (no Deno APIs) for Vitest.
import { ticketNumberBlock } from "./ticketNumberBlock.ts";

export type TicketEmailKind = "received" | "processing" | "resolved";

export type TicketEmailInput = {
  ticketId: string;
  clientName: string;
  issueTitle: string;
  priority?: string;
  issueCategory?: string;
  department?: string;
  affectedSystem?: string;
  companyName?: string;
  resolvedBy?: string;
  chatLink: string;
  portalUrl?: string;
  brandName: string;
};

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const safeUrl = (u: string | undefined) => (u && /^https?:\/\//i.test(u) ? esc(u) : null);

/** Short label for the long SLA priority strings (also passes older values like "Medium" through). */
export function shortPriority(priority: string | undefined): string {
  if (!priority) return "Moderate";
  if (priority.startsWith("High impact & high urgency")) return "Critical";
  if (priority.startsWith("High impact or high urgency")) return "High";
  return priority.split(" ")[0];
}

const COPY: Record<
  TicketEmailKind,
  {
    subjectIcon: string;
    subjectWord: string;
    eyebrow: string;
    headline: (ref: string) => string;
    accent: string;
    status: string;
    intro: (ref: string) => string;
    detailsTitle: string;
    nextTitle: string;
    next: string;
    button: string;
    closing: string;
  }
> = {
  received: {
    subjectIcon: "🎫",
    subjectWord: "Received",
    eyebrow: "SUPPORT TICKET CONFIRMATION",
    headline: () => "We got your ticket",
    accent: "#4f46e5",
    status: "⏳ Processing",
    intro: () =>
      "Thank you for reaching out! Your support ticket has been received and is <strong>currently being processed</strong> by our team. We'll reach out once it's been resolved or if we need more information from you.",
    detailsTitle: "📋 Ticket details",
    nextTitle: "🔄 What happens next?",
    next: "Our team reviews your ticket and assigns it to a specialist. We may reach out if we need more details, and you'll get an email once your issue is resolved.",
    button: "💬 Open Messages",
    closing: "Use the button above to message our support team about this ticket. Save this email for your records.",
  },
  processing: {
    subjectIcon: "⚙️",
    subjectWord: "In Progress",
    eyebrow: "TICKET IN PROGRESS",
    headline: () => "We're working on it",
    accent: "#2563eb",
    status: "⚙️ Processing",
    intro: (ref) =>
      `We wanted to let you know that your support ticket <strong>#${ref}</strong> is now being actively worked on by our team. Here's a summary:`,
    detailsTitle: "📋 Ticket summary",
    nextTitle: "📌 What happens next?",
    next: "Our team is reviewing your issue and working on a resolution. You'll get another email once your ticket is resolved. If you have more information to share, send us a message with the button below.",
    button: "💬 View Ticket Messages",
    closing: "Thank you for your patience. We're on it!",
  },
  resolved: {
    subjectIcon: "✅",
    subjectWord: "Resolved",
    eyebrow: "TICKET RESOLVED",
    headline: () => "Your ticket is resolved",
    accent: "#059669",
    status: "✅ Resolved",
    intro: (ref) => `Great news! Your support ticket <strong>#${ref}</strong> has been resolved and closed. Here's a summary:`,
    detailsTitle: "📋 Resolved ticket summary",
    nextTitle: "💡 Still need help?",
    next: "If the issue continues or you need more help, message us with the button below or open a new ticket in our support chat. We're always here to help!",
    button: "💬 View Ticket Messages",
    closing: "Thank you for using our support.",
  },
};

export function buildTicketEmail(kind: TicketEmailKind, p: TicketEmailInput): { subject: string; html: string } {
  const c = COPY[kind];
  const ref = p.ticketId.slice(0, 8).toUpperCase();
  const chat = safeUrl(p.chatLink);

  const rows: Array<[string, string | undefined]> = [
    [kind === "received" ? "Issue summary" : "Issue", p.issueTitle],
    ["Priority", shortPriority(p.priority)],
    ["Category", p.issueCategory],
    ["Department", p.department],
    ["Affected system", p.affectedSystem],
    ["Company", p.companyName && p.companyName !== "—" ? p.companyName : undefined],
    ["Status", c.status.replace(/^\S+\s/, "")],
    ["Resolved by", kind === "resolved" ? p.resolvedBy : undefined],
    ["Est. response", kind === "received" ? "Within 24 hours" : undefined],
  ];
  const details = rows
    .filter(([, v]) => v && v.trim())
    .map(
      ([label, value], i) => `
              <tr>
                <td style="padding:10px 0;${i ? "border-top:1px solid #e5e7eb;" : ""}">
                  <div style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.06em;">${label}</div>
                  <div style="font-size:16px;line-height:1.4;color:#111827;font-weight:600;margin-top:2px;">${esc(value!)}</div>
                </td>
              </tr>`,
    )
    .join("");

  const button = chat
    ? `<a href="${chat}" style="display:block;box-sizing:border-box;width:100%;max-width:100%;padding:15px 16px;border-radius:12px;background:${c.accent};color:#ffffff;font-size:17px;font-weight:700;text-align:center;text-decoration:none;">${c.button}</a>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<title>Ticket #${ref}</title>
<style>
  body { margin:0; padding:0; -webkit-text-size-adjust:100%; }
  @media (min-width: 600px) { .px { padding-left:32px !important; padding-right:32px !important; } }
</style>
</head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;border-collapse:collapse;">
    <tr>
      <td align="center" style="padding:12px 8px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:14px;border-collapse:separate;overflow:hidden;">
          <tr>
            <td class="px" style="background:#111827;padding:26px 18px;text-align:center;">
              <div style="font-size:13px;letter-spacing:.12em;color:#ffd84d;font-weight:700;">${c.eyebrow}</div>
              <div style="font-size:24px;line-height:1.25;color:#ffffff;font-weight:800;margin-top:6px;">${c.headline(ref)}</div>
              <div style="font-size:14px;color:#cbd5e1;margin-top:6px;">${esc(p.brandName)}</div>
            </td>
          </tr>
          <tr>
            <td class="px" style="padding:22px 18px 8px;word-break:break-word;overflow-wrap:anywhere;">
              <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#111827;">Hi ${esc(p.clientName)},</p>
              <p style="margin:0 0 20px;font-size:16px;line-height:1.6;color:#374151;">${c.intro(ref)}</p>
              ${ticketNumberBlock(p.ticketId, p.portalUrl)}
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;">
                <tr>
                  <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-size:15px;font-weight:700;color:#374151;">${c.detailsTitle}</td>
                </tr>
                <tr>
                  <td style="padding:4px 16px 8px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">${details}
                    </table>
                  </td>
                </tr>
              </table>
              <div style="margin:20px 0;padding:16px;border-radius:12px;background:#eff6ff;border:1px solid #bfdbfe;">
                <div style="font-size:16px;font-weight:700;color:#1e40af;margin-bottom:6px;">${c.nextTitle}</div>
                <div style="font-size:15px;line-height:1.6;color:#374151;">${c.next}</div>
              </div>
              ${button}
              <p style="margin:16px 0 8px;font-size:14px;line-height:1.6;color:#6b7280;text-align:center;">${c.closing}</p>
            </td>
          </tr>
          <tr>
            <td class="px" style="padding:18px;background:#f8fafc;border-top:1px solid #e5e7eb;text-align:center;font-size:12px;line-height:1.6;color:#9ca3af;">
              © ${new Date().getFullYear()} ${esc(p.brandName)}. All rights reserved.<br>
              This is an automated message. Please do not reply directly to this email.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  // Subjects are plain text (not HTML), so they're not escaped.
  return { subject: `${c.subjectIcon} Ticket #${ref} ${c.subjectWord} — ${p.issueTitle}`, html };
}
