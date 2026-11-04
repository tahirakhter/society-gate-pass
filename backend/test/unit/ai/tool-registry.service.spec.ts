import { UserRole } from '@prisma/client';
import { z } from 'zod';
import type { AgentTool } from '../../../src/ai/tool-calling/interfaces/agent-tool.interface';
import type { ToolContext } from '../../../src/ai/tool-calling/interfaces/tool-context.interface';
import { ToolRegistryService } from '../../../src/ai/tool-calling/services/tool-registry.service';

const context: ToolContext = {
  userId: 'user-id',
  role: UserRole.OWNER,
  timezone: 'Asia/Karachi',
};

describe('ToolRegistryService', () => {
  it('registers and resolves an exact tool name', () => {
    const weather = createTool('get_weather', [UserRole.OWNER]);
    const registry = new ToolRegistryService(weather as never);

    expect(registry.has('get_weather')).toBe(true);
    expect(registry.get('get_weather')).toBe(weather);
    expect(registry.get('unknown')).toBeNull();
  });

  it('filters tools using backend role context', () => {
    const weather = createTool('get_weather', [UserRole.ADMIN]);
    const registry = new ToolRegistryService(weather as never);

    expect(registry.getAllowedTools(context)).toEqual([]);
    expect(registry.getOpenAIToolDefinitions(context)).toEqual([]);
  });

  it('rejects duplicate names', () => {
    const weather = createTool('get_weather', [UserRole.OWNER]);
    const registry = new ToolRegistryService(weather as never);

    expect(() => registry.register(createTool('get_weather'))).toThrow(
      'Duplicate AI tool name',
    );
  });
});

function createTool(
  name: string,
  allowedRoles: readonly UserRole[] = [UserRole.OWNER],
): AgentTool {
  return {
    name,
    description: name,
    schema: z.object({}),
    requiresConfirmation: false,
    allowedRoles,
    getOpenAIToolDefinition: () => ({
      type: 'function',
      name,
      description: name,
      parameters: {
        type: 'object',
        properties: {},
        required: [],
        additionalProperties: false,
      },
      strict: true,
    }),
    execute: () =>
      Promise.resolve({
        success: true,
        status: 'COMPLETED',
        message: 'done',
      }),
  };
}
