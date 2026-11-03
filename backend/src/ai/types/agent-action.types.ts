import type { AGENT_ACTION } from '../constants/ai.constants';

export type AgentAction = (typeof AGENT_ACTION)[keyof typeof AGENT_ACTION];
