import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { buildNavSections } from "@/lib/navigation";
import { NeonRail } from "./NeonRail";

const renderRail = (path = "/app/hv/suggestions", onSignOut = vi.fn()) =>
  render(
    <MemoryRouter>
      <NeonRail
        sections={buildNavSections("owner", "hv", { waiting: 3, unread: 0, suggestions: 4 })}
        activePath={path}
        orgName="Higher View Legacy"
        roleLabel="Owner"
        userLabel="jay@x.com"
        onSignOut={onSignOut}
      />
    </MemoryRouter>,
  );

describe("NeonRail", () => {
  it("renders the section headings", () => {
    renderRail();
    for (const t of ["WORKSPACE", "CUSTOMERS", "ADMIN"]) expect(screen.getByText(t)).toBeInTheDocument();
  });

  it("marks only the current page as active", () => {
    renderRail();
    expect(screen.getByRole("link", { name: /Suggestions/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /Dashboard/ })).not.toHaveAttribute("aria-current");
  });

  it("shows live badge counts in the link names", () => {
    renderRail();
    expect(screen.getByRole("link", { name: "Dashboard, 3 new" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Suggestions, 4 new" })).toBeInTheDocument();
  });

  it("shows the org, role and user, and signs out", () => {
    const onSignOut = vi.fn();
    renderRail("/app/hv/dashboard", onSignOut);
    expect(screen.getByText("Higher View Legacy")).toBeInTheDocument();
    expect(screen.getByText("jay@x.com")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(onSignOut).toHaveBeenCalled();
  });
});
