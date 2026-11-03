import { IsString, IsNotEmpty, IsUUID, IsOptional } from 'class-validator';

export class CreateHouseDto {
  @IsString()
  @IsNotEmpty()
  houseNumber: string;

  @IsString()
  @IsOptional()
  block?: string;

  @IsUUID()
  ownerId: string;
}

export class UpdateHouseDto {
  @IsString()
  @IsOptional()
  houseNumber?: string;

  @IsString()
  @IsOptional()
  block?: string;

  @IsUUID()
  @IsOptional()
  ownerId?: string;
}

export class AssignHouseOwnerDto {
  @IsUUID()
  ownerId: string;
}
