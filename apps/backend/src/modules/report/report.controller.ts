// =====================================================
// 报告 API
// =====================================================

import {
  Res, Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { User, UserRole, ReportStatus } from '@prisma/client';

import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { RequireRole } from '../../common/auth/decorators/require-role.decorator';
import { MfaProtected } from '../../common/auth/decorators/mfa-api.decorator';
import { MFA_SCENES } from '../../common/auth/decorators/require-mfa.decorator';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/auth/guards/rbac.guard';

import { ReportService } from './report.service';


@ApiTags('reports')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('reports')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Post()
  @RequireRole(UserRole.ANALYST, UserRole.SENIOR_ANALYST, UserRole.ADMIN)
  @ApiOperation({ summary: '创建报告(草稿)' })
  create(@Body() body: { sampleId: string }, @CurrentUser() user: User) {
    return this.reportService.create(body.sampleId, user.id);
  }

  @Get()
  @ApiOperation({ summary: '查询报告列表' })
  findAll(@Query() filter: { status?: ReportStatus; sampleId?: string; page?: number; pageSize?: number }) {
    const { page, pageSize, ...rest } = filter ?? {};
    return this.reportService.findAll({
      ...rest,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: '查询报告详情(含样品/检测/审核/签名)' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.reportService.findOne(id);
  }

  @Get(':id/pdf')
  @ApiOperation({ summary: '下载报告 PDF(sha256 完整性校验)' })
  async downloadPdf(@Param('id', new ParseUUIDPipe()) id: string, @Res() res: any) {
    const { buffer, reportNo, sha256 } = await this.reportService.downloadPdf(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${reportNo}.pdf"`);
    res.setHeader('X-PDF-SHA256', sha256);
    res.send(buffer);
  }

  // 更新报告内容(DRAFT/审核中可编辑 summary/remarks)
  @Patch(':id')
  @ApiOperation({ summary: '更新报告内容(summary/remarks)' })
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: { summary?: string; remarks?: string },
    @CurrentUser() user: User,
  ) {
    return this.reportService.update(id, body, user.id);
  }

  // P0-Fix-2: 状态机推进强制 MFA(覆盖 SUBMIT / REVIEW / APPROVE / AUTHORIZE / ISSUE 等所有动作)
  @Post(':id/transition')
  @MfaProtected(MFA_SCENES.REPORT_ISSUE)
  @ApiOperation({ summary: '推进报告状态(状态机,MFA 强制,W2: 含 AUTHORIZE 批准)' })
  transition(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { action: 'SUBMIT' | 'REVIEW_PASS' | 'REVIEW_REJECT' | 'APPROVE' | 'AUTHORIZE' | 'ISSUE'; comments?: string },
    @CurrentUser() user: User,
  ) {
    return this.reportService.transition(id, body.action, user.id, body.comments);
  }

  // P0-Fix-2: 电子签名强制 MFA(21 CFR Part 11 §11.200 单独身份认证)
  @Post(':id/sign')
  @MfaProtected(MFA_SCENES.REPORT_SIGN)
  @RequireRole(UserRole.LAB_DIRECTOR, UserRole.QUALITY_MANAGER, UserRole.SENIOR_ANALYST)
  @ApiOperation({ summary: '电子签名(Phase 4 集成第三方 CA,MFA 强制)' })
  sign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { signatureData: string; certificateSerial: string },
    @CurrentUser() user: User,
  ) {
    return this.reportService.sign(id, user.id, user.role, body.signatureData, body.certificateSerial);
  }

  @Post(':id/void')
  @MfaProtected(MFA_SCENES.REPORT_ISSUE)
  @RequireRole(UserRole.LAB_DIRECTOR, UserRole.ADMIN)
  @ApiOperation({ summary: '作废报告(ISSUED → SUPERSEDED,CNAS §7.8.8)' })
  voidReport(@Param('id', ParseUUIDPipe) id: string, @Body() body: { reason: string }, @CurrentUser() user: User) {
    return this.reportService.voidReport(id, body.reason, user.id);
  }

  @Delete(':id')
  @RequireRole(UserRole.SENIOR_ANALYST, UserRole.ADMIN)
  @ApiOperation({ summary: '删除报告草稿(仅 DRAFT/REJECTED 且无签名)' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.reportService.remove(id, user.id);
  }
}