import { IsOptional, IsString, MinLength } from 'class-validator';

export class AiAgentDto {
  @IsString()
  @MinLength(1)
  message: string;

  @IsOptional()
  @IsString()
  conversationId?: string;
}
