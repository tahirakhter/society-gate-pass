import { UserRole } from '@prisma/client';
import {
  AgentMemoryContextData,
  AgentMemoryTarget,
} from './agent-memory.helper';
import { AGENT_ACTION } from '../constants/ai.constants';
import type { AgentAction } from '../types/agent-action.types';

export type AgentIntentFallbackInput = {
  intentResult: {
    intent: AgentAction;
    action?: AgentAction;
    target?: AgentMemoryTarget;
    confidence: number;
    reason: string;
  };
  message: string;
  role: UserRole;
  contextData?: AgentMemoryContextData | null;
};

export type AgentIntentFallbackResult = {
  intent: AgentAction;
  action?: AgentAction;
  target?: AgentMemoryTarget;
  confidence: number;
  reason: string;
};

const PASS_RECORD_PATTERN =
  /\b(record|records|pass|passes|visitor|visitors|gate pass|gate passes)\b/;
const RECENT_ITEMS_PATTERN =
  /\b(last|latest|recent|newest|most recent|get|show|list)\b/;
const MEMORY_REFERENCE_PATTERN =
  /\b(it|this|that|that visitor|this visitor|his pass|her pass|their pass)\b/;
const PASS_STATUS_PATTERN =
  /\b(expired|not expired|active|valid|usable|still usable|still valid)\b/;
const PASS_DETAILS_PATTERN =
  /\b(detail|details|info|information|about|what about|show me)\b/;
const PASS_DEACTIVATE_PATTERN =
  /\b(deactivate|cancel|revoke|disable|remove|expire|invalidate)\b/;
const SECURITY_ANALYTICS_PATTERN =
  /\b(suspicious|unusual|risk|anomal|pattern|patterns|summary|overview|report|frequent|most|top|ranking|repeated|multiple houses|visitor count|counts|failed scan analysis|expired pass used)\b/;
const WEATHER_PATTERN =
  /\b(weather|forecast|temperature|humidity|climate|rain|raining)\b/;

export function applyAgentIntentFallbacks({
  intentResult,
  message,
  role,
  contextData,
}: AgentIntentFallbackInput): AgentIntentFallbackResult {
  const normalizedMessage = message.toLowerCase();
  const asksForPassRecords = PASS_RECORD_PATTERN.test(normalizedMessage);
  const asksForRecentItems = RECENT_ITEMS_PATTERN.test(normalizedMessage);
  const target = extractMemoryTarget(message);
  const referencesMemory =
    target !== 'none' || MEMORY_REFERENCE_PATTERN.test(normalizedMessage);

  if (
    contextData?.lastIntent === AGENT_ACTION.GET_WEATHER &&
    /^[\p{L}\p{M}][\p{L}\p{M}\s,.'’-]{1,99}$/u.test(message.trim())
  ) {
    return {
      intent: AGENT_ACTION.GET_WEATHER,
      action: AGENT_ACTION.GET_WEATHER,
      target,
      confidence: 0.95,
      reason: 'Resolved weather location follow-up.',
    };
  }

  if (contextData && referencesMemory) {
    const contextualIntent = getContextualFallbackIntent(
      normalizedMessage,
      target,
    );

    if (contextualIntent) {
      return contextualIntent;
    }
  }

  if (WEATHER_PATTERN.test(normalizedMessage)) {
    return {
      intent: AGENT_ACTION.GET_WEATHER,
      action: AGENT_ACTION.GET_WEATHER,
      target,
      confidence: 0.95,
      reason: 'Matched weather tool fallback.',
    };
  }

  if (SECURITY_ANALYTICS_PATTERN.test(normalizedMessage)) {
    return {
      intent: AGENT_ACTION.SECURITY_ANALYTICS,
      action: AGENT_ACTION.SECURITY_ANALYTICS,
      target,
      confidence: 0.9,
      reason: 'Matched security analytics fallback.',
    };
  }

  if (
    role === UserRole.ADMIN &&
    intentResult.intent === AGENT_ACTION.UNKNOWN &&
    asksForPassRecords &&
    asksForRecentItems
  ) {
    return {
      intent: AGENT_ACTION.SEARCH_VISITORS,
      confidence: 0.9,
      reason: 'Matched recent visitor/pass record search fallback.',
    };
  }

  return {
    ...intentResult,
    action: intentResult.action ?? intentResult.intent,
    target: intentResult.target ?? target,
  };
}

export function extractMemoryTarget(message: string): AgentMemoryTarget {
  const normalizedMessage = message.toLowerCase();

  if (/\b(first|1st)\b/.test(normalizedMessage)) {
    return 'first';
  }

  if (/\b(second|2nd)\b/.test(normalizedMessage)) {
    return 'second';
  }

  if (/\b(third|3rd)\b/.test(normalizedMessage)) {
    return 'third';
  }

  if (
    /\b(last|latest|recent|newest|it|this|that|his|her|their)\b/.test(
      normalizedMessage,
    )
  ) {
    return 'last';
  }

  return 'none';
}

function getContextualFallbackIntent(
  normalizedMessage: string,
  target: AgentMemoryTarget,
): AgentIntentFallbackResult | null {
  if (PASS_STATUS_PATTERN.test(normalizedMessage)) {
    return {
      intent: AGENT_ACTION.CHECK_PASS_STATUS,
      action: AGENT_ACTION.CHECK_PASS_STATUS,
      target,
      confidence: 0.95,
      reason: 'Matched referenced pass status follow-up.',
    };
  }

  if (PASS_DETAILS_PATTERN.test(normalizedMessage)) {
    return {
      intent: AGENT_ACTION.SHOW_PASS_DETAILS,
      action: AGENT_ACTION.SHOW_PASS_DETAILS,
      target,
      confidence: 0.9,
      reason: 'Matched referenced pass details follow-up.',
    };
  }

  if (PASS_DEACTIVATE_PATTERN.test(normalizedMessage)) {
    return {
      intent: AGENT_ACTION.DEACTIVATE_PASS,
      action: AGENT_ACTION.DEACTIVATE_PASS,
      target,
      confidence: 0.95,
      reason: 'Matched referenced pass deactivation follow-up.',
    };
  }

  return null;
}
