import { Injectable } from '@nestjs/common';
import type { AgentTool } from '../interfaces/agent-tool.interface';
import type { ToolContext } from '../interfaces/tool-context.interface';
import { WeatherTool } from '../tools/weather.tool';

@Injectable()
export class ToolRegistryService {
  private readonly tools = new Map<string, AgentTool>();

  constructor(weatherTool: WeatherTool) {
    this.register(weatherTool);
  }

  register(tool: AgentTool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Duplicate AI tool name: ${tool.name}`);
    }

    this.tools.set(tool.name, tool);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  get(name: string): AgentTool | null {
    return this.tools.get(name) ?? null;
  }

  getAll(): AgentTool[] {
    return [...this.tools.values()];
  }

  getAllowedTools(context: ToolContext): AgentTool[] {
    return this.getAll().filter((tool) =>
      tool.allowedRoles.includes(context.role),
    );
  }

  isAllowed(name: string, context: ToolContext): boolean {
    const tool = this.get(name);
    return Boolean(tool?.allowedRoles.includes(context.role));
  }

  getOpenAIToolDefinitions(context: ToolContext) {
    return this.getAllowedTools(context).map((tool) =>
      tool.getOpenAIToolDefinition(),
    );
  }
}
