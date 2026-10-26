import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({ changeTicketStatus: vi.fn(), setTicketPriority: vi.fn() }));
vi.mock("@/lib/ticketActions", async (orig) => ({ ...(await orig<typeof import("@/lib/ticketActions")>()), ...actions }));
vi.mock("@/components/TicketTagsEditor", () => ({
  TicketTagsEditor: (p: { ticketId: string }) => <div data-testid="tags-editor">tags:{p.ticketId}</div>,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

import { TicketTable } from "./TicketTable";

const ticket = {
  id: "t1",
  organization_id: "o1",
  created_at: "2026-10-26T10:00:00Z",
  client_full_name: "Michael Bannerman",
  company_name: "—",
  email: "m@x.com",
  issue_title: "Live chat request",
  issue_category: "Live Chat",
  department: null,
  client_access_token: "tok",
  priority: "Moderate (single user or workaround available)",
  status: "Processing",
  resolution_due_at: null,
  sla_breached: false,
  assigned_to_user_id: null,
  ticket_tags: [{ tags: { id: "g1", name: "VIP", color: "#a855f7" } }],
  team_key: null,
};

const renderTable = (canAssign: boolean, onAssigned = vi.fn()) =>
  render(
    <MemoryRouter>
      <TicketTable
        tickets={[ticket] as never}
        isLoading={false}
        orgSlug="hv"
        orgName="HV"
        actorName="Les"
        canAssign={canAssign}
        onAssigned={onAssigned}
      />
    </MemoryRouter>,
  );

beforeEach(() => {
  actions.changeTicketStatus.mockReset();
  actions.setTicketPriority.mockReset();
  actions.changeTicketStatus.mockResolvedValue({ emailSent: true });
  actions.setTicketPriority.mockResolvedValue(true);
});

describe("TicketTable inline editing", () => {
  it("shows the short priority label instead of the long SLA text", () => {
    renderTable(false);
    expect(screen.getByText("Moderate")).toBeInTheDocument();
    expect(screen.queryByText(/single user or workaround/i)).not.toBeInTheDocument();
  });

  it("changes priority from the row", async () => {
    const onAssigned = vi.fn();
    renderTable(true, onAssigned);
    fireEvent.change(screen.getByLabelText("Priority for Live chat request"), {
      target: { value: "High impact or high urgency (major function degraded or deadline risk)" },
    });
    await waitFor(() =>
      expect(actions.setTicketPriority).toHaveBeenCalledWith("t1", "High impact or high urgency (major function degraded or deadline risk)"),
    );
    expect(onAssigned).toHaveBeenCalled();
  });

  it("changes status to New right away", async () => {
    renderTable(true);
    fireEvent.change(screen.getByLabelText("Status for Live chat request"), { target: { value: "New" } });
    await waitFor(() =>
      expect(actions.changeTicketStatus).toHaveBeenCalledWith(expect.objectContaining({ id: "t1" }), "New", { orgName: "HV", orgSlug: "hv", actorName: "Les" }),
    );
  });

  it("asks before closing, because closing emails the customer", async () => {
    renderTable(true);
    fireEvent.change(screen.getByLabelText("Status for Live chat request"), { target: { value: "Closed" } });
    expect(actions.changeTicketStatus).not.toHaveBeenCalled();
    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByText(/email the customer/i)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Close ticket" }));
    await waitFor(() => expect(actions.changeTicketStatus).toHaveBeenCalledWith(expect.anything(), "Closed", expect.anything()));
  });

  it("cancelling the close keeps the ticket as it was", () => {
    renderTable(true);
    fireEvent.change(screen.getByLabelText("Status for Live chat request"), { target: { value: "Closed" } });
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancel" }));
    expect(actions.changeTicketStatus).not.toHaveBeenCalled();
  });

  it("opens the tag picker from the row", () => {
    renderTable(true);
    expect(screen.getByText("VIP")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit tags for Live chat request" }));
    expect(screen.getByTestId("tags-editor")).toHaveTextContent("tags:t1");
  });

  it("is read-only for viewers", () => {
    renderTable(false);
    expect(screen.queryByLabelText("Priority for Live chat request")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Status for Live chat request")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Edit tags/ })).not.toBeInTheDocument();
  });
});
