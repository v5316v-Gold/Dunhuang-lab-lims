// =====================================================
// W+2 审批管理 Controller(CMA 5 表 CRUD)
// P2-6: 管评输入汇总 + 内审检查表 + NCR/CAPA 联动
// =====================================================

import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/auth/guards/rbac.guard';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { MfaProtected } from '../../common/auth/decorators/mfa-api.decorator';
import { MFA_SCENES } from '../../common/auth/decorators/require-mfa.decorator';
import { User, UserRole } from '@prisma/client';
import { RequireRole } from '../../common/auth/decorators/require-role.decorator';
import { ComplianceService } from './compliance.service';

@ApiTags('compliance')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('compliance')
export class ComplianceController {
  constructor(private readonly svc: ComplianceService) {}

  // ---- 临时授权 ----
  @Post('temp-auth')
  @ApiOperation({ summary: '创建临时授权(代班)' })
  createTA(@Body() body: any, @CurrentUser() u: User) { return this.svc.createTempAuth(body, u.id); }

  @Get('temp-auth')
  @ApiOperation({ summary: '临时授权列表(默认仅活跃)' })
  listTA(@Query('all') all?: string) { return this.svc.listTempAuths(all !== 'true'); }

  @Post('temp-auth/:id/revoke')
  @MfaProtected(MFA_SCENES.USER_ROLE_CHANGE)
  @ApiOperation({ summary: '撤销临时授权(MFA 强制 — 等同角色变更)' })
  revokeTA(@Param('id') id: string, @CurrentUser() u: User) { return this.svc.revokeTempAuth(id, u.id); }

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
  @MfaProtected(MFA_SCENES.INTERNAL_AUDIT_APPROVE)
  @ApiOperation({ summary: '关闭内审(CNAS §8.8 必审,MFA 强制)' })
  closeIA(@Param('id') id: string, @Body() body: any) { return this.svc.closeInternalAudit(id, body); }

  @Delete('internal-audit/:id')
  @MfaProtected(MFA_SCENES.INTERNAL_AUDIT_APPROVE)
  @ApiOperation({ summary: '删除内审(仅 PLANNED 可软删,MFA 强制)' })
  deleteIA(@Param('id') id: string, @CurrentUser() u: User) { return this.svc.deleteInternalAudit(id, u.id); }

  // ---- 管理评审 ----
  @Post('management-review')
  @ApiOperation({ summary: '创建管理评审' })
  createMR(@Body() body: any, @CurrentUser() u: User) { return this.svc.createManagementReview(body, u.id); }

  @Get('management-review')
  @ApiOperation({ summary: '管理评审列表' })
  listMR() { return this.svc.listManagementReviews(); }

  @Post('management-review/:id/close')
  @MfaProtected(MFA_SCENES.MANAGEMENT_REVIEW_APPROVE)
  @ApiOperation({ summary: '关闭管理评审(CNAS §8.9 必审,MFA 强制)' })
  closeMR(@Param('id') id: string, @Body() body: any) { return this.svc.closeManagementReview(id, body); }

  @Delete('management-review/:id')
  @MfaProtected(MFA_SCENES.MANAGEMENT_REVIEW_APPROVE)
  @ApiOperation({ summary: '删除管理评审(仅 PLANNED 可软删,MFA 强制)' })
  deleteMR(@Param('id') id: string, @CurrentUser() u: User) { return this.svc.deleteManagementReview(id, u.id); }

  // ---- 监督记录 ----
  @Post('supervision')
  @ApiOperation({ summary: '创建监督记录' })
  createSup(@Body() body: any, @CurrentUser() u: User) { return this.svc.createSupervision(body, u.id); }

  @Get('supervision')
  @ApiOperation({ summary: '监督记录列表' })
  listSup() { return this.svc.listSupervisions(); }

  @Delete('supervision/:id')
  @MfaProtected(MFA_SCENES.PERSONNEL_SUSPENDED)
  @ApiOperation({ summary: '删除监督记录(软删,MFA 强制)' })
  deleteSup(@Param('id') id: string, @CurrentUser() u: User) { return this.svc.deleteSupervision(id, u.id); }

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

  @Delete('blind-sample/:id')
  @MfaProtected(MFA_SCENES.REPORT_ISSUE)
  @ApiOperation({ summary: '删除盲样考核(仅未评可软删,MFA 强制)' })
  deleteBlind(@Param('id') id: string, @CurrentUser() u: User) { return this.svc.deleteBlindSample(id, u.id); }

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

  // ---- P2-6: 内审检查表 + 管评输入 + NCR/CAPA ----
  @Get('audit-checklist')
  @RequireRole(UserRole.QUALITY_MANAGER, UserRole.LAB_DIRECTOR, UserRole.ADMIN)
  @ApiOperation({ summary: '内审检查表(CNAS §4-§7 全条款 15 项)' })
  auditChecklist() {
    return this.svc.generateAuditChecklist();
  }

  @Get('management-review/inputs')
  @RequireRole(UserRole.QUALITY_MANAGER, UserRole.LAB_DIRECTOR, UserRole.ADMIN)
  @ApiOperation({ summary: '管评 12 项输入自动汇总(CNAS §8.9)' })
  mrInputs(
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    const fromDate = from ? new Date(from) : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const toDate = to ? new Date(to) : new Date();
    return this.svc.getManagementReviewInputs(fromDate, toDate);
  }

  @Patch('nonconformances/:id/capa')
  @MfaProtected(MFA_SCENES.CAPA_APPROVE)
  @RequireRole(UserRole.QUALITY_MANAGER, UserRole.LAB_DIRECTOR)
  @ApiOperation({ summary: 'NCR → CAPA 联动(CNAS §7.10 — 评审必查)' })
  linkCapa(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { capaAction: string; preventiveAction?: string; effectivenessVerification?: string },
    @CurrentUser() user: User,
  ) {
    return this.svc.linkNcToCapa({
      ncId: id,
      capaAction: body.capaAction,
      preventiveAction: body.preventiveAction,
      effectivenessVerification: body.effectivenessVerification,
      operatorId: user.id,
    });
  }
}