import { UserRole } from '@prisma/client';
import { z } from 'zod';
import type { AgentTool } from '../../../src/ai/tool-calling/interfaces/agent-tool.interface';
import type { ToolContext } from '../../../src/ai/tool-calling/interfaces/tool-context.interface';
import { ToolExecutorService } from '../../../src/ai/tool-calling/services/tool-executor.service';

const context: ToolContext = {
  userId: 'user-id',
  role: UserRole.OWNER,
  timezone: 'Asia/Karachi',
};

describe('ToolExecutorService', () => {
  it('parses, validates, and executes valid arguments', async () => {
    const execute = jest.fn().mockResolvedValue({
      success: true,
      status: 'COMPLETED',
      message: 'Weather loaded',
    });
    const executor = createExecutor(createTool({ execute }));

    await expect(
      executor.execute({
        toolName: 'get_weather',
        rawArguments: '{"location":"Karachi"}',
        context,
      }),
    ).resolves.toMatchObject({ success: true, status: 'COMPLETED' });
    expect(execute).toHaveBeenCalledWith({ location: 'Karachi' }, context);
  });

  it('rejects malformed JSON without executing', async () => {
    const execute = jest.fn();
    const executor = createExecutor(createTool({ execute }));

    await expect(
      executor.execute({
        toolName: 'get_weather',
        rawArguments: '{bad json',
        context,
      }),
    ).resolves.toMatchObject({
      success: false,
      status: 'INVALID_ARGUMENTS',
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it('rejects schema violations without exposing Zod internals', async () => {
    const execute = jest.fn();
    const executor = createExecutor(createTool({ execute }));

    const result = await executor.execute({
      toolName: 'get_weather',
      rawArguments: {},
      context,
    });

    expect(result).toMatchObject({
      success: false,
      status: 'INVALID_ARGUMENTS',
      message: 'The requested action contained invalid information.',
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it('enforces authorization even when a tool can be resolved', async () => {
    const execute = jest.fn();
    const tool = createTool({ execute, allowedRoles: [UserRole.ADMIN] });
    const executor = createExecutor(tool);

    await expect(
      executor.execute({
        toolName: tool.name,
        rawArguments: { location: 'Karachi' },
        context,
      }),
    ).resolves.toMatchObject({ success: false, status: 'FORBIDDEN' });
    expect(execute).not.toHaveBeenCalled();
  });

  it('normalizes unexpected tool failures', async () => {
    const executor = createExecutor(
      createTool({
        execute: jest.fn().mockRejectedValue(new Error('secret failure')),
      }),
    );

    await expect(
      executor.execute({
        toolName: 'get_weather',
        rawArguments: { location: 'Karachi' },
        context,
      }),
    ).resolves.toMatchObject({
      success: false,
      status: 'TOOL_EXECUTION_FAILED',
    });
  });

  it('stops tools that exceed their timeout', async () => {
    const executor = createExecutor(
      createTool({
        execute: jest.fn(() => new Promise(() => undefined)),
      }),
      5,
    );

    await expect(
      executor.execute({
        toolName: 'get_weather',
        rawArguments: { location: 'Karachi' },
        context,
      }),
    ).resolves.toMatchObject({
      success: false,
      status: 'TOOL_TIMEOUT',
    });
  });
});

function createExecutor(tool: AgentTool, timeoutMs = 100) {
  const registry = {
    get: jest.fn((name: string) => (name === tool.name ? tool : null)),
    isAllowed: jest.fn((_name: string, toolContext: ToolContext) =>
      tool.allowedRoles.includes(toolContext.role),
    ),
  };
  const settings = { toolTimeoutMs: timeoutMs };
  return new ToolExecutorService(registry as never, settings as never);
}

function createTool(input: {
  execute: jest.Mock;
  allowedRoles?: readonly UserRole[];
}): AgentTool {
  return {
    name: 'get_weather',
    description: 'Get weather',
    schema: z.object({ location: z.string().min(2) }).strict(),
    requiresConfirmation: false,
    allowedRoles: input.allowedRoles ?? [UserRole.OWNER],
    getOpenAIToolDefinition: () => ({
      type: 'function',
      name: 'get_weather',
      description: 'Get weather',
      parameters: {
        type: 'object',
        properties: { location: { type: 'string' } },
        required: ['location'],
        additionalProperties: false,
      },
      strict: true,
    }),
    execute: input.execute,
  };
}
