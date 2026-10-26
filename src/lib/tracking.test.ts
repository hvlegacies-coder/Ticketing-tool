import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));

import { formatTicketRef, normalizeTicketRef, trackTicket } from "./tracking";

// Block body: returning the mock would make Vitest call it as a teardown.
beforeEach(() => {
  rpc.mockReset();
});

describe("normalizeTicketRef", () => {
  it.each([
    ["1a2b3c4d", "1A2B3C4D"],
    ["#1A2B3C4D", "1A2B3C4D"],
    [" 1a2b 3c4d ", "1A2B3C4D"],
  ])("%s -> %s", (input, out) => {
    expect(normalizeTicketRef(input)).toBe(out);
  });

  it.each(["1A2B", "1A2B3C4D5", "ZZZZZZZZ", ""])("rejects %s", (input) => {
    expect(normalizeTicketRef(input)).toBeNull();
  });
});

describe("formatTicketRef", () => {
  it("uses the first 8 characters of the id, uppercase", () => {
    expect(formatTicketRef("1a2b3c4d-0000-4000-8000-000000000001")).toBe("1A2B3C4D");
  });
});

describe("trackTicket", () => {
  it("returns the status row for a match", async () => {
    const row = { ticket_ref: "1A2B3C4D", status: "Open", created_at: "x", updated_at: "y", team_replied: true };
    rpc.mockResolvedValue({ data: [row], error: null });
    await expect(trackTicket("hv", "#1a2b3c4d")).resolves.toEqual(row);
    expect(rpc).toHaveBeenCalledWith("track_ticket", { _slug: "hv", _ticket_ref: "1A2B3C4D" });
  });

  it("returns null when nothing matches", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    await expect(trackTicket("hv", "1A2B3C4D")).resolves.toBeNull();
  });

  it("does not call the server for a malformed number", async () => {
    await expect(trackTicket("hv", "12")).resolves.toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("throws when the lookup itself fails", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "down" } });
    await expect(trackTicket("hv", "1A2B3C4D")).rejects.toThrow("down");
  });
});
