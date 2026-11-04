import { IsString, MinLength } from 'class-validator';

export class SecurityAnalyticsAgentDto {
  @IsString()
  @MinLength(1)
  message: string;
}
