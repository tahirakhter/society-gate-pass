import {
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  ScanStatus,
  UserRole,
  type AiConversation,
} from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import type { AuthenticatedUser } from 'src/auth/interfaces/auth.interface';
import { ContinueAiPassDto } from './dto/continue-ai-pass.dto';
import { VisitTokensService } from 'src/visit-tokens/visit-tokens.service';
import { zodResponseFormat } from 'openai/helpers/zod';
import { GoogleGenAI, Type } from '@google/genai';
import { AGENT_INTENT_PROMPT } from './prompts/agent-intent.prompt';
import { VISITOR_PASS_EXTRACTION_PROMPT } from './prompts/visitor-pass-extraction.prompt';
import { getVisitorSearchPrompt } from './prompts/visitor-search.prompt';
import {
  AGENT_ACTION,
  AGENT_ACTIONS,
  AGENT_TARGETS,
  AI_PASS_STATUS,
  VISITOR_SEARCH_STATUS,
} from './constants/ai.constants';
import {
  CompleteVisitorPassCollectedData,
  REQUIRED_VISITOR_PASS_FIELDS,
  VisitorPassCollectedData,
  VisitorPassExtraction,
  VisitorPassSchema,
} from './types/visitor-pass-ai.types';
import { AiAgentDto } from './dto/ai-agent.dto';
import { VisitorSearchAgentDto } from './dto/visitor-search-agent.dto';
import { SecurityAnalyticsAgentDto } from './dto/security-analytics-agent.dto';
import {
  VisitorSearchFilters,
  VisitorSearchFiltersSchema,
} from './types/visitor-search-ai.types';
import {
  SECURITY_ANALYTICS_TYPES,
  SecurityAnalyticsFilters,
  SecurityAnalyticsFiltersSchema,
} from './types/security-analytics-ai.types';
import type { AgentAction } from './types/agent-action.types';
import {
  AgentIntentSchema,
  type AgentIntentResult,
} from './types/agent-intent.types';
import {
  AgentMemoryContextData,
  AgentMemoryTarget,
  buildAgentMemoryContext,
  isAgentMemoryContextData,
  resolveMemoryTarget,
} from './helpers/agent-memory.helper';
import {
  applyAgentIntentFallbacks,
  extractMemoryTarget,
} from './helpers/agent-intent-fallback.helper';
import { extractVisitorSearchDateRange } from './helpers/visitor-search-date.helper';
import { TOOL_NAMES } from './tool-calling/constants/tool-names';
import { parseWeatherQuery } from './tool-calling/helpers/weather-query.helper';
import { ToolExecutorService } from './tool-calling/services/tool-executor.service';
import { OpenAiClientService } from './providers/openai-client.service';
import { extractExpectedVisitorPassFields } from './helpers/visitor-pass-reply.helper';

const AGENT_CONFIDENCE_THRESHOLD = 0.6;

@Injectable()
export class AiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly visitTokensService: VisitTokensService,
    private readonly toolExecutor: ToolExecutorService,
    private readonly openai: OpenAiClientService,
  ) {}

  private readonly logger = new Logger(AiService.name);

  private readonly gemini = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });

  async gatePassAgent(dto: AiAgentDto, user: AuthenticatedUser) {
    const userId = user.id;
    const requestedConversation = dto.conversationId
      ? await this.prisma.aiConversation.findFirst({
          where: {
            id: dto.conversationId,
            ownerId: userId,
          },
        })
      : null;
    const requestedContextData = this.getAgentContextData(
      requestedConversation,
    );

    if (dto.conversationId && !requestedContextData) {
      if (user.role !== UserRole.OWNER) {
        return this.actionNotAllowed(
          AGENT_ACTION.CREATE_PASS,
          'Only owners can create visitor passes.',
        );
      }

      return this.runSmartVisitorPassAssistantAsAgent(
        dto.message,
        dto.conversationId,
        userId,
      );
    }

    if (!dto.conversationId && user.role === UserRole.OWNER) {
      const inProgressConversation =
        await this.getLastSmartVisitorPassConversation(userId);

      if (
        inProgressConversation &&
        !this.isLikelyIndependentAgentRequest(dto.message) &&
        this.isLikelyVisitorPassFieldReply(dto.message, inProgressConversation)
      ) {
        return this.runSmartVisitorPassAssistantAsAgent(
          dto.message,
          inProgressConversation.id,
          userId,
        );
      }
    }

    const lastContext = requestedConversation
      ? requestedConversation
      : await this.getLastAgentContext(userId);
    const contextData =
      requestedContextData ?? this.getAgentContextData(lastContext);

    if (contextData) {
      const contextualIntent = this.getContextualIntent(
        dto.message,
        contextData,
      );

      if (contextualIntent) {
        const target = this.normalizeMemoryTarget(
          extractMemoryTarget(dto.message),
        );

        if (
          contextualIntent === AGENT_ACTION.DEACTIVATE_PASS &&
          user.role !== UserRole.OWNER
        ) {
          return this.actionNotAllowed(
            contextualIntent,
            this.getActionNotAllowedMessage(contextualIntent),
          );
        }

        const result = await this.runContextualAgentAction(
          contextualIntent,
          contextData,
          target,
          user,
        );
        const response = this.withAgentIntent(result, contextualIntent, 1);
        const context = await this.saveAgentContext({
          ownerId: userId,
          userMessage: dto.message,
          intent: contextualIntent,
          action: contextualIntent,
          response,
          contextData: buildAgentMemoryContext(contextualIntent, response),
        });

        return {
          ...response,
          conversationId: context.id,
        };
      }
    }

    const intentResult = await this.extractAgentIntent({
      message: dto.message,
      lastContext: contextData,
    });
    const normalizedIntent = applyAgentIntentFallbacks({
      intentResult,
      message: dto.message,
      role: user.role,
      contextData,
    });

    this.logger.log(
      `AI agent classified intent ${normalizedIntent.intent} with confidence ${normalizedIntent.confidence}: ${normalizedIntent.reason}`,
    );

    if (
      normalizedIntent.confidence < AGENT_CONFIDENCE_THRESHOLD ||
      normalizedIntent.intent === AGENT_ACTION.UNKNOWN
    ) {
      return {
        action: AGENT_ACTION.UNKNOWN,
        agentIntent: AGENT_ACTION.UNKNOWN,
        confidence: normalizedIntent.confidence,
        status: 'UNKNOWN_INTENT',
        message:
          'I can help you create visitor passes, search visitors, analyze security activity, check pass status, show pass details, get weather, check entry logs, and deactivate passes.',
      };
    }

    switch (normalizedIntent.intent) {
      case AGENT_ACTION.CREATE_PASS: {
        if (user.role !== UserRole.OWNER) {
          return this.actionNotAllowed(
            intentResult.intent,
            'Only owners can create visitor passes.',
            normalizedIntent.confidence,
          );
        }

        return this.runSmartVisitorPassAssistantAsAgent(
          dto.message,
          dto.conversationId,
          userId,
          normalizedIntent.confidence,
        );
      }

      case AGENT_ACTION.SEARCH_VISITORS: {
        const result = await this.visitorSearchAgent(
          {
            message: dto.message,
          },
          user,
        );
        const response = this.withAgentIntent(
          result,
          normalizedIntent.intent,
          normalizedIntent.confidence,
        );
        const context = await this.saveAgentContext({
          ownerId: userId,
          userMessage: dto.message,
          intent: normalizedIntent.intent,
          action: normalizedIntent.action ?? normalizedIntent.intent,
          response,
          contextData: buildAgentMemoryContext(
            normalizedIntent.intent,
            response,
          ),
        });

        return {
          ...response,
          conversationId: context.id,
        };
      }

      case AGENT_ACTION.ENTRY_LOGS: {
        if (user.role !== UserRole.ADMIN && user.role !== UserRole.OWNER) {
          return this.actionNotAllowed(
            intentResult.intent,
            'Only admins and owners can search entry logs.',
            normalizedIntent.confidence,
          );
        }

        const result = await this.entryLogAgent(
          {
            message: dto.message,
          },
          user,
        );

        const response = this.withAgentIntent(
          result,
          normalizedIntent.intent,
          normalizedIntent.confidence,
        );

        const context = await this.saveAgentContext({
          ownerId: userId,
          userMessage: dto.message,
          intent: normalizedIntent.intent,
          action: normalizedIntent.action ?? normalizedIntent.intent,
          response,
          contextData: buildAgentMemoryContext(
            normalizedIntent.intent,
            response,
          ),
        });

        return {
          ...response,
          conversationId: context.id,
        };
      }

      case AGENT_ACTION.SECURITY_ANALYTICS: {
        const result = await this.securityAnalyticsAgent(
          {
            message: dto.message,
          },
          user,
        );
        const response = this.withAgentIntent(
          result,
          normalizedIntent.intent,
          normalizedIntent.confidence,
        );
        const context = await this.saveAgentContext({
          ownerId: userId,
          userMessage: dto.message,
          intent: normalizedIntent.intent,
          action: normalizedIntent.action ?? normalizedIntent.intent,
          response,
          contextData: buildAgentMemoryContext(
            normalizedIntent.intent,
            response,
          ),
        });

        return {
          ...response,
          conversationId: context.id,
        };
      }

      case AGENT_ACTION.GET_WEATHER: {
        const result = await this.weatherAgent(dto.message, user);
        const response = this.withAgentIntent(
          result,
          normalizedIntent.intent,
          normalizedIntent.confidence,
        );
        const context = await this.saveAgentContext({
          ownerId: userId,
          userMessage: dto.message,
          intent: normalizedIntent.intent,
          action: normalizedIntent.action ?? normalizedIntent.intent,
          response,
          contextData: buildAgentMemoryContext(
            normalizedIntent.intent,
            response,
          ),
        });

        return {
          ...response,
          conversationId: context.id,
        };
      }

      case AGENT_ACTION.CHECK_PASS_STATUS: {
        const result = await this.checkPassStatusAgent(
          {
            target: this.normalizeMemoryTarget(normalizedIntent.target),
            lastContext: contextData,
          },
          user,
        );
        const response = this.withAgentIntent(
          result,
          normalizedIntent.intent,
          normalizedIntent.confidence,
        );
        const context = await this.saveAgentContext({
          ownerId: userId,
          userMessage: dto.message,
          intent: normalizedIntent.intent,
          action: normalizedIntent.action ?? normalizedIntent.intent,
          response,
          contextData: buildAgentMemoryContext(
            normalizedIntent.intent,
            response,
          ),
        });

        return {
          ...response,
          conversationId: context.id,
        };
      }

      case AGENT_ACTION.SHOW_PASS_DETAILS: {
        const result = await this.showPassDetailsAgent(
          {
            target: this.normalizeMemoryTarget(normalizedIntent.target),
            lastContext: contextData,
          },
          user,
        );
        const response = this.withAgentIntent(
          result,
          normalizedIntent.intent,
          normalizedIntent.confidence,
        );
        const context = await this.saveAgentContext({
          ownerId: userId,
          userMessage: dto.message,
          intent: normalizedIntent.intent,
          action: normalizedIntent.action ?? normalizedIntent.intent,
          response,
          contextData: buildAgentMemoryContext(
            normalizedIntent.intent,
            response,
          ),
        });

        return {
          ...response,
          conversationId: context.id,
        };
      }

      case AGENT_ACTION.DEACTIVATE_PASS: {
        if (user.role !== UserRole.OWNER) {
          return this.actionNotAllowed(
            intentResult.intent,
            'Only owners can deactivate visitor passes from the AI assistant.',
            normalizedIntent.confidence,
          );
        }

        const targetPass = resolveMemoryTarget(
          this.normalizeMemoryTarget(normalizedIntent.target),
          contextData,
        );
        const result = await this.deactivatePassAgent(userId, targetPass?.id);
        const response = this.withAgentIntent(
          result,
          normalizedIntent.intent,
          normalizedIntent.confidence,
        );
        const context = await this.saveAgentContext({
          ownerId: userId,
          userMessage: dto.message,
          intent: normalizedIntent.intent,
          action: normalizedIntent.action ?? normalizedIntent.intent,
          response,
          contextData: buildAgentMemoryContext(
            normalizedIntent.intent,
            response,
          ),
        });

        return {
          ...response,
          conversationId: context.id,
        };
      }

      default:
        return {
          action: AGENT_ACTION.UNKNOWN,
          agentIntent: AGENT_ACTION.UNKNOWN,
          confidence: normalizedIntent.confidence,
          status: 'UNKNOWN_INTENT',
          message:
            'I can help you create visitor passes, search visitors, analyze security activity, check pass status, show pass details, get weather, check entry logs, and deactivate passes.',
        };
    }
  }

  async extractAgentIntent(input: {
    message: string;
    lastContext?: AgentMemoryContextData | null;
  }): Promise<AgentIntentResult> {
    const result =
      process.env.AI_PROVIDER === 'openai'
        ? await this.extractAgentIntentWithOpenAI(input)
        : await this.extractAgentIntentWithGemini(input);

    return AgentIntentSchema.parse(result);
  }

  private async extractAgentIntentWithOpenAI(input: {
    message: string;
    lastContext?: AgentMemoryContextData | null;
  }): Promise<AgentIntentResult> {
    const completion = await this.openai.chat.completions.parse({
      model: 'gpt-4o-mini',
      temperature: 0,
      messages: [
        {
          role: 'system',
          content: AGENT_INTENT_PROMPT,
        },
        {
          role: 'user',
          content: this.buildAgentPlannerMessage(input),
        },
      ],
      response_format: zodResponseFormat(AgentIntentSchema, 'agent_intent'),
    });

    return AgentIntentSchema.parse(completion.choices[0].message.parsed);
  }

  private async extractAgentIntentWithGemini(input: {
    message: string;
    lastContext?: AgentMemoryContextData | null;
  }): Promise<AgentIntentResult> {
    const response = await this.gemini.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: this.buildAgentPlannerMessage(input),
      config: {
        temperature: 0,
        systemInstruction: AGENT_INTENT_PROMPT,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            intent: {
              type: Type.STRING,
              enum: [...AGENT_ACTIONS],
            },
            action: {
              type: Type.STRING,
              enum: [...AGENT_ACTIONS],
            },
            target: {
              type: Type.STRING,
              enum: [...AGENT_TARGETS],
            },
            confidence: {
              type: Type.NUMBER,
            },
            reason: {
              type: Type.STRING,
            },
          },
          required: ['intent', 'action', 'target', 'confidence', 'reason'],
        },
      },
    });

    return AgentIntentSchema.parse(JSON.parse(response.text ?? '{}'));
  }

  private withAgentIntent<T extends Record<string, unknown>>(
    result: T,
    agentIntent: AgentAction,
    confidence: number,
  ): T & { action: AgentAction; agentIntent: AgentAction; confidence: number } {
    return {
      ...result,
      action: agentIntent,
      agentIntent,
      confidence,
    };
  }

  private actionNotAllowed(
    agentIntent: AgentAction,
    message: string,
    confidence = 1,
  ) {
    return {
      action: agentIntent,
      agentIntent,
      confidence,
      status: 'ACTION_NOT_ALLOWED',
      message,
    };
  }

  private async runSmartVisitorPassAssistantAsAgent(
    message: string,
    conversationId: string | undefined,
    ownerId: string,
    confidence = 1,
  ) {
    const result = await this.smartVisitorPassAssistant(
      {
        message,
        conversationId,
      },
      ownerId,
    );
    const response = this.withAgentIntent(
      result,
      AGENT_ACTION.CREATE_PASS,
      confidence,
    );

    if (result.status !== AI_PASS_STATUS.COMPLETED) {
      return response;
    }

    const context = await this.saveAgentContext({
      ownerId,
      userMessage: message,
      intent: AGENT_ACTION.CREATE_PASS,
      action: AGENT_ACTION.CREATE_PASS,
      response,
      contextData: buildAgentMemoryContext(AGENT_ACTION.CREATE_PASS, response),
    });

    return {
      ...response,
      conversationId: context.id,
    };
  }

  private async getLastSmartVisitorPassConversation(ownerId: string) {
    return this.prisma.aiConversation.findFirst({
      where: {
        ownerId,
        status: {
          in: [AI_PASS_STATUS.IN_PROGRESS, AI_PASS_STATUS.READY],
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
  }

  private isLikelyIndependentAgentRequest(message: string): boolean {
    const normalizedMessage = message.toLowerCase();

    return /\b(create|generate|make|fetch|get|show|find|search|list|record|records|visitor|visitors|history|pass|passes|gate pass|gate passes|entries|entry|logs|scans|scan|deactivate|cancel|revoke|disable|remove|expired|active|valid|details|info|weather|forecast|temperature|rain|climate)\b/.test(
      normalizedMessage,
    );
  }

  private isLikelyVisitorPassFieldReply(
    message: string,
    conversation: AiConversation,
  ): boolean {
    const normalizedMessage = message.toLowerCase();
    const missingFields = Array.isArray(conversation.missingFields)
      ? (conversation.missingFields as string[])
      : [];

    if (missingFields.length === 0) {
      return false;
    }

    if (
      missingFields.includes('carNumber') &&
      /\b(car|vehicle|plate|number|registration|[a-z]{2,4}[-\s]?\d{2,4})\b/i.test(
        message,
      )
    ) {
      return true;
    }

    if (
      missingFields.includes('visitDateTime') &&
      /\b(today|tomorrow|tonight|morning|evening|pm|am|\d{1,2}:\d{2}|\d{1,2}\s?(pm|am)|\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})\b/.test(
        normalizedMessage,
      )
    ) {
      return true;
    }

    if (
      missingFields.includes('houseNumber') &&
      /\b(house|home|flat|apartment|villa|unit|block|[a-z]\s?-?\s?\d{1,4}|\d{1,4})\b/i.test(
        message,
      )
    ) {
      return true;
    }

    if (
      missingFields.includes('cnic') &&
      /\b\d{5}[-\s]?\d{7}[-\s]?\d\b/.test(normalizedMessage)
    ) {
      return true;
    }

    return (
      missingFields.includes('visitorName') &&
      /\b(name|visitor|guest)\b/.test(normalizedMessage)
    );
  }

  private getContextualIntent(
    message: string,
    contextData: AgentMemoryContextData,
  ): AgentAction | null {
    const normalizedMessage = message.toLowerCase();
    const referencesLastPass =
      extractMemoryTarget(message) !== 'none' ||
      /\b(it|this|that|latest one|recent one|record|pass|visitor|his pass|her pass|their pass)\b/.test(
        normalizedMessage,
      );
    const asksForDeactivation =
      /\b(deactivate|cancel|revoke|disable|remove|expire|invalidate)\b/.test(
        normalizedMessage,
      );
    const asksForStatus =
      referencesLastPass &&
      /\b(expired|not expired|active|valid|usable|still usable|still valid)\b/.test(
        normalizedMessage,
      );
    const asksForDetails =
      referencesLastPass &&
      /\b(detail|details|info|information|about|what about|show me)\b/.test(
        normalizedMessage,
      );

    if (contextData.items.length === 0) {
      return null;
    }

    if (asksForDeactivation) {
      return AGENT_ACTION.DEACTIVATE_PASS;
    }

    if (asksForStatus) {
      return AGENT_ACTION.CHECK_PASS_STATUS;
    }

    if (asksForDetails) {
      return AGENT_ACTION.SHOW_PASS_DETAILS;
    }

    return null;
  }

  private async getLastAgentContext(ownerId: string) {
    return this.prisma.aiConversation.findFirst({
      where: {
        ownerId,
        status: 'AGENT_CONTEXT',
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
  }

  private getAgentContextData(
    conversation: AiConversation | null,
  ): AgentMemoryContextData | null {
    if (!conversation) {
      return null;
    }

    const memoryConversation = conversation as AiConversation & {
      contextData?: unknown;
    };

    if (isAgentMemoryContextData(memoryConversation.contextData)) {
      return memoryConversation.contextData;
    }

    if (isAgentMemoryContextData(conversation.collectedData)) {
      const collectedData =
        conversation.collectedData as unknown as AgentMemoryContextData;

      return {
        ...collectedData,
        items: collectedData.items ?? [],
      };
    }

    return null;
  }

  private buildAgentPlannerMessage(input: {
    message: string;
    lastContext?: AgentMemoryContextData | null;
  }): string {
    return JSON.stringify({
      previousContext: input.lastContext
        ? {
            type: input.lastContext.type,
            lastIntent: input.lastContext.lastIntent,
            count: input.lastContext.count,
            items: input.lastContext.items.map((item, index) => ({
              position: index + 1,
              id: item.id,
              visitorName: item.visitorName,
              houseNumber: item.houseNumber,
              status: item.status,
              expiresAt: item.expiresAt,
              createdAt: item.createdAt,
            })),
          }
        : null,
      message: input.message,
    });
  }

  private normalizeMemoryTarget(
    target: AgentMemoryTarget | undefined,
  ): AgentMemoryTarget {
    return !target || target === 'none' ? 'last' : target;
  }

  private getActionNotAllowedMessage(agentIntent: AgentAction): string {
    if (agentIntent === AGENT_ACTION.DEACTIVATE_PASS) {
      return 'Only owners can deactivate visitor passes from the AI assistant.';
    }

    return 'You are not allowed to perform this action.';
  }

  private async runContextualAgentAction(
    intent: AgentAction,
    contextData: AgentMemoryContextData,
    target: AgentMemoryTarget,
    user: AuthenticatedUser,
  ) {
    if (intent === AGENT_ACTION.CHECK_PASS_STATUS) {
      return this.checkPassStatusAgent(
        {
          target,
          lastContext: contextData,
        },
        user,
      );
    }

    if (intent === AGENT_ACTION.SHOW_PASS_DETAILS) {
      return this.showPassDetailsAgent(
        {
          target,
          lastContext: contextData,
        },
        user,
      );
    }

    if (intent === AGENT_ACTION.DEACTIVATE_PASS) {
      const targetPass = resolveMemoryTarget(target, contextData);

      return this.deactivatePassAgent(user.id, targetPass?.id);
    }

    return {
      status: 'UNKNOWN_INTENT',
      message:
        'I can help you create visitor passes, search visitors, analyze security activity, check pass status, show pass details, get weather, check entry logs, and deactivate passes.',
    };
  }

  private async weatherAgent(message: string, user: AuthenticatedUser) {
    const args = parseWeatherQuery(message);
    if (!args.location) {
      return {
        status: 'MISSING_LOCATION',
        message:
          'Please tell me the city or location you want weather for, for example "weather in Islamabad".',
      };
    }

    const result = await this.toolExecutor.execute({
      toolName: TOOL_NAMES.GET_WEATHER,
      rawArguments: args,
      context: {
        userId: user.id,
        role: user.role,
        timezone: 'auto',
      },
    });

    return {
      status: result.status,
      message: result.message,
      weather: result.data,
    };
  }

  private saveAgentContext(input: {
    ownerId: string;
    userMessage: string;
    intent: AgentAction;
    action: AgentAction;
    response: Record<string, unknown>;
    contextData: AgentMemoryContextData;
    status?: string;
  }) {
    return this.prisma.aiConversation.create({
      data: {
        ownerId: input.ownerId,
        collectedData: input.contextData,
        missingFields: [],
        userMessage: input.userMessage,
        aiResponse: this.summarizeAgentResponse(input.response),
        intent: input.intent,
        action: input.action,
        contextData: input.contextData,
        status: 'AGENT_CONTEXT',
      },
    });
  }

  private summarizeAgentResponse(
    response: Record<string, unknown>,
  ): Prisma.InputJsonObject {
    return {
      status: this.toJsonScalar(response.status),
      message: this.toJsonScalar(response.message),
      count: this.toJsonScalar(response.count),
      agentIntent: this.toJsonScalar(response.agentIntent),
      action: this.toJsonScalar(response.action),
      confidence: this.toJsonScalar(response.confidence),
    };
  }

  private toJsonScalar(value: unknown): string | number | boolean | null {
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      return value;
    }

    return null;
  }

  async extractVisitorPassData(message: string, ownerId: string) {
    this.logger.log(
      `Starting visitor pass extraction. Provider: ${process.env.AI_PROVIDER}`,
    );

    try {
      const data = await this.extractVisitorPassFields(message);
      const missingFields = this.getMissingFields(data);

      if (missingFields.length > 0) {
        return {
          status: AI_PASS_STATUS.MISSING_FIELDS,
          missingFields,
          message: `Please provide: ${missingFields.join(', ')}`,
          data,
        };
      }

      this.assertVisitorPassDataReady(data);

      const gatePass = await this.createGatePassFromVisitorData(ownerId, data);

      return {
        status: AI_PASS_STATUS.READY,
        data: gatePass,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown visitor pass error';

      const stack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Visitor pass extraction failed: ${errorMessage}`,
        stack,
      );

      throw new InternalServerErrorException(
        'Visitor pass extraction failed. Please try again.',
      );
    }
  }

  private async extractVisitorPassFields(
    message: string,
    expectedMissingFields: readonly string[] = [],
  ): Promise<VisitorPassCollectedData> {
    const data =
      process.env.AI_PROVIDER === 'openai'
        ? await this.extractWithOpenAI(message)
        : await this.extractWithGemini(message);

    if (!data) {
      throw new InternalServerErrorException(
        'Unable to parse visitor pass data',
      );
    }

    return {
      ...this.toCollectedData(data),
      ...extractExpectedVisitorPassFields(message, expectedMissingFields),
    };
  }

  private async extractWithOpenAI(
    message: string,
  ): Promise<VisitorPassExtraction | null> {
    const completion = await this.openai.chat.completions.parse({
      model: 'gpt-4o-mini',
      temperature: 0,
      messages: [
        {
          role: 'system',
          content: VISITOR_PASS_EXTRACTION_PROMPT,
        },
        {
          role: 'user',
          content: message,
        },
      ],
      response_format: zodResponseFormat(
        VisitorPassSchema,
        'visitor_pass_extraction',
      ),
    });

    return completion.choices[0].message.parsed;
  }

  private async extractWithGemini(
    message: string,
  ): Promise<VisitorPassExtraction | null> {
    const response = await this.gemini.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: message,
      config: {
        temperature: 0,
        systemInstruction: VISITOR_PASS_EXTRACTION_PROMPT,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            visitorName: {
              type: Type.STRING,
              nullable: true,
            },
            cnic: {
              type: Type.STRING,
              nullable: true,
            },
            carNumber: {
              type: Type.STRING,
              nullable: true,
            },
            houseNumber: {
              type: Type.STRING,
              nullable: true,
            },
            visitDateTime: {
              type: Type.STRING,
              nullable: true,
            },
            missingFields: {
              type: Type.ARRAY,
              items: {
                type: Type.STRING,
              },
            },
          },
          required: [
            'visitorName',
            'cnic',
            'carNumber',
            'houseNumber',
            'visitDateTime',
            'missingFields',
          ],
        },
      },
    });

    return VisitorPassSchema.parse(JSON.parse(response.text ?? '{}'));
  }

  private toCollectedData(
    extraction: VisitorPassExtraction,
  ): VisitorPassCollectedData {
    return {
      ...(extraction.visitorName
        ? { visitorName: extraction.visitorName }
        : {}),
      ...(extraction.cnic ? { cnic: extraction.cnic } : {}),
      ...(extraction.carNumber ? { carNumber: extraction.carNumber } : {}),
      ...(extraction.houseNumber
        ? { houseNumber: extraction.houseNumber }
        : {}),
      ...(extraction.visitDateTime
        ? { visitDateTime: extraction.visitDateTime }
        : {}),
    };
  }

  async visitorSearchAgent(
    dto: VisitorSearchAgentDto,
    user: AuthenticatedUser,
  ) {
    this.logger.log(
      `Starting visitor search agent. Message length: ${dto.message.length}`,
    );

    try {
      const filters = await this.extractVisitorSearchFilters(dto.message);
      const effectiveFilters = this.applyVisitorSearchFallbacks(
        filters,
        dto.message,
      );
      const normalizedHouseNumber = filters.houseNumber
        ? this.normalizeHouseNumber(filters.houseNumber)
        : null;
      let houseId: string | undefined;

      if (normalizedHouseNumber) {
        const houses = await this.prisma.house.findMany({
          where:
            user.role === UserRole.ADMIN
              ? {}
              : {
                  ownerId: user.id,
                },
          select: {
            id: true,
            houseNumber: true,
          },
        });

        const matchingHouse = houses.find(
          (house) =>
            this.normalizeHouseNumber(house.houseNumber) ===
            normalizedHouseNumber,
        );

        if (!matchingHouse) {
          return {
            status: VISITOR_SEARCH_STATUS.HOUSE_NOT_FOUND,
            message: `House ${filters.houseNumber} was not found.`,
            filters: effectiveFilters,
          };
        }

        houseId = matchingHouse.id;
      }

      const tokens = await this.prisma.visitToken.findMany({
        where: {
          ...(user.role === UserRole.ADMIN ? {} : { createdBy: user.id }),
          ...(houseId ? { houseId } : {}),
          ...(filters.visitorName || filters.cnic
            ? {
                visitor: {
                  ...(filters.visitorName
                    ? {
                        fullName: {
                          contains: filters.visitorName,
                          mode: 'insensitive',
                        },
                      }
                    : {}),
                  ...(filters.cnic ? { cnic: filters.cnic } : {}),
                },
              }
            : {}),
          ...(effectiveFilters.fromDate || effectiveFilters.toDate
            ? {
                expiresAt: {
                  ...(effectiveFilters.fromDate
                    ? { gte: this.toStartOfDay(effectiveFilters.fromDate) }
                    : {}),
                  ...(effectiveFilters.toDate
                    ? { lte: this.toEndOfDay(effectiveFilters.toDate) }
                    : {}),
                },
              }
            : {}),
          ...(effectiveFilters.notExpiredOnly
            ? {
                expiresAt: {
                  gte: new Date(),
                },
              }
            : {}),
        },
        include: {
          visitor: true,
          house: {
            include: {
              owner: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: effectiveFilters.latestOnly ? 1 : 50,
      });

      return {
        status: VISITOR_SEARCH_STATUS.COMPLETED,
        filters: effectiveFilters,
        count: tokens.length,
        data: tokens,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      const message =
        error instanceof Error
          ? error.message
          : 'Unknown visitor search agent error';
      const stack = error instanceof Error ? error.stack : undefined;

      this.logger.error(`Visitor search agent failed: ${message}`, stack);

      throw new InternalServerErrorException(
        'Visitor search failed. Please try again.',
      );
    }
  }

  private async extractVisitorSearchFilters(
    message: string,
  ): Promise<VisitorSearchFilters> {
    const response = await this.gemini.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: message,
      config: {
        temperature: 0,
        systemInstruction: getVisitorSearchPrompt(
          new Date().toISOString().slice(0, 10),
        ),
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            intent: {
              type: Type.STRING,
            },
            visitorName: {
              type: Type.STRING,
              nullable: true,
            },
            cnic: {
              type: Type.STRING,
              nullable: true,
            },
            houseNumber: {
              type: Type.STRING,
              nullable: true,
            },
            fromDate: {
              type: Type.STRING,
              nullable: true,
            },
            toDate: {
              type: Type.STRING,
              nullable: true,
            },
            latestOnly: {
              type: Type.BOOLEAN,
              nullable: true,
            },
            notExpiredOnly: {
              type: Type.BOOLEAN,
              nullable: true,
            },
          },
          required: [
            'intent',
            'visitorName',
            'cnic',
            'houseNumber',
            'fromDate',
            'toDate',
            'latestOnly',
            'notExpiredOnly',
          ],
        },
      },
    });

    return VisitorSearchFiltersSchema.parse(JSON.parse(response.text ?? '{}'));
  }

  private normalizeHouseNumber(value: string): string {
    return value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  }

  private applyVisitorSearchFallbacks(
    filters: VisitorSearchFilters,
    message: string,
  ): VisitorSearchFilters {
    const normalizedMessage = message.toLowerCase();
    const latestOnly =
      filters.latestOnly === true ||
      /\b(latest|newest|most recent|last gate pass|recent pass|last pass)\b/.test(
        normalizedMessage,
      );
    const notExpiredOnly =
      filters.notExpiredOnly === true ||
      /\b(not expired|non expired|unexpired|active|valid|usable|current)\b/.test(
        normalizedMessage,
      );
    const explicitDateRange = extractVisitorSearchDateRange(message);

    return {
      ...filters,
      ...(explicitDateRange && {
        fromDate: explicitDateRange.fromDate,
        toDate: explicitDateRange.toDate,
      }),
      latestOnly,
      notExpiredOnly,
    };
  }

  private toStartOfDay(dateValue: string): Date {
    return new Date(`${dateValue.slice(0, 10)}T00:00:00.000Z`);
  }

  private toEndOfDay(dateValue: string): Date {
    return new Date(`${dateValue.slice(0, 10)}T23:59:59.999Z`);
  }

  async entryLogAgent(dto: VisitorSearchAgentDto, user: AuthenticatedUser) {
    this.logger.log(
      `Starting entry log agent. Message length: ${dto.message.length}`,
    );

    try {
      const message = dto.message.toLowerCase();
      const dateRange = this.extractEntryLogDateRange(dto.message);
      const scanStatus = /\b(failed|failure|rejected|invalid)\b/.test(message)
        ? 'FAILED'
        : /\b(success|successful|approved|entered)\b/.test(message)
          ? 'SUCCESS'
          : undefined;

      const logs = await this.prisma.entryLog.findMany({
        where: {
          ...(scanStatus ? { scanStatus } : {}),
          ...(dateRange
            ? {
                scannedAt: {
                  gte: dateRange.from,
                  lt: dateRange.to,
                },
              }
            : {}),
          ...(user.role === UserRole.ADMIN
            ? {}
            : {
                token: {
                  house: {
                    ownerId: user.id,
                  },
                },
              }),
        },
        include: {
          scanner: {
            select: {
              id: true,
              fullName: true,
              email: true,
              role: true,
            },
          },
          token: {
            include: {
              visitor: true,
              house: {
                include: {
                  owner: {
                    select: {
                      id: true,
                      fullName: true,
                      email: true,
                      role: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: {
          scannedAt: 'desc',
        },
        take: 100,
      });

      return {
        status: 'COMPLETED',
        filters: {
          date: dateRange?.label ?? null,
          scanStatus: scanStatus ?? null,
        },
        count: logs.length,
        data: logs.map((log) => ({
          ...log,
          token: log.token
            ? {
                ...log.token,
                qrPayload: log.token.tokenCode,
                status: this.getVisitTokenStatus(log.token),
              }
            : null,
        })),
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      const message =
        error instanceof Error
          ? error.message
          : 'Unknown entry log agent error';
      const stack = error instanceof Error ? error.stack : undefined;

      this.logger.error(`Entry log agent failed: ${message}`, stack);

      throw new InternalServerErrorException(
        'Entry log search failed. Please try again.',
      );
    }
  }

  async securityAnalyticsAgent(
    dto: SecurityAnalyticsAgentDto,
    user: AuthenticatedUser,
  ) {
    this.logger.log(
      `Starting security analytics agent. Message length: ${dto.message.length}`,
    );

    try {
      const extractedFilters = await this.extractSecurityAnalyticsFilters(
        dto.message,
      );
      const filters = this.applySecurityAnalyticsFallbacks(
        extractedFilters,
        dto.message,
      );
      const dateRange = this.buildDateRange(filters.fromDate, filters.toDate);
      const ownerId = user.role === UserRole.OWNER ? user.id : undefined;
      let houseId: string | undefined;

      if (filters.houseNumber) {
        houseId = await this.resolveAnalyticsHouseId(
          ownerId,
          filters.houseNumber,
        );

        if (!houseId) {
          return {
            status: 'HOUSE_NOT_FOUND',
            message: `House ${filters.houseNumber} was not found.`,
            filters,
          };
        }
      }

      switch (filters.analyticsType) {
        case 'FREQUENT_VISITORS':
          return this.getFrequentVisitorsAnalytics(
            ownerId,
            filters,
            dateRange,
            houseId,
          );

        case 'HOUSE_VISITOR_COUNTS':
          return this.getHouseVisitorCountsAnalytics(
            ownerId,
            filters,
            dateRange,
            houseId,
          );

        case 'REPEATED_CNICS':
          return this.getRepeatedCnicAnalytics(
            ownerId,
            filters,
            dateRange,
            houseId,
          );

        case 'REPEATED_CAR_NUMBERS':
          return this.getRepeatedCarNumberAnalytics(
            ownerId,
            filters,
            dateRange,
            houseId,
          );

        case 'EXPIRED_PASS_USAGE':
          return this.getExpiredPassUsageAnalytics(
            ownerId,
            filters,
            dateRange,
            houseId,
          );

        case 'FAILED_SCANS':
          return this.getFailedScanAnalytics(
            ownerId,
            filters,
            dateRange,
            houseId,
          );

        case 'SUSPICIOUS_ACTIVITY':
          return this.getSuspiciousActivityAnalytics(
            ownerId,
            filters,
            dateRange,
            houseId,
          );

        case 'SUMMARY':
        case 'UNKNOWN':
        default:
          return this.getSecuritySummaryAnalytics(
            ownerId,
            filters,
            dateRange,
            houseId,
          );
      }
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      const message =
        error instanceof Error
          ? error.message
          : 'Unknown security analytics agent error';
      const stack = error instanceof Error ? error.stack : undefined;

      this.logger.error(`Security analytics agent failed: ${message}`, stack);

      throw new InternalServerErrorException(
        'Security analytics failed. Please try again.',
      );
    }
  }

  private async extractSecurityAnalyticsFilters(
    message: string,
  ): Promise<SecurityAnalyticsFilters> {
    const result =
      process.env.AI_PROVIDER === 'openai'
        ? await this.extractSecurityAnalyticsFiltersWithOpenAI(message)
        : await this.extractSecurityAnalyticsFiltersWithGemini(message);

    return SecurityAnalyticsFiltersSchema.parse(result);
  }

  private async extractSecurityAnalyticsFiltersWithOpenAI(
    message: string,
  ): Promise<SecurityAnalyticsFilters> {
    const completion = await this.openai.chat.completions.parse({
      model: 'gpt-4o-mini',
      temperature: 0,
      messages: [
        {
          role: 'system',
          content: this.getSecurityAnalyticsPrompt(),
        },
        {
          role: 'user',
          content: message,
        },
      ],
      response_format: zodResponseFormat(
        SecurityAnalyticsFiltersSchema,
        'security_analytics_filters',
      ),
    });

    return SecurityAnalyticsFiltersSchema.parse(
      completion.choices[0].message.parsed,
    );
  }

  private async extractSecurityAnalyticsFiltersWithGemini(
    message: string,
  ): Promise<SecurityAnalyticsFilters> {
    const response = await this.gemini.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: message,
      config: {
        temperature: 0,
        systemInstruction: this.getSecurityAnalyticsPrompt(),
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            intent: {
              type: Type.STRING,
            },
            analyticsType: {
              type: Type.STRING,
              enum: [...SECURITY_ANALYTICS_TYPES],
            },
            houseNumber: {
              type: Type.STRING,
              nullable: true,
            },
            visitorName: {
              type: Type.STRING,
              nullable: true,
            },
            cnic: {
              type: Type.STRING,
              nullable: true,
            },
            carNumber: {
              type: Type.STRING,
              nullable: true,
            },
            fromDate: {
              type: Type.STRING,
              nullable: true,
            },
            toDate: {
              type: Type.STRING,
              nullable: true,
            },
          },
          required: [
            'intent',
            'analyticsType',
            'houseNumber',
            'visitorName',
            'cnic',
            'carNumber',
            'fromDate',
            'toDate',
          ],
        },
      },
    });

    return SecurityAnalyticsFiltersSchema.parse(
      JSON.parse(response.text ?? '{}'),
    );
  }

  private getSecurityAnalyticsPrompt(): string {
    return `You are a security analytics filter extraction assistant for a society gate pass system.

Extract analytics intent and filters.

analyticsType values:
- SUSPICIOUS_ACTIVITY: suspicious/unusual activity, risk, anomalies
- FREQUENT_VISITORS: most frequent visitor, visitor came more than N times
- HOUSE_VISITOR_COUNTS: houses with most visitors, visitor count by house
- REPEATED_CNICS: same CNIC used multiple times
- REPEATED_CAR_NUMBERS: same car number used multiple times
- EXPIRED_PASS_USAGE: expired pass used, expired QR scanned
- FAILED_SCANS: failed scan attempts, invalid QR attempts
- SUMMARY: daily/weekly/monthly security summary
- UNKNOWN: unclear request

Rules:
- Return intent as SECURITY_ANALYTICS.
- Return null for missing filters.
- Convert dates to YYYY-MM-DD.
- If user says today, use current server date.
- If user says yesterday, use previous day.
- If user says this week, use current week.
- If user says last week, use previous 7 days.
- If user says this month, use current month date range.
- If date is like 10-06-2026, treat it as DD-MM-YYYY.
- Do not invent values.
- Return JSON only.

Current server date: ${this.getPakistanDateString()}`;
  }

  private applySecurityAnalyticsFallbacks(
    filters: SecurityAnalyticsFilters,
    message: string,
  ): SecurityAnalyticsFilters {
    const dateRange = this.extractSecurityAnalyticsDateRange(message);
    let analyticsType = this.inferSecurityAnalyticsType(message);

    if (analyticsType === 'UNKNOWN') {
      analyticsType = filters.analyticsType;
    }

    return {
      ...filters,
      analyticsType,
      ...(dateRange
        ? {
            fromDate: dateRange.fromDate,
            toDate: dateRange.toDate,
          }
        : {}),
    };
  }

  private inferSecurityAnalyticsType(
    message: string,
  ): SecurityAnalyticsFilters['analyticsType'] {
    const normalizedMessage = message.toLowerCase();

    if (/\b(cnic|id card|national id)\b/.test(normalizedMessage)) {
      return 'REPEATED_CNICS';
    }

    if (/\b(car|vehicle|number plate|plate)\b/.test(normalizedMessage)) {
      return 'REPEATED_CAR_NUMBERS';
    }

    if (/\bhouse|houses\b/.test(normalizedMessage)) {
      if (
        /\b(most|top|ranking|rank|count|counts|visitor count|visitors)\b/.test(
          normalizedMessage,
        )
      ) {
        return 'HOUSE_VISITOR_COUNTS';
      }
    }

    if (
      /\b(frequent|frequently|most|top|ranking|rank|more than \d+)\b/.test(
        normalizedMessage,
      )
    ) {
      return 'FREQUENT_VISITORS';
    }

    if (/\bexpired\b/.test(normalizedMessage)) {
      return 'EXPIRED_PASS_USAGE';
    }

    if (/\bfailed|failure|invalid|rejected\b/.test(normalizedMessage)) {
      return 'FAILED_SCANS';
    }

    if (
      /\b(suspicious|unusual|risk|anomal|pattern)\b/.test(normalizedMessage)
    ) {
      return 'SUSPICIOUS_ACTIVITY';
    }

    if (/\bsummary|overview|report\b/.test(normalizedMessage)) {
      return 'SUMMARY';
    }

    return 'UNKNOWN';
  }

  private buildDateRange(fromDate?: string | null, toDate?: string | null) {
    const today = this.getPakistanDateString();
    const fallbackFrom = this.shiftPakistanDate(today, -29);
    const effectiveFrom = fromDate ?? toDate ?? fallbackFrom;
    const effectiveTo = toDate ?? fromDate ?? today;

    return {
      from: new Date(`${effectiveFrom.slice(0, 10)}T00:00:00.000+05:00`),
      to: new Date(`${effectiveTo.slice(0, 10)}T23:59:59.999+05:00`),
    };
  }

  private extractSecurityAnalyticsDateRange(
    message: string,
  ): { fromDate: string; toDate: string } | null {
    const normalizedMessage = message.toLowerCase();
    const today = this.getPakistanDateString();
    const explicitDate = message.match(/\b(\d{2})-(\d{2})-(\d{4})\b/);

    if (explicitDate) {
      const [, day, month, year] = explicitDate;
      const date = `${year}-${month}-${day}`;

      return { fromDate: date, toDate: date };
    }

    if (/\byesterday\b/.test(normalizedMessage)) {
      const date = this.shiftPakistanDate(today, -1);

      return { fromDate: date, toDate: date };
    }

    if (/\btoday\b/.test(normalizedMessage)) {
      return { fromDate: today, toDate: today };
    }

    if (/\bthis month\b/.test(normalizedMessage)) {
      return {
        fromDate: `${today.slice(0, 8)}01`,
        toDate: today,
      };
    }

    if (/\bthis week\b/.test(normalizedMessage)) {
      return {
        fromDate: this.getPakistanWeekStartDateString(today),
        toDate: today,
      };
    }

    if (
      /\blast week\b|\bpast week\b|\bprevious week\b/.test(normalizedMessage)
    ) {
      return {
        fromDate: this.shiftPakistanDate(today, -7),
        toDate: today,
      };
    }

    return null;
  }

  private getPakistanDateString(date = new Date()): string {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Karachi',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    return formatter.format(date);
  }

  private shiftPakistanDate(dateValue: string, days: number): string {
    const date = new Date(`${dateValue.slice(0, 10)}T12:00:00.000+05:00`);
    date.setUTCDate(date.getUTCDate() + days);

    return this.getPakistanDateString(date);
  }

  private getPakistanWeekStartDateString(dateValue: string): string {
    const date = new Date(`${dateValue.slice(0, 10)}T12:00:00.000+05:00`);
    const day = date.getUTCDay();
    const daysFromMonday = day === 0 ? 6 : day - 1;

    return this.shiftPakistanDate(dateValue, -daysFromMonday);
  }

  private getVisitTokenAnalyticsWhere(
    ownerId: string | undefined,
    dateRange: { from: Date; to: Date },
    houseId?: string,
  ): Prisma.VisitTokenWhereInput {
    return {
      ...(ownerId ? { house: { ownerId } } : {}),
      ...(houseId ? { houseId } : {}),
      createdAt: {
        gte: dateRange.from,
        lte: dateRange.to,
      },
    };
  }

  private getEntryLogAnalyticsWhere(
    ownerId: string | undefined,
    dateRange: { from: Date; to: Date },
    houseId?: string,
  ): Prisma.EntryLogWhereInput {
    return {
      scannedAt: {
        gte: dateRange.from,
        lte: dateRange.to,
      },
      ...(houseId || ownerId
        ? {
            token: {
              ...(houseId ? { houseId } : {}),
              ...(ownerId ? { house: { ownerId } } : {}),
            },
          }
        : {}),
    };
  }

  private getAnalyticsTokenInclude() {
    return {
      visitor: true,
      house: true,
    } satisfies Prisma.VisitTokenInclude;
  }

  private async getFrequentVisitorsAnalytics(
    ownerId: string | undefined,
    filters: SecurityAnalyticsFilters,
    dateRange: { from: Date; to: Date },
    houseId?: string,
  ) {
    const tokens = await this.prisma.visitToken.findMany({
      where: this.getVisitTokenAnalyticsWhere(ownerId, dateRange, houseId),
      include: this.getAnalyticsTokenInclude(),
      orderBy: {
        createdAt: 'desc',
      },
    });
    const grouped = new Map<
      string,
      {
        visitorName: string;
        cnic: string | null;
        count: number;
        lastVisitAt: Date;
      }
    >();

    for (const token of tokens) {
      const key = token.visitor.cnic || token.visitor.fullName;
      const current = grouped.get(key);

      grouped.set(key, {
        visitorName: token.visitor.fullName,
        cnic: token.visitor.cnic,
        count: (current?.count ?? 0) + 1,
        lastVisitAt:
          current && current.lastVisitAt > token.createdAt
            ? current.lastVisitAt
            : token.createdAt,
      });
    }

    const data = [...grouped.values()].sort((a, b) => b.count - a.count);
    const topVisitor = data[0];

    return {
      status: 'COMPLETED',
      analyticsType: 'FREQUENT_VISITORS',
      filters,
      count: data.length,
      summary: topVisitor
        ? `${topVisitor.visitorName} visited ${topVisitor.count} time(s) in this period.`
        : 'No visitor activity was found in this period.',
      data,
    };
  }

  private async getHouseVisitorCountsAnalytics(
    ownerId: string | undefined,
    filters: SecurityAnalyticsFilters,
    dateRange: { from: Date; to: Date },
    houseId?: string,
  ) {
    const tokens = await this.prisma.visitToken.findMany({
      where: this.getVisitTokenAnalyticsWhere(ownerId, dateRange, houseId),
      include: {
        house: true,
      },
    });
    const grouped = new Map<
      string,
      { houseId: string; houseNumber: string; count: number }
    >();

    for (const token of tokens) {
      const current = grouped.get(token.houseId);

      grouped.set(token.houseId, {
        houseId: token.houseId,
        houseNumber: token.house.houseNumber,
        count: (current?.count ?? 0) + 1,
      });
    }

    const data = [...grouped.values()].sort((a, b) => b.count - a.count);
    const topHouse = data[0];

    return {
      status: 'COMPLETED',
      analyticsType: 'HOUSE_VISITOR_COUNTS',
      filters,
      count: data.length,
      summary: topHouse
        ? `House ${topHouse.houseNumber} had the most visitors with ${topHouse.count} pass(es).`
        : 'No house visitor activity was found in this period.',
      data,
    };
  }

  private async getRepeatedCnicAnalytics(
    ownerId: string | undefined,
    filters: SecurityAnalyticsFilters,
    dateRange: { from: Date; to: Date },
    houseId?: string,
  ) {
    const tokens = await this.prisma.visitToken.findMany({
      where: this.getVisitTokenAnalyticsWhere(ownerId, dateRange, houseId),
      include: this.getAnalyticsTokenInclude(),
      orderBy: {
        createdAt: 'desc',
      },
    });
    const grouped = new Map<
      string,
      {
        cnic: string;
        visitorName: string;
        count: number;
        passes: Array<{
          id: string;
          houseNumber: string;
          carNumber: string;
          createdAt: Date;
          expiresAt: Date;
        }>;
      }
    >();

    for (const token of tokens) {
      const current = grouped.get(token.visitor.cnic);

      grouped.set(token.visitor.cnic, {
        cnic: token.visitor.cnic,
        visitorName: token.visitor.fullName,
        count: (current?.count ?? 0) + 1,
        passes: [
          ...(current?.passes ?? []),
          {
            id: token.id,
            houseNumber: token.house.houseNumber,
            carNumber: token.carNumber,
            createdAt: token.createdAt,
            expiresAt: token.expiresAt,
          },
        ],
      });
    }

    const data = [...grouped.values()]
      .filter((item) => item.count > 1)
      .sort((a, b) => b.count - a.count);

    return {
      status: 'COMPLETED',
      analyticsType: 'REPEATED_CNICS',
      filters,
      count: data.length,
      summary:
        data.length > 0
          ? `${data.length} repeated CNIC(s) were found in this period.`
          : 'No repeated CNIC visitors were found in this period.',
      data,
    };
  }

  private async getRepeatedCarNumberAnalytics(
    ownerId: string | undefined,
    filters: SecurityAnalyticsFilters,
    dateRange: { from: Date; to: Date },
    houseId?: string,
  ) {
    const tokens = await this.prisma.visitToken.findMany({
      where: this.getVisitTokenAnalyticsWhere(ownerId, dateRange, houseId),
      include: this.getAnalyticsTokenInclude(),
      orderBy: {
        createdAt: 'desc',
      },
    });
    const grouped = new Map<
      string,
      {
        carNumber: string;
        count: number;
        houseNumbers: string[];
        passes: Array<{
          id: string;
          visitorName: string;
          cnic: string;
          houseNumber: string;
          createdAt: Date;
        }>;
      }
    >();

    for (const token of tokens) {
      const normalizedCarNumber = token.carNumber
        .replace(/[^a-zA-Z0-9]/g, '')
        .toUpperCase();
      const current = grouped.get(normalizedCarNumber);
      const houseNumbers = new Set(current?.houseNumbers ?? []);

      houseNumbers.add(token.house.houseNumber);
      grouped.set(normalizedCarNumber, {
        carNumber: token.carNumber,
        count: (current?.count ?? 0) + 1,
        houseNumbers: [...houseNumbers],
        passes: [
          ...(current?.passes ?? []),
          {
            id: token.id,
            visitorName: token.visitor.fullName,
            cnic: token.visitor.cnic,
            houseNumber: token.house.houseNumber,
            createdAt: token.createdAt,
          },
        ],
      });
    }

    const data = [...grouped.values()]
      .filter((item) => item.count > 1)
      .sort((a, b) => b.count - a.count);

    return {
      status: 'COMPLETED',
      analyticsType: 'REPEATED_CAR_NUMBERS',
      filters,
      count: data.length,
      summary:
        data.length > 0
          ? `${data.length} repeated car number(s) were found in this period.`
          : 'No repeated car numbers were found in this period.',
      data,
    };
  }

  private async getExpiredPassUsageAnalytics(
    ownerId: string | undefined,
    filters: SecurityAnalyticsFilters,
    dateRange: { from: Date; to: Date },
    houseId?: string,
  ) {
    const logs = await this.prisma.entryLog.findMany({
      where: {
        ...this.getEntryLogAnalyticsWhere(ownerId, dateRange, houseId),
        token: {
          ...(houseId ? { houseId } : {}),
          ...(ownerId ? { house: { ownerId } } : {}),
          expiresAt: {
            lt: dateRange.to,
          },
        },
      },
      include: {
        scanner: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
          },
        },
        token: {
          include: this.getAnalyticsTokenInclude(),
        },
      },
      orderBy: {
        scannedAt: 'desc',
      },
    });
    const data = logs
      .filter((log) => log.token && log.scannedAt > log.token.expiresAt)
      .map((log) => ({
        id: log.id,
        scanStatus: log.scanStatus,
        scannedAt: log.scannedAt,
        failureReason: log.failureReason,
        scanner: log.scanner,
        pass: log.token
          ? {
              id: log.token.id,
              visitorName: log.token.visitor.fullName,
              cnic: log.token.visitor.cnic,
              houseNumber: log.token.house.houseNumber,
              carNumber: log.token.carNumber,
              expiresAt: log.token.expiresAt,
            }
          : null,
      }));

    return {
      status: 'COMPLETED',
      analyticsType: 'EXPIRED_PASS_USAGE',
      filters,
      count: data.length,
      summary:
        data.length > 0
          ? `${data.length} expired pass scan(s) were found in this period.`
          : 'No expired pass usage was found in this period.',
      data,
    };
  }

  private async getFailedScanAnalytics(
    ownerId: string | undefined,
    filters: SecurityAnalyticsFilters,
    dateRange: { from: Date; to: Date },
    houseId?: string,
  ) {
    const logs = await this.prisma.entryLog.findMany({
      where: {
        ...this.getEntryLogAnalyticsWhere(ownerId, dateRange, houseId),
        scanStatus: ScanStatus.FAILED,
      },
      include: {
        scanner: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
          },
        },
        token: {
          include: this.getAnalyticsTokenInclude(),
        },
      },
      orderBy: {
        scannedAt: 'desc',
      },
    });
    const data = logs.map((log) => ({
      id: log.id,
      scannedAt: log.scannedAt,
      failureReason: log.failureReason,
      scanner: log.scanner,
      pass: log.token
        ? {
            id: log.token.id,
            visitorName: log.token.visitor.fullName,
            cnic: log.token.visitor.cnic,
            houseNumber: log.token.house.houseNumber,
            carNumber: log.token.carNumber,
            expiresAt: log.token.expiresAt,
          }
        : null,
    }));

    return {
      status: 'COMPLETED',
      analyticsType: 'FAILED_SCANS',
      filters,
      count: data.length,
      summary:
        data.length > 0
          ? `${data.length} failed scan(s) were found in this period.`
          : 'No failed scan attempts were found in this period.',
      data,
    };
  }

  private async getSuspiciousActivityAnalytics(
    ownerId: string | undefined,
    filters: SecurityAnalyticsFilters,
    dateRange: { from: Date; to: Date },
    houseId?: string,
  ) {
    const [repeatedCnics, repeatedCarNumbers, expiredPassUsage, failedScans] =
      await Promise.all([
        this.getRepeatedCnicAnalytics(ownerId, filters, dateRange, houseId),
        this.getRepeatedCarNumberAnalytics(
          ownerId,
          filters,
          dateRange,
          houseId,
        ),
        this.getExpiredPassUsageAnalytics(ownerId, filters, dateRange, houseId),
        this.getFailedScanAnalytics(ownerId, filters, dateRange, houseId),
      ]);
    const signals: Array<{
      type: string;
      severity: 'LOW' | 'MEDIUM' | 'HIGH';
      count: number;
      message: string;
      data?: unknown[];
    }> = [];

    if (repeatedCnics.count > 0) {
      signals.push({
        type: 'REPEATED_CNICS',
        severity: repeatedCnics.count > 2 ? 'HIGH' : 'MEDIUM',
        count: repeatedCnics.count,
        message: `${repeatedCnics.count} repeated CNIC group(s) found.`,
        data: repeatedCnics.data,
      });
    }

    if (repeatedCarNumbers.count > 0) {
      const multiHouseCars = repeatedCarNumbers.data.filter(
        (item) => item.houseNumbers.length > 1,
      );

      signals.push({
        type: 'REPEATED_CAR_NUMBERS',
        severity: multiHouseCars.length > 0 ? 'HIGH' : 'MEDIUM',
        count: repeatedCarNumbers.count,
        message:
          multiHouseCars.length > 0
            ? `${multiHouseCars.length} car number(s) visited multiple houses.`
            : `${repeatedCarNumbers.count} repeated car number group(s) found.`,
        data: repeatedCarNumbers.data,
      });
    }

    if (expiredPassUsage.count > 0) {
      signals.push({
        type: 'EXPIRED_PASS_USAGE',
        severity: 'HIGH',
        count: expiredPassUsage.count,
        message: `${expiredPassUsage.count} expired pass scan(s) found.`,
        data: expiredPassUsage.data,
      });
    }

    if (failedScans.count > 0) {
      signals.push({
        type: 'FAILED_SCANS',
        severity: failedScans.count > 3 ? 'HIGH' : 'MEDIUM',
        count: failedScans.count,
        message: `${failedScans.count} failed scan attempt(s) found.`,
        data: failedScans.data,
      });
    }

    const riskLevel =
      signals.length === 0 ? 'LOW' : signals.length <= 2 ? 'MEDIUM' : 'HIGH';

    return {
      status: 'COMPLETED',
      analyticsType: 'SUSPICIOUS_ACTIVITY',
      filters,
      riskLevel,
      signals,
      summary:
        signals.length > 0
          ? `Security risk is ${riskLevel}. ${signals.length} suspicious signal(s) were found.`
          : 'Security risk is LOW. No suspicious activity was found in this period.',
    };
  }

  private async getSecuritySummaryAnalytics(
    ownerId: string | undefined,
    filters: SecurityAnalyticsFilters,
    dateRange: { from: Date; to: Date },
    houseId?: string,
  ) {
    const [
      totalPasses,
      totalEntries,
      failedScans,
      repeatedCnics,
      repeatedCarNumbers,
      frequentVisitors,
      houseCounts,
      suspiciousActivity,
    ] = await Promise.all([
      this.prisma.visitToken.count({
        where: this.getVisitTokenAnalyticsWhere(ownerId, dateRange, houseId),
      }),
      this.prisma.entryLog.count({
        where: this.getEntryLogAnalyticsWhere(ownerId, dateRange, houseId),
      }),
      this.prisma.entryLog.count({
        where: {
          ...this.getEntryLogAnalyticsWhere(ownerId, dateRange, houseId),
          scanStatus: ScanStatus.FAILED,
        },
      }),
      this.getRepeatedCnicAnalytics(ownerId, filters, dateRange, houseId),
      this.getRepeatedCarNumberAnalytics(ownerId, filters, dateRange, houseId),
      this.getFrequentVisitorsAnalytics(ownerId, filters, dateRange, houseId),
      this.getHouseVisitorCountsAnalytics(ownerId, filters, dateRange, houseId),
      this.getSuspiciousActivityAnalytics(ownerId, filters, dateRange, houseId),
    ]);

    const topVisitor = frequentVisitors.data[0] ?? null;
    const topHouse = houseCounts.data[0] ?? null;

    return {
      status: 'COMPLETED',
      analyticsType: 'SUMMARY',
      filters,
      riskLevel: suspiciousActivity.riskLevel,
      summary: `Security risk is ${suspiciousActivity.riskLevel}. ${totalPasses} pass(es), ${totalEntries} gate scan(s), and ${failedScans} failed scan(s) were found in this period.`,
      data: {
        totalPasses,
        totalEntries,
        failedScans,
        repeatedCnicCount: repeatedCnics.count,
        repeatedCarNumberCount: repeatedCarNumbers.count,
        topVisitor,
        topHouse,
        riskLevel: suspiciousActivity.riskLevel,
      },
    };
  }

  async deactivatePassAgent(ownerId: string, tokenId?: string) {
    this.logger.log('Starting deactivate pass agent');

    try {
      const latestToken = await this.prisma.visitToken.findFirst({
        where: {
          ...(tokenId ? { id: tokenId } : {}),
          ...(tokenId
            ? {
                house: {
                  ownerId,
                },
              }
            : { createdBy: ownerId }),
          isActive: true,
          ...(tokenId
            ? {}
            : {
                isUsed: false,
                expiresAt: {
                  gte: new Date(),
                },
              }),
        },
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          id: true,
        },
      });

      if (!latestToken) {
        return {
          status: 'NOT_FOUND',
          message: 'No active visitor pass was found to deactivate.',
        };
      }

      const gatePass = await this.visitTokensService.deactivate(
        ownerId,
        latestToken.id,
      );

      return {
        status: 'COMPLETED',
        message: tokenId
          ? 'Visitor pass deactivated successfully.'
          : 'Latest visitor pass deactivated successfully.',
        gatePass,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      const message =
        error instanceof Error
          ? error.message
          : 'Unknown deactivate pass agent error';
      const stack = error instanceof Error ? error.stack : undefined;

      this.logger.error(`Deactivate pass agent failed: ${message}`, stack);

      throw new InternalServerErrorException(
        'Visitor pass deactivation failed. Please try again.',
      );
    }
  }

  private extractEntryLogDateRange(
    message: string,
  ): { from: Date; to: Date; label: string } | null {
    const normalizedMessage = message.toLowerCase();
    const explicitDate = message.match(/\b(\d{2})-(\d{2})-(\d{4})\b/);

    if (explicitDate) {
      const [, day, month, year] = explicitDate;
      const date = new Date(Number(year), Number(month) - 1, Number(day));

      return this.toLocalDayRange(date, `${year}-${month}-${day}`);
    }

    if (/\byesterday\b/.test(normalizedMessage)) {
      const date = new Date();
      date.setDate(date.getDate() - 1);

      return this.toLocalDayRange(date, 'yesterday');
    }

    if (/\btoday\b/.test(normalizedMessage)) {
      return this.toLocalDayRange(new Date(), 'today');
    }

    if (
      /\blast week\b|\bpast week\b|\bprevious week\b/.test(normalizedMessage)
    ) {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 7);

      return {
        from,
        to,
        label: 'last_week',
      };
    }

    return null;
  }

  private toLocalDayRange(
    date: Date,
    label: string,
  ): { from: Date; to: Date; label: string } {
    const from = new Date(date);
    from.setHours(0, 0, 0, 0);

    const to = new Date(from);
    to.setDate(to.getDate() + 1);

    return {
      from,
      to,
      label,
    };
  }

  private getVisitTokenStatus(visitToken: {
    isActive: boolean;
    isUsed: boolean;
    expiresAt: Date;
  }): 'ACTIVE' | 'USED' | 'REVOKED' | 'EXPIRED' {
    if (!visitToken.isActive) {
      return 'REVOKED';
    }

    if (visitToken.isUsed) {
      return 'USED';
    }

    if (visitToken.expiresAt < new Date()) {
      return 'EXPIRED';
    }

    return 'ACTIVE';
  }

  async checkPassStatusAgent(
    input: {
      target?: AgentMemoryTarget;
      lastContext?: AgentMemoryContextData | null;
    },
    user: AuthenticatedUser,
  ) {
    const targetPass = resolveMemoryTarget(input.target, input.lastContext);

    if (!targetPass) {
      return {
        status: 'CONTEXT_NOT_FOUND',
        message:
          'I could not find the pass you are referring to. Please search the pass first or provide pass details.',
      };
    }

    const pass = await this.prisma.visitToken.findFirst({
      where: {
        id: targetPass.id,
        ...(user.role === UserRole.ADMIN
          ? {}
          : {
              house: {
                ownerId: user.id,
              },
            }),
      },
      include: {
        visitor: true,
        house: {
          include: {
            owner: {
              select: {
                id: true,
                fullName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!pass) {
      return {
        status: 'PASS_NOT_FOUND',
        message: 'The referenced pass was not found.',
      };
    }

    const passStatus = this.getVisitTokenStatus(pass);
    const message =
      passStatus === 'ACTIVE'
        ? 'No, this pass is still valid.'
        : passStatus === 'EXPIRED'
          ? 'Yes, this pass is expired.'
          : passStatus === 'REVOKED'
            ? 'This pass has been deactivated.'
            : 'This pass has already been used.';

    return {
      status: 'COMPLETED',
      expired: passStatus === 'EXPIRED',
      pass: {
        ...pass,
        qrPayload: pass.tokenCode,
        status: passStatus,
      },
      message,
    };
  }

  async showPassDetailsAgent(
    input: {
      target?: AgentMemoryTarget;
      lastContext?: AgentMemoryContextData | null;
    },
    user: AuthenticatedUser,
  ) {
    const targetPass = resolveMemoryTarget(input.target, input.lastContext);

    if (!targetPass) {
      return {
        status: 'CONTEXT_NOT_FOUND',
        message:
          'I could not find the pass you are referring to. Please search the pass first.',
      };
    }

    const pass = await this.prisma.visitToken.findFirst({
      where: {
        id: targetPass.id,
        ...(user.role === UserRole.ADMIN
          ? {}
          : {
              house: {
                ownerId: user.id,
              },
            }),
      },
      include: {
        visitor: true,
        house: {
          include: {
            owner: {
              select: {
                id: true,
                fullName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!pass) {
      return {
        status: 'PASS_NOT_FOUND',
        message: 'The referenced pass was not found.',
      };
    }

    return {
      status: 'COMPLETED',
      message: 'Here are the pass details.',
      pass: {
        ...pass,
        qrPayload: pass.tokenCode,
        status: this.getVisitTokenStatus(pass),
      },
    };
  }

  async smartVisitorPassAssistant(dto: ContinueAiPassDto, ownerId: string) {
    this.logger.log(
      `Starting smart visitor pass assistant. Conversation ID: ${
        dto.conversationId ?? 'new'
      }. Message length: ${dto.message.length}`,
    );

    try {
      let conversation: AiConversation;

      if (dto.conversationId) {
        this.logger.log(
          `Looking up smart visitor pass conversation: ${dto.conversationId}`,
        );

        const existingConversation = await this.prisma.aiConversation.findFirst(
          {
            where: {
              id: dto.conversationId,
              ownerId,
            },
          },
        );

        if (!existingConversation) {
          this.logger.warn(
            `Smart visitor pass conversation not found: ${dto.conversationId}`,
          );

          throw new NotFoundException('Conversation not found');
        }

        conversation = existingConversation;
      } else {
        this.logger.log('Creating new smart visitor pass conversation');

        conversation = await this.prisma.aiConversation.create({
          data: {
            ownerId,
            collectedData: {},
            missingFields: [],
            status: AI_PASS_STATUS.IN_PROGRESS,
          },
        });

        this.logger.log(
          `Created smart visitor pass conversation: ${conversation.id}`,
        );
      }

      const extractedData = await this.extractVisitorPassFields(
        dto.message,
        Array.isArray(conversation.missingFields)
          ? (conversation.missingFields as string[])
          : [],
      );
      const extractedFields = Object.keys(extractedData);

      this.logger.log(
        `Smart visitor pass extraction found fields: ${
          extractedFields.length > 0 ? extractedFields.join(', ') : 'none'
        }`,
      );

      const collectedData: VisitorPassCollectedData = {
        ...(conversation.collectedData as VisitorPassCollectedData),
        ...extractedData,
      };

      let missingFields = this.getMissingFields(collectedData);
      let missingFieldMessage = `Please provide ${missingFields.join(', ')}.`;

      if (missingFields.length === 0 && collectedData.houseNumber) {
        const house = await this.findOwnerHouseByNumber(
          ownerId,
          collectedData.houseNumber,
        );

        if (!house) {
          const invalidHouseNumber = collectedData.houseNumber;

          delete collectedData.houseNumber;
          missingFields = ['houseNumber'];
          missingFieldMessage = `House ${invalidHouseNumber} was not found. Please provide a valid house number.`;
        }
      }

      const status =
        missingFields.length > 0
          ? AI_PASS_STATUS.IN_PROGRESS
          : AI_PASS_STATUS.READY;

      this.logger.log(
        `Updating smart visitor pass conversation ${conversation.id}. Status: ${status}. Missing fields: ${
          missingFields.length > 0 ? missingFields.join(', ') : 'none'
        }`,
      );

      const updatedConversation = await this.prisma.aiConversation.update({
        where: {
          id: conversation.id,
        },
        data: {
          collectedData,
          missingFields,
          status,
          userMessage: dto.message,
          aiResponse: {
            status:
              missingFields.length > 0
                ? AI_PASS_STATUS.MISSING_FIELDS
                : AI_PASS_STATUS.READY,
            message:
              missingFields.length > 0
                ? missingFieldMessage
                : 'Visitor pass information is complete.',
            missingFields,
          },
        },
      });

      if (missingFields.length > 0) {
        this.logger.log(
          `Smart visitor pass assistant awaiting missing fields for conversation ${updatedConversation.id}`,
        );

        return {
          status: AI_PASS_STATUS.MISSING_FIELDS,
          conversationId: updatedConversation.id,
          collectedData,
          missingFields,
          message: missingFieldMessage,
        };
      }

      this.logger.log(
        `Smart visitor pass assistant ready for conversation ${updatedConversation.id}`,
      );

      this.assertVisitorPassDataReady(collectedData);
      const gatePass = await this.createGatePassFromVisitorData(
        ownerId,
        collectedData,
      );

      await this.prisma.aiConversation.update({
        where: {
          id: updatedConversation.id,
        },
        data: {
          status: AI_PASS_STATUS.COMPLETED,
          userMessage: dto.message,
          aiResponse: {
            status: AI_PASS_STATUS.COMPLETED,
            message: 'Visitor pass created successfully.',
          },
        },
      });

      return {
        status: AI_PASS_STATUS.COMPLETED,
        conversationId: updatedConversation.id,
        data: collectedData,
        gatePass,
        message: 'Visitor pass created successfully.',
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      const message =
        error instanceof Error
          ? error.message
          : 'Unknown smart visitor pass assistant error';
      const stack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Smart visitor pass assistant failed: ${message}`,
        stack,
      );

      throw new InternalServerErrorException(
        'Smart visitor pass assistant failed. Please try again.',
      );
    }
  }

  private getMissingFields(data: VisitorPassCollectedData): string[] {
    return REQUIRED_VISITOR_PASS_FIELDS.filter((field) => !data[field]);
  }

  private assertVisitorPassDataReady(
    data: VisitorPassCollectedData,
  ): asserts data is CompleteVisitorPassCollectedData {
    const missingFields = this.getMissingFields(data);

    if (missingFields.length > 0) {
      throw new InternalServerErrorException(
        `Visitor pass data is missing required fields: ${missingFields.join(', ')}`,
      );
    }
  }

  private async createGatePassFromVisitorData(
    ownerId: string,
    data: CompleteVisitorPassCollectedData,
  ) {
    const house = await this.findOwnerHouseByNumber(ownerId, data.houseNumber);

    if (!house) {
      throw new NotFoundException(
        `House ${data.houseNumber} was not found for this owner.`,
      );
    }

    return this.visitTokensService.create(ownerId, {
      fullName: data.visitorName,
      cnic: data.cnic,
      carNumber: data.carNumber,
      houseId: house.id,
    });
  }

  private async findOwnerHouseByNumber(ownerId: string, houseNumber: string) {
    const houses = await this.prisma.house.findMany({
      select: {
        id: true,
        houseNumber: true,
      },
      where: {
        ownerId,
      },
    });
    const normalizedHouseNumber = this.normalizeHouseNumber(houseNumber);

    return (
      houses.find(
        (house) =>
          this.normalizeHouseNumber(house.houseNumber) ===
          normalizedHouseNumber,
      ) ?? null
    );
  }

  private async resolveHouseId(ownerId: string, houseNumber: string) {
    const house = await this.findOwnerHouseByNumber(ownerId, houseNumber);

    return house?.id;
  }

  private async resolveAnalyticsHouseId(
    ownerId: string | undefined,
    houseNumber: string,
  ) {
    if (ownerId) {
      return this.resolveHouseId(ownerId, houseNumber);
    }

    const houses = await this.prisma.house.findMany({
      select: { id: true, houseNumber: true },
    });
    const normalizedHouseNumber = this.normalizeHouseNumber(houseNumber);

    return houses.find(
      (house) =>
        this.normalizeHouseNumber(house.houseNumber) === normalizedHouseNumber,
    )?.id;
  }
}
