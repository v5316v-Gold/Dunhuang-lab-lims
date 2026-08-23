import { IsArray, IsDateString, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAuthorizedSignatoryDto {
  @IsUUID()
  @IsNotEmpty()
  userId!: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  methods?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  sampleTypes?: string[];

  @IsDateString()
  @IsNotEmpty()
  effectiveFrom!: string;

  @IsDateString()
  @IsOptional()
  effectiveTo?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsUUID()
  @IsOptional()
  approvalDocFileId?: string;
}

export class UpdateAuthorizedSignatoryDto {
  @IsArray() @IsString({ each: true }) @IsOptional() methods?: string[];
  @IsArray() @IsString({ each: true }) @IsOptional() sampleTypes?: string[];
  @IsDateString() @IsOptional() effectiveFrom?: string;
  @IsDateString() @IsOptional() effectiveTo?: string;
  @IsString() @IsOptional() description?: string;
  @IsUUID() @IsOptional() approvalDocFileId?: string;
}
