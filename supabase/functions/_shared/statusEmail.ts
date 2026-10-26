// Pure builder for the suggestion status-change email (no Deno APIs).

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export function buildStatusEmail(input: {
  orgName: string;
  authorName: string;
  title: string;
  status: string;
  staffResponse: string | null;
  boardUrl: string;
}): { subject: string; html: string } {
  const e = {
    org: escapeHtml(input.orgName),
    name: escapeHtml(input.authorName),
    title: escapeHtml(input.title),
    status: escapeHtml(input.status),
    url: escapeHtml(input.boardUrl),
  };

  const response = input.staffResponse
    ? `<div style="margin:20px 0;padding:14px 16px;border:1px solid #f5c84c;border-radius:10px;background:#141a33;">
        <p style="margin:0 0 6px;font-size:11px;letter-spacing:.12em;color:#f5c84c;">OFFICIAL RESPONSE</p>
        <p style="margin:0;color:#dbe6ff;white-space:pre-wrap;">${escapeHtml(input.staffResponse)}</p>
      </div>`
    : "";

  const html = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:12px 8px;background:#070b1a;font-family:Inter,Arial,sans-serif;color:#dbe6ff;">
  <div style="max-width:560px;margin:0 auto;padding:22px 18px;border:1px solid #0e4a5a;border-radius:14px;background:#0a1228;word-break:break-word;overflow-wrap:anywhere;">
    <p style="margin:0 0 4px;font-size:12px;letter-spacing:.18em;color:#00e5ff;">${e.org.toUpperCase()} · SUGGESTIONS</p>
    <h1 style="margin:0 0 16px;font-size:20px;color:#ffffff;">Your idea has an update</h1>
    <p style="margin:0 0 12px;">Hi ${e.name},</p>
    <p style="margin:0 0 12px;">Your suggestion <strong>"${e.title}"</strong> is now
      <strong style="color:#f5c84c;">${e.status}</strong>.</p>
    ${response}
    <a href="${e.url}" style="display:inline-block;margin-top:8px;padding:10px 18px;border-radius:8px;background:#d4a017;color:#141005;font-weight:600;text-decoration:none;">View the board</a>
    <p style="margin:24px 0 0;font-size:11px;color:#6f84b8;">You're receiving this because you posted this suggestion.</p>
  </div>
</body>
</html>`;

  // Subject lines are plain text, not HTML, so they are not escaped.
  return { subject: `Your idea "${input.title}" is now ${input.status}`, html };
}
