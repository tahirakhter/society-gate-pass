import { z } from 'zod/v3';
import { AGENT_ACTIONS, AGENT_TARGETS } from '../constants/ai.constants';

export const AgentIntentSchema = z.object({
  intent: z.enum(AGENT_ACTIONS),
  action: z.enum(AGENT_ACTIONS).optional(),
  target: z.enum(AGENT_TARGETS).optional(),
  confidence: z.number(),
  reason: z.string(),
});

export type AgentIntentResult = z.infer<typeof AgentIntentSchema>;
