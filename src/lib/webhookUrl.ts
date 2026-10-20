// Frontend copy of supabase/functions/_shared/webhookPayload.ts#isValidWebhookUrl
// (the browser bundle must not import from supabase/functions).
export function isValidWebhookUrl(url: string | null): boolean {
  if (!url) return false;
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}
