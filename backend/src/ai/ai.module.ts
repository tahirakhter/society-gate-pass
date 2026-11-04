import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { VisitTokensModule } from 'src/visit-tokens/visit-tokens.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { ToolRegistryService } from './tool-calling/services/tool-registry.service';
import { WeatherService } from './tool-calling/services/weather.service';
import { WeatherTool } from './tool-calling/tools/weather.tool';
import { AiSettingsService } from './config/ai-settings.service';
import { OpenAiClientService } from './providers/openai-client.service';
import { ToolExecutorService } from './tool-calling/services/tool-executor.service';
import { ToolCallingAgentService } from './tool-calling/tool-calling-agent.service';

@Module({
  imports: [PrismaModule, VisitTokensModule],
  providers: [
    AiService,
    AiSettingsService,
    OpenAiClientService,
    ToolRegistryService,
    ToolExecutorService,
    ToolCallingAgentService,
    WeatherService,
    WeatherTool,
  ],
  controllers: [AiController],
})
export class AiModule {}
