// Staff notification emails: "new ticket" (owners + admins) and "assigned to you"
// (assignee). Mobile-first like the customer ticket emails. Pure (no Deno APIs).
import { shortPriority } from "./ticketEmail.ts";

export type StaffEvent = "new_ticket" | "assigned";
export type StaffEmailKind = "new" | "assigned";
export type StaffMember = { userId: string; email: string | null; name: string | null; role: string };
export type PlannedEmail = { to: string; name: string | null; kind: StaffEmailKind };

/**
 * Who gets what. New ticket: owners and admins get "new"; the assignee gets
 * "assigned" instead (never both). Assignment: only the assignee.
 */
export function planStaffEmails(event: StaffEvent, staff: StaffMember[], assigneeId: string | null): PlannedEmail[] {
  const assignee = assigneeId ? staff.find((s) => s.userId === assigneeId && s.email) : undefined;
  const plan: PlannedEmail[] = [];
  if (event === "new_ticket") {
    for (const s of staff) {
      if (!s.email || s.userId === assignee?.userId) continue;
      if (s.role === "owner" || s.role === "admin") plan.push({ to: s.email, name: s.name, kind: "new" });
    }
  }
  if (assignee) plan.push({ to: assignee.email!, name: assignee.name, kind: "assigned" });
  return plan;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export function buildStaffTicketEmail(
  kind: StaffEmailKind,
  p: {
    ticketId: string;
    recipientName: string | null;
    customerName: string;
    title: string;
    summary: string;
    priority?: string;
    team?: string | null;
    adminUrl: string;
    orgName: string;
  },
): { subject: string; html: string } {
  const ref = p.ticketId.slice(0, 8).toUpperCase();
  const url = /^https?:\/\//i.test(p.adminUrl) ? esc(p.adminUrl) : null;
  const assigned = kind === "assigned";
  const accent = assigned ? "#d4a017" : "#2563eb";
  const summary = p.summary.length > 400 ? `${p.summary.slice(0, 397)}…` : p.summary;

  const rows: Array<[string, string | null | undefined]> = [
    ["Customer", p.customerName],
    ["Team", p.team],
    ["Priority", shortPriority(p.priority)],
    ["Ticket", `#${ref}`],
  ];
  const details = rows
    .filter(([, v]) => v && v.trim())
    .map(
      ([label, value], i) => `
              <tr><td style="padding:9px 0;${i ? "border-top:1px solid #e5e7eb;" : ""}">
                <div style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.06em;">${label}</div>
                <div style="font-size:16px;line-height:1.4;color:#111827;font-weight:600;margin-top:2px;">${esc(value!)}</div>
              </td></tr>`,
    )
    .join("");

  const button = url
    ? `<a href="${url}" style="display:block;box-sizing:border-box;width:100%;max-width:100%;padding:15px 16px;border-radius:12px;background:#111827;color:#ffd84d;font-size:17px;font-weight:700;text-align:center;text-decoration:none;">Open ticket</a>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting">
<title>Ticket #${ref}</title>
<style>@media (min-width: 600px) { .px { padding-left:32px !important; padding-right:32px !important; } }</style>
</head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;border-collapse:collapse;">
    <tr><td align="center" style="padding:12px 8px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:14px;border-collapse:separate;overflow:hidden;">
        <tr><td class="px" style="background:${accent};padding:22px 18px;text-align:center;">
          <div style="font-size:13px;letter-spacing:.12em;color:#ffffff;font-weight:700;opacity:.9;">${assigned ? "ASSIGNED TO YOU" : "NEW TICKET"}</div>
          <div style="font-size:22px;line-height:1.3;color:#ffffff;font-weight:800;margin-top:6px;word-break:break-word;overflow-wrap:anywhere;">${esc(p.title)}</div>
        </td></tr>
        <tr><td class="px" style="padding:20px 18px 8px;word-break:break-word;overflow-wrap:anywhere;">
          <p style="margin:0 0 8px;font-size:17px;font-weight:700;color:#111827;">Hi ${esc(p.recipientName || "there")},</p>
          <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#374151;">${
            assigned
              ? "A support ticket has been <strong>assigned to you</strong>. Please review it and reply to the customer."
              : `A new support ticket just arrived in <strong>${esc(p.orgName)}</strong>.`
          }</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;">
            <tr><td style="padding:4px 16px 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">${details}
              </table>
            </td></tr>
          </table>
          <div style="margin:16px 0;padding:14px 16px;border-radius:12px;background:#eff6ff;border:1px solid #bfdbfe;">
            <div style="font-size:13px;font-weight:700;color:#1e40af;margin-bottom:4px;">SUMMARY</div>
            <div style="font-size:15px;line-height:1.6;color:#374151;white-space:pre-wrap;">${esc(summary)}</div>
          </div>
          ${button}
          <p style="margin:14px 0 8px;font-size:13px;line-height:1.6;color:#6b7280;text-align:center;">Everyone on the team can also see this ticket on the dashboard.</p>
        </td></tr>
        <tr><td class="px" style="padding:16px 18px;background:#f8fafc;border-top:1px solid #e5e7eb;text-align:center;font-size:12px;line-height:1.6;color:#9ca3af;">
          ${esc(p.orgName)} · staff notification
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const subject = assigned ? `🎯 Assigned to you: #${ref} ${p.title}` : `🆕 New ticket #${ref}: ${p.title}`;
  return { subject, html };
}
