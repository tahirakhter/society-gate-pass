export function preserveConversationId(
  currentConversationId: string,
  responseConversationId?: string,
): string {
  return responseConversationId || currentConversationId;
}

export function formatAgentIntent(intent: string): string {
  return intent.replace(/_/g, " ").toLowerCase();
}
