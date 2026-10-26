import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke } } }));

import { inviteLink, sendInviteEmail } from "./invites";

const invite = { email: "les@x.com", role: "agent", token: "abc123" };

// Block body: returning the mock would make Vitest call it as a teardown.
beforeEach(() => {
  invoke.mockReset();
});


describe("inviteLink", () => {
  it("builds the accept link from the token", () => {
    expect(inviteLink("abc123")).toBe(`${window.location.origin}/invite/abc123`);
  });
});

describe("sendInviteEmail", () => {
  it("returns true when the email function succeeds", async () => {
    invoke.mockResolvedValue({ data: { success: true }, error: null });
    await expect(sendInviteEmail(invite, "HV")).resolves.toBe(true);
    expect(invoke).toHaveBeenCalledWith("send-invitation-email", {
      body: { email: "les@x.com", orgName: "HV", role: "agent", inviteLink: `${window.location.origin}/invite/abc123` },
    });
  });

  it("returns false when the function reports an error (invoke doesn't throw on HTTP errors)", async () => {
    invoke.mockResolvedValue({ data: null, error: new Error("Edge Function returned a non-2xx status code") });
    await expect(sendInviteEmail(invite, "HV")).resolves.toBe(false);
  });

  it("returns false when the call throws", async () => {
    invoke.mockImplementation(() => Promise.reject(new Error("network")));
    const sent = await sendInviteEmail(invite, "HV");
    expect(sent).toBe(false);
  });
});
