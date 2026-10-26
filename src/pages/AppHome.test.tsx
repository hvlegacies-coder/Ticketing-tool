import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  rpc: vi.fn(),
  orgs: [] as { organization: { slug: string; name: string } }[],
  invalidate: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: m.rpc } }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1", email: "les@x.com" }, signOut: vi.fn() }) }));
vi.mock("@/hooks/useOrganization", () => ({
  useMyOrganizations: () => ({ data: m.orgs, isLoading: false, invalidate: m.invalidate }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import AppHome from "./AppHome";

const renderHome = () =>
  render(
    <MemoryRouter initialEntries={["/app"]}>
      <Routes>
        <Route path="/app" element={<AppHome />} />
        <Route path="/app/:slug/dashboard" element={<p>dashboard</p>} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  m.rpc.mockReset();
  m.invalidate.mockReset();
  m.orgs = [];
});

describe("AppHome", () => {
  it("joins a pending invitation and opens that org instead of asking to create one", async () => {
    m.rpc.mockResolvedValue({ data: [{ organization_id: "o1", slug: "higher-view-legacy", role: "agent" }], error: null });
    renderHome();
    expect(await screen.findByText("dashboard")).toBeInTheDocument();
    expect(m.rpc).toHaveBeenCalledWith("accept_my_pending_invitations");
    expect(m.rpc).toHaveBeenCalledTimes(1);
    expect(m.invalidate).toHaveBeenCalled();
  });

  it("prefers the newly joined org over an org the person created by mistake", async () => {
    m.orgs = [{ organization: { slug: "my-own-org", name: "Mine" } }];
    m.rpc.mockResolvedValue({ data: [{ organization_id: "o1", slug: "higher-view-legacy", role: "agent" }], error: null });
    render(
      <MemoryRouter initialEntries={["/app"]}>
        <Routes>
          <Route path="/app" element={<AppHome />} />
          <Route path="/app/:slug/dashboard" element={<SlugEcho />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText("org:higher-view-legacy")).toBeInTheDocument();
  });

  it("shows create-organization only when there is no invitation and no org", async () => {
    m.rpc.mockResolvedValue({ data: [], error: null });
    renderHome();
    await waitFor(() => expect(m.rpc).toHaveBeenCalled());
    expect(await screen.findByLabelText(/Organization name/i)).toBeInTheDocument();
  });

  it("still works if the invitation check fails", async () => {
    m.rpc.mockResolvedValue({ data: null, error: { message: "down" } });
    m.orgs = [{ organization: { slug: "higher-view-legacy", name: "HV" } }];
    renderHome();
    expect(await screen.findByText("dashboard")).toBeInTheDocument();
  });
});

import { useParams } from "react-router-dom";
function SlugEcho() {
  const { slug } = useParams();
  return <p>org:{slug}</p>;
}
