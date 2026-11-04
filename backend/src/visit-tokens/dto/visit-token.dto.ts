import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';

const CNIC_REGEX = /^\d{5}-\d{7}-\d$/;
const CAR_NUMBER_REGEX = /^[A-Za-z0-9- ]+$/;

export class CreateVisitTokenDto {
  @IsString()
  @Matches(CNIC_REGEX, {
    message: 'CNIC must follow the format #####-#######-#',
  })
  cnic: string;

  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsString()
  @Matches(CAR_NUMBER_REGEX, {
    message:
      'Car number must be alphanumeric and may include spaces or hyphens',
  })
  carNumber: string;

  @IsUUID()
  houseId: string;

  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(72)
  expiryHours?: number;

  @IsDateString()
  @IsOptional()
  expiresAt?: string;
}

export class DeactivateVisitTokenDto {
  @IsString()
  @IsOptional()
  reason?: string;
}

export class ValidateVisitTokenDto {
  @IsString()
  @IsNotEmpty()
  tokenCode: string;
}
