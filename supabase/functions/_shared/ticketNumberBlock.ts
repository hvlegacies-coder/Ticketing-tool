// Email block that makes the ticket number obvious and explains Track ticket
// in plain numbered steps (many customers aren't tech-savvy).
// Pure (no Deno APIs) so Vitest can test it.

const escapeAttr = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function ticketNumberBlock(ticketId: string, portalUrl: string | undefined): string {
  const ref = ticketId.slice(0, 8).toUpperCase();
  const safeUrl = portalUrl && /^https?:\/\//i.test(portalUrl) ? escapeAttr(portalUrl) : null;

  const step = (n: number, text: string) => `
          <tr>
            <td style="width:40px;padding:6px 0;vertical-align:top;">
              <span style="display:inline-block;width:30px;height:30px;line-height:30px;border-radius:50%;background:#111827;color:#ffd84d;font-size:16px;font-weight:700;text-align:center;">${n}</span>
            </td>
            <td style="padding:6px 0;font-size:17px;line-height:1.45;color:#111827;text-align:left;">${text}</td>
          </tr>`;

  const button = safeUrl
    ? `<a href="${safeUrl}" style="display:block;margin:18px 0 0;padding:16px 20px;border-radius:12px;background:#111827;color:#ffd84d;font-size:19px;font-weight:700;text-align:center;text-decoration:none;">👉 Open support chat</a>`
    : "";

  return `
      <div style="margin:0 0 28px;padding:24px 22px;border:4px solid #d4a017;border-radius:16px;background:#fff3b0;text-align:center;">
        <p style="margin:0 0 6px;font-size:15px;letter-spacing:.12em;color:#7c2d12;font-weight:800;">⭐ YOUR TICKET NUMBER ⭐</p>
        <p style="margin:0 auto;display:inline-block;padding:10px 18px;border:2px dashed #b45309;border-radius:10px;background:#ffffff;font-family:'Courier New',monospace;font-size:44px;font-weight:800;letter-spacing:.16em;color:#111827;">${ref}</p>
        <p style="margin:12px 0 8px;font-size:17px;font-weight:700;color:#111827;">Save this number. To check your ticket anytime:</p>
        <table role="presentation" style="margin:0 auto;border-collapse:collapse;">${step(1, safeUrl ? "Tap the button below." : "Open our support page.")}${step(2, "Tap <strong>Track ticket</strong>.")}${step(3, `Type <strong style="font-family:'Courier New',monospace;letter-spacing:.1em;">${ref}</strong> and tap <strong>Check status</strong>.`)}
        </table>
        ${button}
      </div>`;
}
