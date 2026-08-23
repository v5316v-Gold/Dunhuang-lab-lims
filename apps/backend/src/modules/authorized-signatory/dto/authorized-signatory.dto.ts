import { IsArray, IsDateString, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAuthorizedSignatoryDto {
  // @IsUUID('all')  // admin seed 用全零 UUID 00000000-0000-0000-0000-000000000001,validator 默认 'all' 也拒绝
  // 改为只校验非空字符串(W2 D4 + 历史 seed 数据兼容)
  @IsString()
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

  @IsString()
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
