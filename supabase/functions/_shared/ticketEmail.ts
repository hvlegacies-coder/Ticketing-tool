// Ticket emails (received / processing / resolved) on one mobile-first layout.
// Single column, never wider than the screen: greeting plus the ticket-number
// box (no details summary), long words wrap. Pure (no Deno APIs) for Vitest.
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

/** Short label for the long SLA priority strings (also passes older values like "Medium" through). */
export function shortPriority(priority: string | undefined): string {
  if (!priority) return "Moderate";
  if (priority.startsWith("High impact & high urgency")) return "Critical";
  if (priority.startsWith("High impact or high urgency")) return "High";
  return priority.split(" ")[0];
}

const COPY: Record<
  TicketEmailKind,
  { subjectIcon: string; subjectWord: string; eyebrow: string; headline: string; intro: (ref: string) => string }
> = {
  received: {
    subjectIcon: "🎫",
    subjectWord: "Received",
    eyebrow: "SUPPORT TICKET CONFIRMATION",
    headline: "We got your ticket",
    intro: () =>
      "Thank you for reaching out! Your support ticket has been received and is <strong>currently being processed</strong> by our team. We'll reach out once it's been resolved or if we need more information from you.",
  },
  processing: {
    subjectIcon: "⚙️",
    subjectWord: "In Progress",
    eyebrow: "TICKET IN PROGRESS",
    headline: "We're working on it",
    intro: (ref) => `We wanted to let you know that your support ticket <strong>#${ref}</strong> is now being actively worked on by our team.`,
  },
  resolved: {
    subjectIcon: "✅",
    subjectWord: "Resolved",
    eyebrow: "TICKET RESOLVED",
    headline: "Your ticket is resolved",
    intro: (ref) => `Great news! Your support ticket <strong>#${ref}</strong> has been resolved and closed.`,
  },
};

export function buildTicketEmail(kind: TicketEmailKind, p: TicketEmailInput): { subject: string; html: string } {
  const c = COPY[kind];
  const ref = p.ticketId.slice(0, 8).toUpperCase();

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
              <div style="font-size:24px;line-height:1.25;color:#ffffff;font-weight:800;margin-top:6px;">${c.headline}</div>
              <div style="font-size:14px;color:#cbd5e1;margin-top:6px;">${esc(p.brandName)}</div>
            </td>
          </tr>
          <tr>
            <td class="px" style="padding:22px 18px 8px;word-break:break-word;overflow-wrap:anywhere;">
              <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#111827;">Hi ${esc(p.clientName)},</p>
              <p style="margin:0 0 20px;font-size:16px;line-height:1.6;color:#374151;">${c.intro(ref)}</p>
              ${ticketNumberBlock(p.ticketId, p.portalUrl)}
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
