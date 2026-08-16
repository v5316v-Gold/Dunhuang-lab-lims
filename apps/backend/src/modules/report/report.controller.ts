// =====================================================
// 报告 API
// =====================================================

import {
  Res, Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { User, UserRole, ReportStatus } from '@prisma/client';

import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { RequireRole } from '../../common/auth/decorators/require-role.decorator';
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

  @Post(':id/transition')
  @ApiOperation({ summary: '推进报告状态(状态机)' })
  transition(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { action: 'SUBMIT' | 'REVIEW_PASS' | 'REVIEW_REJECT' | 'APPROVE' | 'ISSUE'; comments?: string },
    @CurrentUser() user: User,
  ) {
    return this.reportService.transition(id, body.action, user.id, body.comments);
  }

  @Post(':id/sign')
  @RequireRole(UserRole.LAB_DIRECTOR, UserRole.QUALITY_MANAGER, UserRole.SENIOR_ANALYST)
  @ApiOperation({ summary: '电子签名(Phase 4 集成第三方 CA)' })
  sign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { signatureData: string; certificateSerial: string },
    @CurrentUser() user: User,
  ) {
    return this.reportService.sign(id, user.id, user.role, body.signatureData, body.certificateSerial);
  }
}