import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import Suggestions from "./Suggestions";

const row = {
  id: "s1",
  title: "Dark mode",
  description: "Please",
  category: "App",
  status: "Planned",
  vote_count: 3,
  author_name: "Ann",
  created_at: "2026-10-20T00:00:00Z",
};

function setup(voteResult: { data: unknown; error: unknown }, listError: unknown = null) {
  rpc.mockImplementation((fn: string) => {
    if (fn === "get_org_public_profile") return Promise.resolve({ data: [{ id: "o", name: "HV", slug: "hv", logo_url: null }], error: null });
    if (fn === "get_public_suggestions") return Promise.resolve(listError ? { data: null, error: listError } : { data: [row], error: null });
    if (fn === "vote_suggestion") return Promise.resolve(voteResult);
    return Promise.resolve({ data: null, error: null });
  });
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={["/support/hv/suggestions"]}>
        <Routes>
          <Route path="/support/:orgSlug/suggestions" element={<Suggestions />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  rpc.mockReset();
  localStorage.setItem("hv-voter-email", "voter@x.com");
});

describe("Suggestions voting", () => {
  it("votes once even when the button is clicked twice", async () => {
    setup({ data: 4, error: null });
    const btn = await screen.findByRole("button", { name: /Upvote Dark mode/ });
    fireEvent.click(btn);
    fireEvent.click(btn);
    await waitFor(() => expect(screen.getByRole("button", { name: /Upvote Dark mode \(4 votes\)/ })).toBeDisabled());
    expect(rpc.mock.calls.filter(([fn]) => fn === "vote_suggestion")).toHaveLength(1);
  });

  it("reverts the optimistic vote when the server rejects it", async () => {
    setup({ data: null, error: { message: "boom" } });
    fireEvent.click(await screen.findByRole("button", { name: /Upvote Dark mode/ }));
    await waitFor(() => expect(screen.getByRole("button", { name: /Upvote Dark mode \(3 votes\)/ })).toBeEnabled());
  });

  it("shows an error message when the list fails to load", async () => {
    setup({ data: null, error: null }, { message: "function not found" });
    expect(
      await screen.findByText("Couldn't load suggestions. Please refresh the page.", {}, { timeout: 4000 }),
    ).toBeInTheDocument();
  });
});
