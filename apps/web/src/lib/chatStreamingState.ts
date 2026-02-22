/**
 * Derives whether the current chat view should show streaming/loading state.
 * Each chat has its own CLI instance, so loading state is scoped per chat:
 * only show when we're viewing the chat we're sending to.
 */
export function isStreamingForChat(
  isPending: boolean,
  sendingToChatId: string | null,
  currentChatId: string | undefined
): boolean {
  return !!(isPending && currentChatId && sendingToChatId === currentChatId);
}
