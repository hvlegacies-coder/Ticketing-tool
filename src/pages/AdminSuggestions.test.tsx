import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[], update: vi.fn(), rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => {
  const chain = () => {
    const q: Record<string, unknown> = {};
    for (const m of ["select", "eq", "order"]) q[m] = () => q;
    (q as { then: unknown }).then = (res: (v: unknown) => void) => res({ data: db.rows, error: null });
    return q;
  };
  return {
    supabase: {
      from: () => ({
        select: () => chain(),
        update: (patch: unknown) => ({ eq: (_c: string, id: string) => Promise.resolve(db.update(patch, id) ?? { error: null }) }),
        delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
      }),
      rpc: db.rpc,
    },
  };
});
vi.mock("@/hooks/useOrganization", () => ({
  useOrganization: () => ({ organization: { id: "o", slug: "hv", name: "HV" }, role: "owner" }),
}));
vi.mock("@/components/AppShell", () => ({ AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import AdminSuggestions from "./AdminSuggestions";
import { STATUS_TEMPLATES } from "@/lib/suggestions";

const base = {
  organization_id: "o", author_name: "Ann", author_email: "ann@x.com", description: "d", category: "App",
  status: "Under review", is_hidden: false, vote_count: 1, created_at: "2026-10-20T00:00:00Z",
  staff_response: null, responded_at: null, merged_into: null,
};

// Radix Select calls these; jsdom lacks them.
Element.prototype.scrollIntoView ??= vi.fn();
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= vi.fn();

beforeEach(() => {
  db.rows = [
    { ...base, id: "a", title: "Add dark mode" },
    { ...base, id: "b", title: "Dark mode please" },
  ];
  db.update.mockReset();
  db.rpc.mockReset().mockResolvedValue({ data: 2, error: null });
});

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <AdminSuggestions />
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe("AdminSuggestions", () => {
  it("saves an official response", async () => {
    renderPage();
    const row = (await screen.findByText("Add dark mode")).closest("tr")!;
    fireEvent.click(within(row).getByRole("button", { name: "Respond to Add dark mode" }));
    fireEvent.change(screen.getByLabelText("Official response"), { target: { value: "On the roadmap" } });
    fireEvent.click(screen.getByRole("button", { name: "Save response" }));
    await waitFor(() => expect(db.update).toHaveBeenCalledWith({ staff_response: "On the roadmap" }, "a"));
  });

  it("fills the note from a template for the current status", async () => {
    renderPage();
    const row = (await screen.findByText("Add dark mode")).closest("tr")!;
    fireEvent.click(within(row).getByRole("button", { name: "Respond to Add dark mode" }));
    fireEvent.click(screen.getByRole("button", { name: STATUS_TEMPLATES["Under review"][0] }));
    expect(screen.getByLabelText("Official response")).toHaveValue(STATUS_TEMPLATES["Under review"][0]);
    fireEvent.click(screen.getByRole("button", { name: "Save response" }));
    await waitFor(() => expect(db.update).toHaveBeenCalledWith({ staff_response: STATUS_TEMPLATES["Under review"][0] }, "a"));
  });

  it("picking a status opens the note box and saves status and note together", async () => {
    renderPage();
    const row = (await screen.findByText("Add dark mode")).closest("tr")!;
    fireEvent.keyDown(within(row).getByRole("combobox", { name: "Status of Add dark mode" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("option", { name: "Planned" }));
    expect(await screen.findByText('Set status to "Planned"')).toBeInTheDocument();
    expect(db.update).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: STATUS_TEMPLATES.Planned[0] }));
    fireEvent.click(screen.getByRole("button", { name: "Save status & note" }));
    await waitFor(() => expect(db.update).toHaveBeenCalledWith({ status: "Planned", staff_response: STATUS_TEMPLATES.Planned[0] }, "a"));
  });

  it("can change the status without a note", async () => {
    renderPage();
    const row = (await screen.findByText("Add dark mode")).closest("tr")!;
    fireEvent.keyDown(within(row).getByRole("combobox", { name: "Status of Add dark mode" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("option", { name: "Done" }));
    fireEvent.click(await screen.findByRole("button", { name: "Change status without note" }));
    await waitFor(() => expect(db.update).toHaveBeenCalledWith({ status: "Done" }, "a"));
  });

  it("merges a suggestion into another one", async () => {
    renderPage();
    const row = (await screen.findByText("Add dark mode")).closest("tr")!;
    fireEvent.click(within(row).getByRole("button", { name: "Merge Add dark mode" }));
    fireEvent.click(screen.getByRole("option", { name: /Dark mode please/ }));
    fireEvent.click(screen.getByRole("button", { name: "Merge" }));
    await waitFor(() => expect(db.rpc).toHaveBeenCalledWith("merge_suggestion", { _from: "a", _into: "b" }));
  });

  it("does not offer the suggestion itself as a merge target", async () => {
    renderPage();
    const row = (await screen.findByText("Add dark mode")).closest("tr")!;
    fireEvent.click(within(row).getByRole("button", { name: "Merge Add dark mode" }));
    expect(screen.queryByRole("option", { name: /Add dark mode/ })).not.toBeInTheDocument();
  });

  it("labels a merged suggestion with its target", async () => {
    db.rows[0] = { ...db.rows[0], is_hidden: true, merged_into: "b" };
    renderPage();
    expect(await screen.findByText("Merged into: Dark mode please")).toBeInTheDocument();
  });
});
