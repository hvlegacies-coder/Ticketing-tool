import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ items: [] as unknown[] }));
vi.mock("@/hooks/useStaffNotifications", () => ({ useStaffNotifications: () => ({ items: state.items, count: state.items.length }) }));
vi.mock("@/hooks/useOrganization", () => ({ useOrganization: () => ({ organization: { id: "o", slug: "hv" }, role: "agent" }) }));
vi.mock("@/components/AppShell", () => ({ AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</> }));

import LiveChats from "./LiveChats";

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/app/hv/live-chats"]}>
      <Routes>
        <Route path="/app/:orgSlug/live-chats" element={<LiveChats />} />
        <Route path="/app/:orgSlug/ticket/:id" element={<p>ticket page</p>} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  state.items = [];
});

describe("LiveChats", () => {
  it("shows an empty state when nobody is waiting", () => {
    renderPage();
    expect(screen.getByText("No one is waiting right now")).toBeInTheDocument();
  });

  it("lists waiting customers and opens their ticket", () => {
    state.items = [
      { kind: "agent_requested", ticketId: "t1", customerName: "Ann Lee", preview: "hello?", at: new Date().toISOString() },
      { kind: "client_message", ticketId: "t2", customerName: "Bob", preview: "any update", at: new Date().toISOString() },
    ];
    renderPage();
    expect(screen.getByText("Wants an agent")).toBeInTheDocument();
    expect(screen.getByText("Unread message")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: /Ann Lee/ }));
    expect(screen.getByText("ticket page")).toBeInTheDocument();
  });
});
