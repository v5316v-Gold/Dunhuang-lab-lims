// =====================================================
// 审计日志 API
// 详见 docs/04-CNAS-COMPLIANCE.md §3.1
// =====================================================

import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AuditService, AuditLogFilter } from './audit.service';
import { RequireRole } from '../auth/decorators/require-role.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('audit-logs')
@ApiBearerAuth('access-token')
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  /**
   * GET /audit-logs
   * 查询审计日志(分页 + 过滤)
   */
  @Get()
  @RequireRole(UserRole.ADMIN, UserRole.LAB_DIRECTOR, UserRole.QUALITY_MANAGER)
  @ApiOperation({ summary: '查询审计日志' })
  findAll(@Query() filter: AuditLogFilter) {
    return this.auditService.findAll(filter);
  }

  /**
   * GET /audit-logs/verify
   * SHA256 链断链自检(关键合规功能)
   */
  @Get('verify')
  @RequireRole(UserRole.ADMIN, UserRole.LAB_DIRECTOR, UserRole.QUALITY_MANAGER)
  @ApiOperation({ summary: '审计链断链自检(关键合规)' })
  verify() {
    return this.auditService.verifyChain();
  }

  /**
   * GET /audit-logs/:id
   * 查询单条审计日志
   */
  @Get(':id')
  @RequireRole(UserRole.ADMIN, UserRole.LAB_DIRECTOR, UserRole.QUALITY_MANAGER)
  @ApiOperation({ summary: '查询单条审计日志' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.auditService.findOne(id);
  }

  /**
   * GET /audit-logs/:id/verify
   * 校验指定记录的 hash
   */
  @Get(':id/verify')
  @RequireRole(UserRole.ADMIN, UserRole.LAB_DIRECTOR, UserRole.QUALITY_MANAGER)
  @ApiOperation({ summary: '校验单条记录哈希' })
  verifyRecord(@Param('id', ParseIntPipe) id: number) {
    return this.auditService.verifyRecord(id);
  }
}