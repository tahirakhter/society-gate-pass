// ai/dto/continue-ai-pass.dto.ts

import { IsOptional, IsString } from 'class-validator';

export class ContinueAiPassDto {
  @IsString()
  message: string;

  @IsOptional()
  @IsString()
  conversationId?: string;
}
