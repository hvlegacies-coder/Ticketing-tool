// Email block that makes the ticket number obvious and explains how to check
// it in the support chat, in plain numbered steps (many customers aren't tech-savvy). Sized to fit a
// 320px phone: the 8-character number is ~210px wide at most.
// Pure (no Deno APIs) so Vitest can test it.

const escapeAttr = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function ticketNumberBlock(ticketId: string, portalUrl: string | undefined): string {
  const ref = ticketId.slice(0, 8).toUpperCase();
  const safeUrl = portalUrl && /^https?:\/\//i.test(portalUrl) ? escapeAttr(portalUrl) : null;

  const step = (n: number, text: string) => `
          <tr>
            <td style="width:36px;padding:6px 0;vertical-align:top;">
              <span style="display:inline-block;width:28px;height:28px;line-height:28px;border-radius:50%;background:#111827;color:#ffd84d;font-size:15px;font-weight:700;text-align:center;">${n}</span>
            </td>
            <td style="padding:6px 0;font-size:16px;line-height:1.45;color:#111827;text-align:left;">${text}</td>
          </tr>`;

  const button = safeUrl
    ? `<div style="margin:16px 0 0;font-size:16px;font-weight:700;color:#111827;">This is the fastest way you can connect to us</div><a href="${safeUrl}" style="display:block;box-sizing:border-box;width:100%;max-width:100%;margin:8px 0 0;padding:14px 12px;border-radius:12px;background:#111827;color:#ffd84d;font-size:17px;font-weight:700;text-align:center;text-decoration:none;">👉 Open support chat</a>`
    : "";

  return `
      <div style="margin:0 0 22px;padding:18px 14px;border:3px solid #d4a017;border-radius:16px;background:#fff3b0;text-align:center;">
        <div style="margin:0 0 8px;font-size:14px;letter-spacing:.1em;color:#7c2d12;font-weight:800;">⭐ YOUR TICKET NUMBER ⭐</div>
        <div style="display:inline-block;max-width:100%;box-sizing:border-box;padding:8px 12px;border:2px dashed #b45309;border-radius:10px;background:#ffffff;font-family:'Courier New',Courier,monospace;font-size:30px;line-height:1.2;font-weight:800;letter-spacing:4px;color:#111827;white-space:nowrap;">${ref}</div>
        <div style="margin:12px 0 6px;font-size:16px;font-weight:700;color:#111827;">Save this number. To check your ticket anytime:</div>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;border-collapse:collapse;">${step(1, safeUrl ? "Tap the button below." : "Open our support page.")}${step(2, `Type <strong style="font-family:'Courier New',Courier,monospace;letter-spacing:1px;">${ref}</strong> in the chat and send it.`)}
        </table>
        ${button}
      </div>`;
}
