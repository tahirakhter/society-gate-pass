import { Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { AgentTool } from '../interfaces/agent-tool.interface';
import type { ToolContext } from '../interfaces/tool-context.interface';
import { TOOL_NAMES } from '../constants/tool-names';
import {
  weatherToolSchema,
  type WeatherToolArgs,
} from '../schemas/weather.schema';
import { WeatherService } from '../services/weather.service';

@Injectable()
export class WeatherTool implements AgentTool<typeof weatherToolSchema> {
  readonly name = TOOL_NAMES.GET_WEATHER;
  readonly description =
    'Get the current weather or forecast for a named location.';
  readonly schema = weatherToolSchema;
  readonly requiresConfirmation = false;
  readonly allowedRoles = [
    UserRole.ADMIN,
    UserRole.OWNER,
    UserRole.SECURITY,
  ] as const;

  constructor(private readonly weatherService: WeatherService) {}

  getOpenAIToolDefinition() {
    return {
      type: 'function' as const,
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object',
        properties: {
          location: {
            type: 'string',
            description: 'City or place name, such as Islamabad or Lahore.',
          },
          period: {
            type: 'string',
            enum: ['today', 'tomorrow', 'day_after_tomorrow', 'week'],
          },
        },
        required: ['location', 'period'],
        additionalProperties: false,
      },
      strict: true as const,
    };
  }

  execute(args: WeatherToolArgs, context: ToolContext) {
    void context;
    return this.weatherService.getWeather(args);
  }
}
