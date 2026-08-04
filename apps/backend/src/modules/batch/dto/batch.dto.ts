// =====================================================
// 批次 DTO
// =====================================================

import { Type } from 'class-transformer';
import { IsString, IsNotEmpty, IsEnum, IsOptional, IsInt, Min, Max, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AssayMethod } from '@prisma/client';

export class CreateBatchDto {
  @ApiProperty({ enum: AssayMethod, example: AssayMethod.FIRE_ASSAY })
  @IsEnum(AssayMethod)
  method!: AssayMethod;

  @ApiProperty({ required: false, default: 3, description: '平行样数' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  replicateCount?: number;

  @ApiProperty({ required: false, description: '试金炉编号(仅火试金)' })
  @IsOptional()
  @IsString()
  furnaceNo?: string;

  @ApiProperty({ required: false, description: 'QC 样 ID(标准物质)' })
  @IsOptional()
  @IsUUID()
  qcSampleId?: string;
}

export class AddSamplesToBatchDto {
  @ApiProperty({ type: [String], description: '样品 ID 列表' })
  @IsUUID('4', { each: true })
  sampleIds!: string[];
}

export class BatchActionDto {
  @ApiProperty({ enum: ['START', 'ADVANCE', 'COMPLETE', 'REJECT'], example: 'ADVANCE' })
  @IsString()
  action!: 'START' | 'ADVANCE' | 'COMPLETE' | 'REJECT';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  remarks?: string;
}