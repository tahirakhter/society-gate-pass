import assert from "node:assert/strict";
import test from "node:test";
import {
  formatAgentIntent,
  preserveConversationId,
} from "../../lib/ai-assistant-state.ts";

test("preserves the active conversation when a response has no conversation id", () => {
  assert.equal(preserveConversationId("conversation-1"), "conversation-1");
});

test("uses a newer conversation id returned by the backend", () => {
  assert.equal(
    preserveConversationId("conversation-1", "conversation-2"),
    "conversation-2",
  );
});

test("does not erase context when the backend returns an empty id", () => {
  assert.equal(
    preserveConversationId("conversation-1", ""),
    "conversation-1",
  );
});

test("formats internal action labels for display", () => {
  assert.equal(formatAgentIntent("CHECK_PASS_STATUS"), "check pass status");
});
