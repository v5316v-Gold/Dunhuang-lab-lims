// =====================================================
// 审计日志查询 DTO(Phase 0.5 Task A)
//
// 替换裸 @Query() filter: AuditLogFilter (TS interface)
// 用 class-validator 严格校验,防止 pageSize 等字段透传到 Prisma where
// 附件规定:BigInt 输出推荐 string,Swagger DTO 同步
// =====================================================

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class AuditLogFilterDto {
  @ApiPropertyOptional({ description: '按用户 ID 过滤(UUID)' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ description: '按用户名过滤' })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional({ description: '按表名过滤' })
  @IsOptional()
  @IsString()
  tableName?: string;

  @ApiPropertyOptional({ description: '按记录 ID 过滤(UUID)' })
  @IsOptional()
  @IsUUID()
  recordId?: string;

  @ApiPropertyOptional({ description: '按操作字符串 contains 过滤' })
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional({ description: '起始时间 ISO 字符串' })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional({ description: '截止时间 ISO 字符串' })
  @IsOptional()
  @IsString()
  to?: string;

  @ApiPropertyOptional({ minimum: 1, default: 1, description: '页码' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 200, default: 50, description: '每页大小' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number;
}
