import { describe, expect, it } from "vitest";
import { mergeNotifications } from "./useStaffNotifications";

const waitingT1 = { id: "t1", client_full_name: "Ann", issue_title: "Live chat request", agent_requested_at: "2026-10-20T10:00:00Z" };
const unreadOnT1 = { id: "m1", ticket_id: "t1", sender_name: "Ann", message: "hello?", created_at: "2026-10-20T10:01:00Z" };
const unreadOnT2 = { id: "m2", ticket_id: "t2", sender_name: "Bob", message: "any update", created_at: "2026-10-20T10:05:00Z" };

describe("mergeNotifications", () => {
  it("orders newest first and lists a waiting ticket once as agent_requested", () => {
    expect(mergeNotifications([waitingT1], [unreadOnT1, unreadOnT2]).map((n) => [n.kind, n.ticketId])).toEqual([
      ["client_message", "t2"],
      ["agent_requested", "t1"],
    ]);
  });

  it("shows the latest unread message as the waiting ticket's preview", () => {
    const [, waiting] = mergeNotifications([waitingT1], [unreadOnT1, unreadOnT2]);
    expect(waiting).toMatchObject({ customerName: "Ann", preview: "hello?", at: "2026-10-20T10:01:00Z" });
  });

  it("keeps one entry per ticket with the newest unread message", () => {
    const older = { ...unreadOnT2, id: "m0", message: "first", created_at: "2026-10-20T09:00:00Z" };
    expect(mergeNotifications([], [older, unreadOnT2])).toEqual([
      { kind: "client_message", ticketId: "t2", customerName: "Bob", preview: "any update", at: "2026-10-20T10:05:00Z" },
    ]);
  });
});
