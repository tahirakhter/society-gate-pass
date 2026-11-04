import { IsString, MinLength } from 'class-validator';

export class AiVisitorPassDto {
  @IsString()
  @MinLength(1)
  message: string;
}
