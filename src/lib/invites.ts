import { supabase } from "@/integrations/supabase/client";

export const inviteLink = (token: string) => `${window.location.origin}/invite/${token}`;

/**
 * Sends (or resends) the invitation email. Returns false on failure:
 * supabase.functions.invoke resolves with { error } on HTTP errors instead of throwing.
 */
export async function sendInviteEmail(
  invite: { email: string; role: string; token: string },
  orgName: string | undefined,
): Promise<boolean> {
  try {
    const { error } = await supabase.functions.invoke("send-invitation-email", {
      body: { email: invite.email, orgName, role: invite.role, inviteLink: inviteLink(invite.token) },
    });
    if (error) console.error("Invite email failed:", error);
    return !error;
  } catch (err) {
    console.error("Invite email failed:", err);
    return false;
  }
}
