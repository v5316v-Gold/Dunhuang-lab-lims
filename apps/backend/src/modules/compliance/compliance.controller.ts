// =====================================================
// W+2 审批管理 Controller(CMA 5 表 CRUD)
// =====================================================

import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/auth/guards/rbac.guard';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { User } from '@prisma/client';
import { ComplianceService } from './compliance.service';

@ApiTags('compliance')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('compliance')
export class ComplianceController {
  constructor(private readonly svc: ComplianceService) {}

  @Get('summary')
  @ApiOperation({ summary: 'CMA 合规摘要(内审/管评/监督/盲样/PT)' })
  summary() { return this.svc.summary(); }

  // ---- 内部审核 ----
  @Post('internal-audit')
  @ApiOperation({ summary: '创建内审计划' })
  createIA(@Body() body: any, @CurrentUser() u: User) { return this.svc.createInternalAudit(body, u.id); }

  @Get('internal-audit')
  @ApiOperation({ summary: '内审列表' })
  listIA(@Query('status') status?: string) { return this.svc.listInternalAudits(status); }

  @Post('internal-audit/:id/close')
  @ApiOperation({ summary: '关闭内审(记录不符合项)' })
  closeIA(@Param('id') id: string, @Body() body: any) { return this.svc.closeInternalAudit(id, body); }

  // ---- 管理评审 ----
  @Post('management-review')
  @ApiOperation({ summary: '创建管理评审' })
  createMR(@Body() body: any, @CurrentUser() u: User) { return this.svc.createManagementReview(body, u.id); }

  @Get('management-review')
  @ApiOperation({ summary: '管理评审列表' })
  listMR() { return this.svc.listManagementReviews(); }

  @Post('management-review/:id/close')
  @ApiOperation({ summary: '关闭管理评审(记录决议)' })
  closeMR(@Param('id') id: string, @Body() body: any) { return this.svc.closeManagementReview(id, body); }

  // ---- 监督记录 ----
  @Post('supervision')
  @ApiOperation({ summary: '创建监督记录' })
  createSup(@Body() body: any, @CurrentUser() u: User) { return this.svc.createSupervision(body, u.id); }

  @Get('supervision')
  @ApiOperation({ summary: '监督记录列表' })
  listSup() { return this.svc.listSupervisions(); }

  // ---- 盲样考核 ----
  @Post('blind-sample')
  @ApiOperation({ summary: '创建盲样考核' })
  createBlind(@Body() body: any, @CurrentUser() u: User) { return this.svc.createBlindSample(body, u.id); }

  @Post('blind-sample/:id/assess')
  @ApiOperation({ summary: '录入盲样考核结果(自动算偏差+判定)' })
  assessBlind(@Param('id') id: string, @Body() body: any) { return this.svc.assessBlindSample(id, body); }

  @Get('blind-sample')
  @ApiOperation({ summary: '盲样考核列表' })
  listBlind() { return this.svc.listBlindSamples(); }

  // ---- 能力验证 PT ----
  @Post('proficiency-test')
  @ApiOperation({ summary: '创建能力验证计划' })
  createPT(@Body() body: any, @CurrentUser() u: User) { return this.svc.createProficiencyTest(body, u.id); }

  @Post('proficiency-test/:id/result')
  @ApiOperation({ summary: '录入 PT 结果(自动 zScore 判定)' })
  recordPT(@Param('id') id: string, @Body() body: any) { return this.svc.recordPTResult(id, body); }

  @Get('proficiency-test')
  @ApiOperation({ summary: '能力验证列表' })
  listPT() { return this.svc.listProficiencyTests(); }
}