import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  teams: [] as Record<string, unknown>[],
  links: [] as Record<string, unknown>[],
  insert: vi.fn(),
  del: vi.fn(),
  update: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => {
  const list = (rows: () => unknown[]) => {
    const q: Record<string, unknown> = {};
    for (const m of ["select", "eq", "in", "order"]) q[m] = () => q;
    (q as { then: unknown }).then = (res: (v: unknown) => void) => res({ data: rows(), error: null });
    return q;
  };
  return {
    supabase: {
      from: (table: string) => ({
        select: () => list(() => (table === "routing_teams" ? db.teams : db.links)),
        insert: (row: unknown) => Promise.resolve(db.insert(table, row) ?? { error: null }),
        update: (patch: unknown) => ({ eq: (_c: string, id: string) => Promise.resolve(db.update(table, patch, id) ?? { error: null }) }),
        delete: () => ({
          eq: (_c1: string, v1: string) => ({ eq: (_c2: string, v2: string) => Promise.resolve(db.del(table, v1, v2) ?? { error: null }) }),
        }),
      }),
    },
  };
});
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { RoutingTeams, staffOptions } from "./RoutingTeams";

const members = [
  { user_id: "u-owner", role: "owner", profiles: { full_name: "Jay", email: "jay@x.com" } },
  { user_id: "u-les", role: "agent", profiles: { full_name: "Les", email: "les@x.com" } },
  { user_id: "u-viewer", role: "viewer", profiles: { full_name: "Vic", email: "vic@x.com" } },
];

beforeEach(() => {
  db.teams = [
    { id: "t-ghl", key: "ghl", name: "GoHighLevel", description: "Anything GHL.", sort: 1 },
    { id: "t-apps", key: "apps", name: "Apps", description: "Our apps.", sort: 2 },
  ];
  db.links = [{ team_id: "t-ghl", user_id: "u-les" }];
  db.insert.mockReset();
  db.del.mockReset();
  db.update.mockReset();
});

const renderIt = (canManage = true) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RoutingTeams orgId="o" members={members} canManage={canManage} />
    </QueryClientProvider>,
  );

describe("staffOptions", () => {
  it("offers staff (not viewers) who aren't on the team yet", () => {
    expect(staffOptions(members, ["u-les"]).map((m) => m.user_id)).toEqual(["u-owner"]);
  });
});

describe("RoutingTeams", () => {
  it("lists each team with its members and an empty-team fallback note", async () => {
    renderIt();
    const ghl = (await screen.findByText("GoHighLevel")).closest("section")!;
    expect(within(ghl).getByText("Les")).toBeInTheDocument();
    const apps = screen.getByText("Apps").closest("section")!;
    expect(within(apps).getByText(/No one yet — tickets go to the owner/)).toBeInTheDocument();
  });

  it("adds a staff member to a team", async () => {
    renderIt();
    const apps = (await screen.findByText("Apps")).closest("section")!;
    fireEvent.change(within(apps).getByLabelText("Add member to Apps"), { target: { value: "u-owner" } });
    await waitFor(() => expect(db.insert).toHaveBeenCalledWith("routing_team_members", { team_id: "t-apps", user_id: "u-owner" }));
  });

  it("removes a member from a team", async () => {
    renderIt();
    const ghl = (await screen.findByText("GoHighLevel")).closest("section")!;
    fireEvent.click(within(ghl).getByRole("button", { name: "Remove Les from GoHighLevel" }));
    await waitFor(() => expect(db.del).toHaveBeenCalledWith("routing_team_members", "t-ghl", "u-les"));
  });

  it("saves an edited team description", async () => {
    renderIt();
    const ghl = (await screen.findByText("GoHighLevel")).closest("section")!;
    const box = within(ghl).getByLabelText("What GoHighLevel handles");
    fireEvent.change(box, { target: { value: "GHL workflows and calendars." } });
    fireEvent.blur(box);
    await waitFor(() =>
      expect(db.update).toHaveBeenCalledWith("routing_teams", { description: "GHL workflows and calendars." }, "t-ghl"),
    );
  });

  it("is read-only for non-admins", async () => {
    renderIt(false);
    await screen.findByText("GoHighLevel");
    expect(screen.queryByLabelText("Add member to Apps")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Remove Les/ })).not.toBeInTheDocument();
  });
});
