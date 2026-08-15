// =====================================================
// 样品 DTO
// 详见 ADR-0011 §样品接收规则 + Phase 2 Day 1
// =====================================================

import { ApiProperty } from '@nestjs/swagger';
import { SampleStatus, SampleType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsEnum,
  IsOptional,
  IsNumberString,
  IsArray,
  IsUUID,
  IsDateString,
  IsInt,
  Min,
  Max,
  Matches,
} from 'class-validator';

/**
 * 创建样品(客户委托 → 接收)
 * 必填: 客户名 / 样品类型 / 称样量
 * 可选: 委托单号 / 客户声明纯度 / 留样位置 / 照片 / 备注
 */
export class CreateSampleDto {
  @ApiProperty({ example: '上海黄金交易所', description: '客户名称(必填,≤200字)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  customerName!: string;

  @ApiProperty({ required: false, example: 'SGE-2026-08-001', description: '客户委托单号' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  customerRef?: string;

  @ApiProperty({
    enum: SampleType,
    example: SampleType.GOLD_INGOT,
    description: '样品类型(金锭/金条/首饰/金粉/回收金料等)',
  })
  @IsEnum(SampleType)
  sampleType!: SampleType;

  @ApiProperty({
    required: false,
    example: '99.99',
    description: '客户声明纯度 %(可选,字符串数字格式)',
  })
  @IsOptional()
  @IsNumberString()
  declaredPurityPct?: string;

  @ApiProperty({
    example: '1.0234',
    description: '样品重量(克,必填,Decimal 字符串如 "1.0234")',
  })
  @IsNumberString()
  weightG!: string;

  @ApiProperty({ required: false, description: '留样位置(检测后归档位置)' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  storageLocation?: string;

  @ApiProperty({
    required: false,
    type: [String],
    description: '照片文件 ID 列表(MinIO UUID,Phase 2 Day 1 暂支持空)',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  photoFileIds?: string[];

  @ApiProperty({ required: false, maxLength: 500, description: '备注' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;
}

export class UpdateSampleDto {
  @ApiProperty({ required: false, enum: SampleStatus })
  @IsOptional()
  @IsEnum(SampleStatus)
  status?: SampleStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  storageLocation?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  remarks?: string;
}

export class SampleFilterDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  sampleNo?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  customerName?: string;

  @ApiProperty({ required: false, enum: SampleType })
  @IsOptional()
  @IsEnum(SampleType)
  sampleType?: SampleType;

  @ApiProperty({ required: false, enum: SampleStatus })
  @IsOptional()
  @IsEnum(SampleStatus)
  status?: SampleStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  toDate?: string;

  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiProperty({ required: false, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number;
}