import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { TicketTable } from "./TicketTable";

const ticket = {
  id: "t1",
  created_at: "2026-10-26T10:00:00Z",
  client_full_name: "Ann Lee",
  company_name: "Acme",
  issue_title: "Calendar not syncing",
  priority: "Moderate (single user or workaround available)",
  status: "New",
  resolution_due_at: null,
  sla_breached: false,
  assigned_to_user_id: null,
  ticket_tags: [],
  team_key: "ghl",
};

describe("TicketTable team label", () => {
  it("shows the routing team name on the row", () => {
    render(
      <MemoryRouter>
        <TicketTable tickets={[ticket] as never} isLoading={false} orgSlug="hv" teamNames={{ ghl: "GoHighLevel" }} />
      </MemoryRouter>,
    );
    expect(screen.getByText("GoHighLevel")).toBeInTheDocument();
  });

  it("shows no label for tickets without a team", () => {
    render(
      <MemoryRouter>
        <TicketTable tickets={[{ ...ticket, team_key: null }] as never} isLoading={false} orgSlug="hv" teamNames={{ ghl: "GoHighLevel" }} />
      </MemoryRouter>,
    );
    expect(screen.queryByText("GoHighLevel")).not.toBeInTheDocument();
  });
});
