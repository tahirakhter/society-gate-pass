import {
  Body,
  Controller,
  HttpException,
  Logger,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/interfaces/auth.interface';
import { AiAgentDto } from './dto/ai-agent.dto';
import { AiVisitorPassDto } from './dto/ai-visitor-pass.dto';
import { AiService } from './ai.service';
import { ContinueAiPassDto } from './dto/continue-ai-pass.dto';
import { VisitorSearchAgentDto } from './dto/visitor-search-agent.dto';
import { SecurityAnalyticsAgentDto } from './dto/security-analytics-agent.dto';
import { AiSettingsService } from './config/ai-settings.service';
import { ToolCallingAgentService } from './tool-calling/tool-calling-agent.service';

@Controller('ai')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AiController {
  private readonly logger = new Logger(AiController.name);

  constructor(
    private readonly aiService: AiService,
    private readonly settings: AiSettingsService,
    private readonly toolCallingAgent: ToolCallingAgentService,
  ) {}

  @Post('agent')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  async gatePassAgent(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AiAgentDto,
  ) {
    this.logger.log(
      `AI agent request received. Message length: ${dto.message.length}`,
    );

    try {
      const useNativeToolCalling =
        this.settings.toolCallingEnabled &&
        (await this.toolCallingAgent.canHandle(dto, user));
      const result = useNativeToolCalling
        ? await this.toolCallingAgent.execute(dto, user)
        : await this.aiService.gatePassAgent(dto, user);

      this.logger.log(
        `AI agent request completed. Intent: ${result.agentIntent}`,
      );

      return result;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown controller error';
      const stack = error instanceof Error ? error.stack : undefined;

      this.logger.error(`AI agent request failed: ${message}`, stack);

      if (error instanceof HttpException) {
        throw error;
      }

      throw error;
    }
  }

  @Post('visitor-pass')
  @Roles(UserRole.OWNER)
  async createVisitorPassFromText(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AiVisitorPassDto,
  ) {
    this.logger.log(
      `Visitor pass extraction request received. Message length: ${dto.message.length}`,
    );

    try {
      const result = await this.aiService.extractVisitorPassData(
        dto.message,
        user.id,
      );

      this.logger.log(
        `Visitor pass extraction request completed: ${result.status}`,
      );

      return result;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown controller error';
      const stack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Visitor pass extraction request failed: ${message}`,
        stack,
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw error;
    }
  }

  @Post('visitor-pass/assistant')
  @Roles(UserRole.OWNER)
  async smartVisitorPassAssistant(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ContinueAiPassDto,
  ) {
    this.logger.log(
      `Smart visitor pass assistant request received. Conversation ID: ${
        dto.conversationId ?? 'new'
      }. Message length: ${dto.message.length}`,
    );

    try {
      const result = await this.aiService.smartVisitorPassAssistant(
        dto,
        user.id,
      );

      this.logger.log(
        `Smart visitor pass assistant request completed: ${result.status}. Conversation ID: ${result.conversationId}`,
      );

      return result;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown controller error';
      const stack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Smart visitor pass assistant request failed: ${message}`,
        stack,
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw error;
    }
  }

  @Post('visitor-search')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  async visitorSearchAgent(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: VisitorSearchAgentDto,
  ) {
    this.logger.log(
      `Visitor search agent request received. Message length: ${dto.message.length}`,
    );

    try {
      const result = await this.aiService.visitorSearchAgent(dto, user);

      this.logger.log(
        `Visitor search agent request completed: ${result.status}`,
      );

      return result;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown controller error';
      const stack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Visitor search agent request failed: ${message}`,
        stack,
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw error;
    }
  }

  @Post('security-analytics')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  async securityAnalytics(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SecurityAnalyticsAgentDto,
  ) {
    this.logger.log(
      `Security analytics request received. Message length: ${dto.message.length}`,
    );

    try {
      const result = await this.aiService.securityAnalyticsAgent(dto, user);

      this.logger.log(`Security analytics request completed: ${result.status}`);

      return result;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown controller error';
      const stack = error instanceof Error ? error.stack : undefined;

      this.logger.error(`Security analytics request failed: ${message}`, stack);

      if (error instanceof HttpException) {
        throw error;
      }

      throw error;
    }
  }
}
