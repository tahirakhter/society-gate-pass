import { z } from 'zod';
import type { UserRole } from '@prisma/client';
import type { ToolContext } from './tool-context.interface';
import type { ToolExecutionResult } from './tool-execution-result.interface';

export interface AgentTool<TSchema extends z.ZodType = z.ZodType> {
  readonly name: string;
  readonly description: string;
  readonly schema: TSchema;
  readonly requiresConfirmation: boolean;
  readonly allowedRoles: readonly UserRole[];
  readonly timeoutMs?: number;

  getOpenAIToolDefinition(): {
    type: 'function';
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    strict: true;
  };

  execute(
    args: z.infer<TSchema>,
    context: ToolContext,
  ): Promise<ToolExecutionResult>;
}
