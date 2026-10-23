import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: () => Promise.resolve({ data: [{ id: "o", name: "HV", slug: "hv", logo_url: null }], error: null }) },
}));
vi.mock("@/components/SupportChatWidget", () => ({
  SupportChatWidget: (p: { embedded?: boolean; orgName?: string }) => (
    <div data-testid="chat">{p.embedded ? "embedded" : "floating"}:{p.orgName}</div>
  ),
}));

import SupportPortal from "./SupportPortal";

const renderPortal = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={["/support/hv"]}>
        <Routes>
          <Route path="/support/:orgSlug" element={<SupportPortal />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe("SupportPortal", () => {
  it("embeds the AI chat as the main panel", async () => {
    renderPortal();
    expect(await screen.findByTestId("chat")).toHaveTextContent("embedded:HV");
    expect(screen.getAllByTestId("chat")).toHaveLength(1);
  });

  it("no longer shows the ticket form", async () => {
    renderPortal();
    await screen.findByTestId("chat");
    expect(screen.queryByText("Submit a Support Ticket")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Full Name/)).not.toBeInTheDocument();
  });
});
