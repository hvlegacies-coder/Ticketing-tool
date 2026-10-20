// Builds a link into the web app. Pure (no Deno APIs) so Vitest can test it;
// callers pass Deno.env.get("PUBLIC_APP_URL").
export function appUrl(path: string, base = ""): string {
  if (!base) throw new Error("PUBLIC_APP_URL not set");
  return `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}
