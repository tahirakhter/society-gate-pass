import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AiSettingsService {
  constructor(private readonly config: ConfigService) {}

  get toolCallingEnabled(): boolean {
    return this.config.get<string>('AI_TOOL_CALLING_ENABLED') === 'true';
  }

  get toolCallingModel(): string {
    return (
      this.config.get<string>('OPENAI_TOOL_CALLING_MODEL')?.trim() ||
      this.config.get<string>('OPENAI_MODEL')?.trim() ||
      'gpt-4o-mini'
    );
  }

  get maxToolRounds(): number {
    return this.getBoundedInteger('AI_MAX_TOOL_ROUNDS', 3, 1, 5);
  }

  get maxToolCallsPerRequest(): number {
    return this.getBoundedInteger('AI_MAX_TOOL_CALLS_PER_REQUEST', 5, 1, 10);
  }

  get toolTimeoutMs(): number {
    return this.getBoundedInteger('AI_TOOL_TIMEOUT_MS', 10_000, 1_000, 30_000);
  }

  get weatherTimeoutMs(): number {
    return this.getBoundedInteger(
      'WEATHER_REQUEST_TIMEOUT_MS',
      5_000,
      1_000,
      15_000,
    );
  }

  get timezone(): string {
    return this.config.get<string>('APP_TIMEZONE')?.trim() || 'Asia/Karachi';
  }

  private getBoundedInteger(
    key: string,
    fallback: number,
    minimum: number,
    maximum: number,
  ): number {
    const parsed = Number(this.config.get<string>(key));
    if (!Number.isInteger(parsed)) {
      return fallback;
    }

    return Math.min(maximum, Math.max(minimum, parsed));
  }
}
