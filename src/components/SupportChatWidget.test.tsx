import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const chat = vi.hoisted(() => ({
  sendAiMessage: vi.fn(),
  createHandoffTicket: vi.fn(),
  saveLiveSession: vi.fn(),
  loadLiveSession: vi.fn(),
  clearLiveSession: vi.fn(),
}));
vi.mock("@/lib/supportChat", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/supportChat")>()),
  ...chat,
}));

// Capture the live thread's props so tests can simulate an agent joining.
const live = vi.hoisted(() => ({ props: null as null | { token: string; onSupportJoined?: (n: string) => void } }));
vi.mock("@/components/ClientTicketMessages", () => ({
  ClientTicketMessages: (props: { token: string; onSupportJoined?: (n: string) => void }) => {
    live.props = props;
    return <div data-testid="live-thread">thread:{props.token}</div>;
  },
}));

import { SupportChatWidget } from "./SupportChatWidget";

const GREETING = "Hi! Describe your issue and I'll help — or connect you to a person.";

beforeEach(() => {
  Object.values(chat).forEach((fn) => fn.mockReset());
  chat.loadLiveSession.mockReturnValue(null);
  live.props = null;
});

const openWidget = () => fireEvent.click(screen.getByRole("button", { name: "Open support chat" }));

const submitHandoff = () => {
  fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Ann Lee" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ann@x.com" } });
  fireEvent.click(screen.getByRole("button", { name: "Connect me" }));
};

describe("SupportChatWidget", () => {
  it("shows the greeting after opening", () => {
    render(<SupportChatWidget organizationId="org-1" />);
    openWidget();
    expect(screen.getByText(GREETING)).toBeInTheDocument();
  });

  it("shows the handoff form when Talk to an agent is clicked", () => {
    render(<SupportChatWidget organizationId="org-1" />);
    openWidget();
    fireEvent.click(screen.getByRole("button", { name: /Talk to an agent/ }));
    expect(screen.getByLabelText("Your name")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });

  it("creates only one ticket when the handoff form is submitted twice", async () => {
    let resolve!: (v: { ticketId: string; token: string }) => void;
    chat.createHandoffTicket.mockReturnValue(new Promise((r) => (resolve = r)));
    render(<SupportChatWidget organizationId="org-1" />);
    openWidget();
    fireEvent.click(screen.getByRole("button", { name: /Talk to an agent/ }));
    submitHandoff();
    fireEvent.click(screen.getByRole("button", { name: /Connect/ }));
    await act(async () => resolve({ ticketId: "abcd1234", token: "tok" }));
    expect(chat.createHandoffTicket).toHaveBeenCalledTimes(1);
  });

  it("switches to the live thread and saves the session after handoff", async () => {
    chat.createHandoffTicket.mockResolvedValue({ ticketId: "abcd1234", token: "tok" });
    render(<SupportChatWidget organizationId="org-1" />);
    openWidget();
    fireEvent.click(screen.getByRole("button", { name: /Talk to an agent/ }));
    submitHandoff();
    expect(await screen.findByTestId("live-thread")).toHaveTextContent("thread:tok");
    expect(chat.saveLiveSession).toHaveBeenCalledWith("org-1", {
      ticketId: "abcd1234",
      token: "tok",
      name: "Ann Lee",
      email: "ann@x.com",
    });
    expect(chat.createHandoffTicket).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: "org-1", name: "Ann Lee", email: "ann@x.com" }),
    );
  });

  it("resumes a saved live session on mount without the AI greeting", () => {
    chat.loadLiveSession.mockReturnValue({ ticketId: "abcd1234", token: "tok", name: "Ann", email: "ann@x.com" });
    render(<SupportChatWidget organizationId="org-1" />);
    expect(screen.getByTestId("live-thread")).toHaveTextContent("thread:tok");
    expect(screen.queryByText(GREETING)).not.toBeInTheDocument();
  });

  it("shows the handoff form when the AI requests a human", async () => {
    chat.sendAiMessage.mockResolvedValue({ reply: "Connecting you", handoff: true });
    render(<SupportChatWidget organizationId="org-1" />);
    openWidget();
    fireEvent.change(screen.getByPlaceholderText("Type a message…"), { target: { value: "I want a person" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    expect(await screen.findByText("Connecting you")).toBeInTheDocument();
    expect(screen.getByLabelText("Your name")).toBeInTheDocument();
  });

  it("shows waiting state, then an agent-joined line once", async () => {
    chat.loadLiveSession.mockReturnValue({ ticketId: "abcd1234", token: "tok", name: "Ann", email: "ann@x.com" });
    render(<SupportChatWidget organizationId="org-1" />);
    expect(screen.getByText("Waiting for an agent…")).toBeInTheDocument();
    act(() => live.props!.onSupportJoined!("Maria"));
    await waitFor(() => expect(screen.getAllByText("⚡ Maria joined the chat")).toHaveLength(1));
    expect(screen.queryByText("Waiting for an agent…")).not.toBeInTheDocument();
  });
});
