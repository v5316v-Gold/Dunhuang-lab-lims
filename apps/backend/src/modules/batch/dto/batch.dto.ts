// =====================================================
// 批次 DTO
// =====================================================

import { ApiProperty } from '@nestjs/swagger';
import { AssayMethod, BatchStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsUUID,
  IsNumberString,
  IsPositive,
  ValidateNested,
} from 'class-validator';

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

/**
 * 工艺参数 DTO — 状态推进时录入(Phase 2 Day 3)
 * 用于 BatchDetail 推进弹窗:
 *   MIXING  → FUSING  录入:混料温度(℃) / 混料时长(min)
 *   FUSING  → CUPELLING:炉温(℃) / 熔融时长(min)
 *   CUPELLING → PARTING:灰吹温度 / 灰吹时长
 *   PARTING  → ANNEALING:分金硝酸浓度 / 分金时长
 *   ANNEALING → WEIGHING:退火温度 / 退火时长
 *
 * 所有字段可选(按状态填实际有意义的几项)
 */
export class ProcessParameterDto {
  @ApiProperty({ required: false, description: '混料温度 ℃', example: '1050' })
  @IsOptional()
  @IsNumberString()
  mixingTempC?: string;

  @ApiProperty({ required: false, description: '混料时长 min', example: '30' })
  @IsOptional()
  @IsNumberString()
  mixingDurationMin?: string;

  @ApiProperty({ required: false, description: '炉温 ℃', example: '1100' })
  @IsOptional()
  @IsNumberString()
  furnaceTempC?: string;

  @ApiProperty({ required: false, description: '熔融时长 min', example: '60' })
  @IsOptional()
  @IsNumberString()
  fusingDurationMin?: string;

  @ApiProperty({ required: false, description: '灰吹温度 ℃', example: '900' })
  @IsOptional()
  @IsNumberString()
  cupellationTempC?: string;

  @ApiProperty({ required: false, description: '灰吹时长 min', example: '45' })
  @IsOptional()
  @IsNumberString()
  cupellationDurationMin?: string;

  @ApiProperty({
    required: false,
    description: '分金硝酸浓度 (1:1 / 1:2 / 1:4)',
    example: '1:1',
  })
  @IsOptional()
  @IsString()
  partingAcid?: string;

  @ApiProperty({ required: false, description: '分金时长 min', example: '30' })
  @IsOptional()
  @IsNumberString()
  partingDurationMin?: string;

  @ApiProperty({ required: false, description: '退火温度 ℃', example: '800' })
  @IsOptional()
  @IsNumberString()
  annealingTempC?: string;

  @ApiProperty({ required: false, description: '退火时长 min', example: '30' })
  @IsOptional()
  @IsNumberString()
  annealingDurationMin?: string;
}

/**
 * 批次列表过滤参数
 * Phase 2 Day 2 修复: 之前 controller 接受 raw object,导致 pageSize 等额外字段
 * 透传到 Prisma where_ 触发 PrismaValidationError
 */
export class BatchFilterDto {
  @ApiProperty({ required: false, enum: AssayMethod })
  @IsOptional()
  @IsEnum(AssayMethod)
  method?: AssayMethod;

  @ApiProperty({ required: false, enum: BatchStatus })
  @IsOptional()
  @IsEnum(BatchStatus)
  status?: BatchStatus;

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