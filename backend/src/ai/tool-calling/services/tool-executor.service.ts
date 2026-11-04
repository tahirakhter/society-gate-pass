import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { AiSettingsService } from '../../config/ai-settings.service';
import type { ToolContext } from '../interfaces/tool-context.interface';
import type { ToolExecutionResult } from '../interfaces/tool-execution-result.interface';
import { ToolRegistryService } from './tool-registry.service';

@Injectable()
export class ToolExecutorService {
  private readonly logger = new Logger(ToolExecutorService.name);

  constructor(
    private readonly registry: ToolRegistryService,
    private readonly settings: AiSettingsService,
  ) {}

  async execute(input: {
    toolName: string;
    rawArguments: string | Record<string, unknown>;
    context: ToolContext;
  }): Promise<ToolExecutionResult> {
    const tool = this.registry.get(input.toolName);
    if (!tool) {
      return failure(
        'TOOL_NOT_FOUND',
        'The requested operation is unavailable.',
      );
    }

    if (!this.registry.isAllowed(tool.name, input.context)) {
      return failure(
        'FORBIDDEN',
        'You are not allowed to perform this action.',
      );
    }

    const rawArgs = this.parseArguments(input.rawArguments);
    if (!rawArgs.success) {
      return rawArgs.result;
    }

    const parsed = tool.schema.safeParse(rawArgs.data);
    if (!parsed.success) {
      return {
        ...failure(
          'INVALID_ARGUMENTS',
          'The requested action contained invalid information.',
        ),
        data: { fieldErrors: formatValidationErrors(parsed.error) },
      };
    }

    if (tool.requiresConfirmation) {
      return failure(
        'CONFIRMATION_REQUIRED',
        'This action requires confirmation.',
        { requiresConfirmation: true },
      );
    }

    const startedAt = Date.now();
    try {
      const timeoutMs = tool.timeoutMs ?? this.settings.toolTimeoutMs;
      const result = await withTimeout(
        tool.execute(parsed.data, input.context),
        timeoutMs,
      );
      this.logger.log(
        `AI tool completed. Name: ${tool.name}. Status: ${result.status}. Duration: ${Date.now() - startedAt}ms`,
      );
      return result;
    } catch (error) {
      const timedOut = error instanceof ToolTimeoutError;
      this.logger.error(
        `AI tool failed. Name: ${tool.name}. Duration: ${Date.now() - startedAt}ms`,
        error as Error,
      );
      return failure(
        timedOut ? 'TOOL_TIMEOUT' : 'TOOL_EXECUTION_FAILED',
        timedOut
          ? 'The requested service did not respond in time.'
          : 'The requested operation could not be completed.',
      );
    }
  }

  private parseArguments(
    input: string | Record<string, unknown>,
  ):
    | { success: true; data: Record<string, unknown> }
    | { success: false; result: ToolExecutionResult } {
    if (typeof input !== 'string') {
      return { success: true, data: input };
    }

    try {
      const parsed = JSON.parse(input) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Tool arguments must be an object');
      }
      return { success: true, data: parsed as Record<string, unknown> };
    } catch {
      return {
        success: false,
        result: failure(
          'INVALID_ARGUMENTS',
          'The requested action contained invalid information.',
        ),
      };
    }
  }
}

class ToolTimeoutError extends Error {}

async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new ToolTimeoutError()), timeoutMs);
  });

  try {
    return await Promise.race([operation, timeout]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

function failure(
  status: string,
  message: string,
  extra: Partial<ToolExecutionResult> = {},
): ToolExecutionResult {
  return {
    success: false,
    status,
    errorCode: status,
    message,
    ...extra,
  };
}

function formatValidationErrors(error: z.ZodError) {
  return error.issues.map((issue) => ({
    field: issue.path.join('.') || 'arguments',
    message: issue.message,
  }));
}
