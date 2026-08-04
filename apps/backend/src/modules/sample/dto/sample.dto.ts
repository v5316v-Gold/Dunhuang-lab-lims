// =====================================================
// 样品 DTO
// =====================================================

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
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SampleStatus, SampleType } from '@prisma/client';

export class CreateSampleDto {
  @ApiProperty({ example: '上海黄金交易所', description: '客户名称' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  customerName!: string;

  @ApiProperty({ required: false, description: '客户委托单号' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  customerRef?: string;

  @ApiProperty({ enum: SampleType, example: SampleType.GOLD_INGOT })
  @IsEnum(SampleType)
  sampleType!: SampleType;

  @ApiProperty({ required: false, example: '99.99', description: '客户声明纯度 %' })
  @IsOptional()
  @IsNumberString()
  declaredPurityPct?: string;

  @ApiProperty({ example: '1.0234', description: '样品重量(克)' })
  @IsNumberString()
  weightG!: string;

  @ApiProperty({ required: false, description: '留样位置' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  storageLocation?: string;

  @ApiProperty({ required: false, type: [String], description: '照片文件 ID 列表(MinIO)' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  photoFileIds?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
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