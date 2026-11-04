import { IsString, MinLength } from 'class-validator';

export class VisitorSearchAgentDto {
  @IsString()
  @MinLength(1)
  message: string;
}
