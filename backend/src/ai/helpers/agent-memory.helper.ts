import type { Prisma } from '@prisma/client';
import { AGENT_ACTION } from '../constants/ai.constants';

export type AgentMemoryTarget = 'first' | 'second' | 'third' | 'last' | 'none';

export type AgentMemoryItem = {
  id: string;
  visitorName: string | null;
  cnic: string | null;
  carNumber: string | null;
  houseId: string | null;
  houseNumber: string | null;
  status: string | null;
  expiresAt: Date | string | null;
  createdAt: Date | string | null;
};

export type AgentMemoryContextData = {
  kind: 'AGENT_CONTEXT';
  type: string;
  lastIntent?: string;
  lastTokenId?: string;
  count?: number;
  items: AgentMemoryItem[];
  analyticsType?: string | null;
  summary?: string | null;
  riskLevel?: string | null;
  analyticsItems?: Prisma.InputJsonValue;
};

type VisitTokenLike = {
  id?: string;
  visitor?: {
    fullName?: string | null;
    cnic?: string | null;
  } | null;
  fullName?: string | null;
  visitorName?: string | null;
  cnic?: string | null;
  carNumber?: string | null;
  houseId?: string | null;
  house?: {
    houseNumber?: string | null;
  } | null;
  status?: string | null;
  isActive?: boolean;
  isUsed?: boolean;
  expiresAt?: Date | string | null;
  createdAt?: Date | string | null;
};

export function isAgentMemoryContextData(
  value: unknown,
): value is AgentMemoryContextData {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { kind?: unknown }).kind === 'AGENT_CONTEXT'
  );
}

export function buildAgentMemoryContext(
  intent: string,
  result: Record<string, unknown>,
): AgentMemoryContextData {
  const items = extractResultItems(intent, result)
    .slice(0, 10)
    .map(toMemoryItem)
    .filter((item): item is AgentMemoryItem => item !== null);

  return {
    kind: 'AGENT_CONTEXT',
    type: getMemoryType(intent),
    lastIntent: intent,
    lastTokenId: items[0]?.id,
    count:
      typeof result.count === 'number'
        ? result.count
        : items.length > 0
          ? items.length
          : undefined,
    items,
    ...(intent === AGENT_ACTION.SECURITY_ANALYTICS
      ? {
          analyticsType:
            typeof result.analyticsType === 'string'
              ? result.analyticsType
              : null,
          summary: typeof result.summary === 'string' ? result.summary : null,
          riskLevel:
            typeof result.riskLevel === 'string' ? result.riskLevel : null,
          analyticsItems: extractSecurityAnalyticsItems(result),
        }
      : {}),
  };
}

export function resolveMemoryTarget(
  target: AgentMemoryTarget | undefined,
  contextData: AgentMemoryContextData | null | undefined,
): AgentMemoryItem | null {
  const items = contextData?.items ?? [];

  if (items.length === 0) {
    return null;
  }

  switch (target ?? 'last') {
    case 'first':
      return items[0] ?? null;
    case 'second':
      return items[1] ?? null;
    case 'third':
      return items[2] ?? null;
    case 'last':
      return items[items.length - 1] ?? null;
    default:
      return null;
  }
}

function extractResultItems(
  intent: string,
  result: Record<string, unknown>,
): VisitTokenLike[] {
  if (intent === AGENT_ACTION.SEARCH_VISITORS && Array.isArray(result.data)) {
    return result.data as VisitTokenLike[];
  }

  if (result.gatePass && typeof result.gatePass === 'object') {
    return [result.gatePass as VisitTokenLike];
  }

  if (result.pass && typeof result.pass === 'object') {
    return [result.pass as VisitTokenLike];
  }

  return [];
}

function getMemoryType(intent: string): string {
  if (intent === AGENT_ACTION.SECURITY_ANALYTICS) {
    return 'SECURITY_ANALYTICS_RESULT';
  }

  if (intent === AGENT_ACTION.SEARCH_VISITORS) {
    return 'VISITOR_SEARCH_RESULT';
  }

  if (intent === AGENT_ACTION.CREATE_PASS) {
    return 'CREATED_PASS';
  }

  if (
    intent === AGENT_ACTION.CHECK_PASS_STATUS ||
    intent === AGENT_ACTION.SHOW_PASS_DETAILS
  ) {
    return intent;
  }

  return 'AGENT_RESULT';
}

function extractSecurityAnalyticsItems(
  result: Record<string, unknown>,
): Prisma.InputJsonValue {
  let items: unknown[] = [];

  if (Array.isArray(result.data)) {
    items = result.data;
  } else if (Array.isArray(result.signals)) {
    items = result.signals;
  }

  return JSON.parse(
    JSON.stringify(items.slice(0, 10)),
  ) as Prisma.InputJsonValue;
}

function toMemoryItem(item: VisitTokenLike): AgentMemoryItem | null {
  if (!item.id) {
    return null;
  }

  return {
    id: item.id,
    visitorName:
      item.visitor?.fullName ?? item.fullName ?? item.visitorName ?? null,
    cnic: item.visitor?.cnic ?? item.cnic ?? null,
    carNumber: item.carNumber ?? null,
    houseId: item.houseId ?? null,
    houseNumber: item.house?.houseNumber ?? null,
    status: item.status ?? deriveStatus(item) ?? null,
    expiresAt: item.expiresAt ?? null,
    createdAt: item.createdAt ?? null,
  };
}

function deriveStatus(item: VisitTokenLike): string | null {
  if (item.isActive === false) {
    return 'REVOKED';
  }

  if (item.isUsed === true) {
    return 'USED';
  }

  if (item.expiresAt && new Date(item.expiresAt) < new Date()) {
    return 'EXPIRED';
  }

  if (item.isActive === true) {
    return 'ACTIVE';
  }

  return null;
}
