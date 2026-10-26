import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const chat = vi.hoisted(() => ({
  sendAiMessage: vi.fn(),
  createHandoffTicket: vi.fn(),
  saveLiveSession: vi.fn(),
  loadLiveSession: vi.fn(),
  clearLiveSession: vi.fn(),
  shrinkImage: vi.fn(),
  createTicketFromChat: vi.fn(),
  endChatByToken: vi.fn(),
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

const GREETING = /Type your question below and I'll walk you through it/;

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

  const draft = {
    title: "Refund status not updating",
    category: "Software/Application",
    priority: "Moderate (single user or workaround available)",
    summary: "Portal still shows Pending.",
  };

  it("renders inline and open when embedded", () => {
    render(<SupportChatWidget organizationId="org-1" embedded />);
    expect(screen.getByText(GREETING)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open support chat" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close chat" })).not.toBeInTheDocument();
  });

  it("submits the AI-prepared ticket once and shows the chat link", async () => {
    chat.sendAiMessage.mockResolvedValue({ reply: "I prepared a ticket.", handoff: false, ticketDraft: draft });
    let resolve!: (v: { ticketId: string; token: string }) => void;
    chat.createTicketFromChat.mockReturnValue(new Promise((r) => (resolve = r)));
    render(<SupportChatWidget organizationId="org-1" orgName="HV" embedded />);
    fireEvent.change(screen.getByPlaceholderText("Type a message…"), { target: { value: "refund stuck" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    expect(await screen.findByText("Refund status not updating")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Ann" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ann@x.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit ticket" }));
    fireEvent.click(screen.getByRole("button", { name: /Submit/ }));
    await act(async () => resolve({ ticketId: "abcd1234", token: "tok" }));
    expect(chat.createTicketFromChat).toHaveBeenCalledTimes(1);
    expect(chat.createTicketFromChat).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: "org-1", orgName: "HV", name: "Ann", email: "ann@x.com", draft }),
    );
    expect(await screen.findByText(/Ticket #ABCD1234 created/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /\/t\/tok/ })).toHaveAttribute("href", "/t/tok");
  });

  it("shows the backup message form when the AI is unavailable", async () => {
    chat.sendAiMessage.mockResolvedValue({ reply: "trouble", handoff: false, unavailable: true });
    chat.createTicketFromChat.mockResolvedValue({ ticketId: "abcd1234", token: "tok" });
    render(<SupportChatWidget organizationId="org-1" embedded />);
    fireEvent.change(screen.getByPlaceholderText("Type a message…"), { target: { value: "hello" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    expect(await screen.findByText("Send us a message")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Ann" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ann@x.com" } });
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "My refund is stuck since March." } });
    fireEvent.click(screen.getByRole("button", { name: "Send message to team" }));
    await waitFor(() =>
      expect(chat.createTicketFromChat).toHaveBeenCalledWith(
        expect.objectContaining({ draft: expect.objectContaining({ category: "Other", summary: "My refund is stuck since March." }) }),
      ),
    );
  });

  it("offers an Open a ticket quick action", () => {
    render(<SupportChatWidget organizationId="org-1" embedded />);
    expect(screen.getByRole("button", { name: /Open a ticket/ })).toBeInTheDocument();
  });

  it("Track ticket sends the number to the AI and shows Book a call for open tickets", async () => {
    chat.sendAiMessage.mockResolvedValue({
      reply: "Ticket #1A2B3C4D is still open. The team is still working on it.",
      handoff: false,
      trackedTicket: { ref: "1A2B3C4D", status: "Processing", bookingUrl: "https://cal.example/book" },
    });
    render(<SupportChatWidget organizationId="org-1" orgSlug="hv" embedded />);
    fireEvent.click(screen.getByRole("button", { name: /Track ticket/ }));
    fireEvent.change(screen.getByLabelText("Ticket number"), { target: { value: "#1a2b3c4d" } });
    fireEvent.click(screen.getByRole("button", { name: "Check status" }));
    expect(await screen.findByText(/The team is still working on it/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Book a call/ })).toHaveAttribute("href", "https://cal.example/book");
    const sent = chat.sendAiMessage.mock.calls[0][1];
    expect(sent[sent.length - 1].content).toBe("My ticket number is 1A2B3C4D");
  });

  it("shows Book a call when the AI offers a call", async () => {
    chat.sendAiMessage.mockResolvedValue({ reply: "Pick a time below.", handoff: false, bookingUrl: "https://cal.example/book" });
    render(<SupportChatWidget organizationId="org-1" embedded />);
    fireEvent.change(screen.getByPlaceholderText("Type a message…"), { target: { value: "I want to book a call" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    expect(await screen.findByRole("link", { name: /Book a call/ })).toHaveAttribute("href", "https://cal.example/book");
  });

  it("no Book a call button for closed tickets", async () => {
    chat.sendAiMessage.mockResolvedValue({ reply: "It's resolved.", handoff: false, trackedTicket: { ref: "1A2B3C4D", status: "Closed" } });
    render(<SupportChatWidget organizationId="org-1" orgSlug="hv" embedded />);
    fireEvent.change(screen.getByPlaceholderText("Type a message…"), { target: { value: "1A2B3C4D" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    expect(await screen.findByText("It's resolved.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Book a call/ })).not.toBeInTheDocument();
  });

  it("asks for 8 characters before looking anything up", () => {
    render(<SupportChatWidget organizationId="org-1" orgSlug="hv" embedded />);
    fireEvent.click(screen.getByRole("button", { name: /Track ticket/ }));
    fireEvent.change(screen.getByLabelText("Ticket number"), { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: "Check status" }));
    expect(screen.getByRole("alert")).toHaveTextContent("8 characters");
    expect(chat.sendAiMessage).not.toHaveBeenCalled();
  });

  it("shows 8-character ticket numbers after creating a ticket", async () => {
    chat.sendAiMessage.mockResolvedValue({ reply: "Prepared", handoff: false, ticketDraft: draft });
    chat.createTicketFromChat.mockResolvedValue({ ticketId: "abcd1234-0000-4000-8000-000000000000", token: "tok" });
    render(<SupportChatWidget organizationId="org-1" embedded />);
    fireEvent.change(screen.getByPlaceholderText("Type a message…"), { target: { value: "help" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    await screen.findByText("Refund status not updating");
    fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Ann" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ann@x.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit ticket" }));
    expect(await screen.findByText(/Ticket #ABCD1234 created/)).toBeInTheDocument();
  });

  it("no longer offers Track refund", () => {
    render(<SupportChatWidget organizationId="org-1" embedded />);
    expect(screen.queryByRole("button", { name: "Track refund" })).not.toBeInTheDocument();
  });

  it("sends the AI's chosen team with the live-agent handoff", async () => {
    chat.sendAiMessage.mockResolvedValue({ reply: "Connecting you", handoff: true, handoffTeam: "appointments" });
    chat.createHandoffTicket.mockResolvedValue({ ticketId: "abcd1234-0000", token: "tok" });
    render(<SupportChatWidget organizationId="org-1" embedded />);
    fireEvent.change(screen.getByPlaceholderText("Type a message…"), { target: { value: "reschedule please" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    await screen.findByText("Connecting you");
    fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Ann" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ann@x.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Connect me" }));
    await waitFor(() => expect(chat.createHandoffTicket).toHaveBeenCalledWith(expect.objectContaining({ teamKey: "appointments" })));
  });

  it("asks before ending the chat, then tells the agent side", async () => {
    chat.loadLiveSession.mockReturnValue({ ticketId: "abcd1234-0000", token: "tok", name: "Ann", email: "ann@x.com" });
    chat.endChatByToken.mockResolvedValue(true);
    render(<SupportChatWidget organizationId="org-1" embedded />);
    fireEvent.click(screen.getByRole("button", { name: "End chat" }));
    expect(screen.getByText("End this chat? Our team will be notified.")).toBeInTheDocument();
    expect(chat.endChatByToken).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Yes, end chat" }));
    await waitFor(() => expect(chat.endChatByToken).toHaveBeenCalledWith("tok"));
    expect(chat.clearLiveSession).toHaveBeenCalledWith("org-1");
    expect(await screen.findByText(GREETING)).toBeInTheDocument();
  });

  it("keeps the chat open when ending is cancelled", () => {
    chat.loadLiveSession.mockReturnValue({ ticketId: "abcd1234-0000", token: "tok", name: "Ann", email: "ann@x.com" });
    render(<SupportChatWidget organizationId="org-1" embedded />);
    fireEvent.click(screen.getByRole("button", { name: "End chat" }));
    fireEvent.click(screen.getByRole("button", { name: "Keep chatting" }));
    expect(chat.endChatByToken).not.toHaveBeenCalled();
    expect(screen.getByTestId("live-thread")).toBeInTheDocument();
  });
});
