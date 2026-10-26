import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

const signUp = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { signUp } } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import Signup from "./Signup";

function LoginEcho() {
  const state = useLocation().state as { from?: string } | null;
  return <p>login-from:{state?.from ?? "none"}</p>;
}

describe("Signup keeps the invitation", () => {
  it("passes the invite link on to Login when email confirmation is required", async () => {
    signUp.mockResolvedValue({ data: { session: null }, error: null });
    render(
      <MemoryRouter initialEntries={[{ pathname: "/signup", state: { from: "/invite/abc123" } }]}>
        <Routes>
          <Route path="/signup" element={<Signup />} />
          <Route path="/login" element={<LoginEcho />} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText("Full Name"), { target: { value: "Les" } });
    fireEvent.change(screen.getByLabelText("Work Email"), { target: { value: "les@x.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret123" } });
    fireEvent.submit(screen.getByLabelText("Password").closest("form")!);
    expect(await screen.findByText("login-from:/invite/abc123")).toBeInTheDocument();
    expect(signUp.mock.calls[0][0].options.emailRedirectTo).toBe(`${window.location.origin}/invite/abc123`);
  });
});
