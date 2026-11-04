import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class EntryLogQueryDto {
  @IsUUID()
  @IsOptional()
  houseId?: string;

  @IsDateString()
  @IsOptional()
  date?: string;
}
