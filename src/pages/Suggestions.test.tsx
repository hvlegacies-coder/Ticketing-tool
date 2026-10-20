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
  staff_response: "Shipping next month",
  responded_at: "2026-10-21T00:00:00Z",
};
const doneRow = { ...row, id: "s2", title: "Export CSV", status: "Done", staff_response: null, responded_at: null };
const similar = vi.hoisted(() => ({ rows: [] as unknown[] }));

function setup(voteResult: { data: unknown; error: unknown }, listError: unknown = null) {
  rpc.mockImplementation((fn: string) => {
    if (fn === "get_org_public_profile") return Promise.resolve({ data: [{ id: "o", name: "HV", slug: "hv", logo_url: null }], error: null });
    if (fn === "get_public_suggestions") return Promise.resolve(listError ? { data: null, error: listError } : { data: [row, doneRow], error: null });
    if (fn === "find_similar_suggestions") return Promise.resolve({ data: similar.rows, error: null });
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

describe("Suggestions v2", () => {
  it("shows the official response on the card", async () => {
    setup({ data: 4, error: null });
    expect(await screen.findByText("Shipping next month")).toBeInTheDocument();
    expect(screen.getByText("Official response")).toBeInTheDocument();
  });

  it("groups suggestions into roadmap columns", async () => {
    setup({ data: 4, error: null });
    await screen.findByText("Dark mode");
    fireEvent.click(screen.getByRole("button", { name: "Roadmap" }));
    const planned = screen.getByRole("region", { name: "Planned" });
    const done = screen.getByRole("region", { name: "Done" });
    expect(planned).toHaveTextContent("Dark mode");
    expect(done).toHaveTextContent("Export CSV");
    expect(planned).not.toHaveTextContent("Export CSV");
  });

  it("looks up similar ideas once after typing settles", async () => {
    similar.rows = [{ id: "s1", title: "Dark mode", status: "Planned", vote_count: 3 }];
    setup({ data: 4, error: null });
    fireEvent.click(await screen.findByRole("button", { name: /Suggest an improvement/ }));
    const title = screen.getByLabelText("Title");
    fireEvent.change(title, { target: { value: "dar" } });
    fireEvent.change(title, { target: { value: "dark" } });
    fireEvent.change(title, { target: { value: "dark mo" } });
    expect(await screen.findByText("Similar ideas — vote instead?")).toBeInTheDocument();
    const calls = rpc.mock.calls.filter(([fn]) => fn === "find_similar_suggestions");
    expect(calls).toHaveLength(1);
    expect(calls[0][1]).toEqual({ _slug: "hv", _query: "dark mo" });
  });
});
