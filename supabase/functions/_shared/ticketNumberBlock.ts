// Email block that makes the ticket number obvious and explains Track ticket.
// Pure (no Deno APIs) so Vitest can test it.

const escapeAttr = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function ticketNumberBlock(ticketId: string, portalUrl: string | undefined): string {
  const ref = ticketId.slice(0, 8).toUpperCase();
  const safeUrl = portalUrl && /^https?:\/\//i.test(portalUrl) ? escapeAttr(portalUrl) : null;
  const button = safeUrl
    ? `<a href="${safeUrl}" style="display:inline-block;margin-top:12px;padding:10px 20px;border-radius:8px;background:#d4a017;color:#141005;font-weight:700;font-size:14px;text-decoration:none;">Open support chat</a>`
    : "";
  return `
      <div style="margin:0 0 24px;padding:18px 20px;border:2px solid #d4a017;border-radius:12px;background:#fffbeb;text-align:center;">
        <p style="margin:0 0 4px;font-size:11px;letter-spacing:.14em;color:#92400e;font-weight:700;">YOUR TICKET NUMBER</p>
        <p style="margin:0;font-family:'Courier New',monospace;font-size:30px;font-weight:700;letter-spacing:.18em;color:#111827;">${ref}</p>
        <p style="margin:10px 0 0;font-size:13px;color:#4b5563;line-height:1.5;">Track it anytime: open our support chat, tap <strong>Track ticket</strong> and type this number.</p>
        ${button}
      </div>`;
}
