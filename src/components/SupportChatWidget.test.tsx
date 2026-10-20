import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const chat = vi.hoisted(() => ({
  sendAiMessage: vi.fn(),
  createHandoffTicket: vi.fn(),
  saveLiveSession: vi.fn(),
  loadLiveSession: vi.fn(),
  clearLiveSession: vi.fn(),
  shrinkImage: vi.fn(),
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

  it("sends a photo with its caption to the AI", async () => {
    chat.shrinkImage.mockResolvedValue({ media_type: "image/jpeg", data: "QUJD", previewUrl: "data:image/jpeg;base64,QUJD" });
    chat.sendAiMessage.mockResolvedValue({ reply: "I see a W-2 with Box 1 blank.", handoff: false });
    render(<SupportChatWidget organizationId="org-1" />);
    openWidget();
    const file = new File(["x"], "w2.jpg", { type: "image/jpeg" });
    fireEvent.change(screen.getByLabelText("Photo file"), { target: { files: [file] } });
    expect(await screen.findByAltText("Photo to send")).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("Type a message…"), { target: { value: "is this right?" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    expect(await screen.findByText("I see a W-2 with Box 1 blank.")).toBeInTheDocument();
    const sent = chat.sendAiMessage.mock.calls[0][1];
    expect(sent[sent.length - 1]).toMatchObject({ role: "user", content: "is this right?", image: { data: "QUJD" } });
    expect(screen.getByAltText("Your photo")).toBeInTheDocument();
  });

  it("explains when a photo can't be used", async () => {
    chat.shrinkImage.mockRejectedValue(new Error("too_large"));
    render(<SupportChatWidget organizationId="org-1" />);
    openWidget();
    fireEvent.change(screen.getByLabelText("Photo file"), { target: { files: [new File(["x"], "big.jpg", { type: "image/jpeg" })] } });
    expect(await screen.findByRole("alert")).toHaveTextContent("That photo is too large (max 10 MB).");
  });

  it("offers a Send a photo quick action instead of Upload docs", () => {
    render(<SupportChatWidget organizationId="org-1" />);
    openWidget();
    expect(screen.getByRole("button", { name: /Send a photo/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Upload docs" })).not.toBeInTheDocument();
  });
});
