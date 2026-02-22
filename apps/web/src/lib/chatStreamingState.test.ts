import { describe, it, expect } from "vitest";
import { isStreamingForChat } from "./chatStreamingState";

describe("isStreamingForChat", () => {
  it("returns true when pending and viewing the chat we are sending to", () => {
    expect(isStreamingForChat(true, "chat-a", "chat-a")).toBe(true);
  });

  it("returns false when pending but viewing a different chat", () => {
    expect(isStreamingForChat(true, "chat-a", "chat-b")).toBe(false);
  });

  it("returns false when not pending", () => {
    expect(isStreamingForChat(false, "chat-a", "chat-a")).toBe(false);
  });

  it("returns false when currentChatId is undefined", () => {
    expect(isStreamingForChat(true, "chat-a", undefined)).toBe(false);
  });

  it("returns false when sendingToChatId is null", () => {
    expect(isStreamingForChat(true, null, "chat-a")).toBe(false);
  });

  it("each chat has its own loading state - chat B does not show loading when chat A is streaming", () => {
    // Simulate: user sent from chat A, then navigated to chat B
    const sendingToChatA = "chat-a";
    const viewingChatB = "chat-b";
    const mutationStillPending = true;

    expect(isStreamingForChat(mutationStillPending, sendingToChatA, viewingChatB)).toBe(false);
  });

  it("chat A shows loading when user sent from chat A and is still viewing it", () => {
    const sendingToChatA = "chat-a";
    const viewingChatA = "chat-a";
    const mutationStillPending = true;

    expect(isStreamingForChat(mutationStillPending, sendingToChatA, viewingChatA)).toBe(true);
  });
});
