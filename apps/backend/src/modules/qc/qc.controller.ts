// =====================================================
// QC API
// =====================================================

import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { User, UserRole, QcType } from '@prisma/client';

import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { RequireRole } from '../../common/auth/decorators/require-role.decorator';
import { MfaProtected } from '../../common/auth/decorators/mfa-api.decorator';
import { MFA_SCENES } from '../../common/auth/decorators/require-mfa.decorator';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { SecurityAuditService } from '../../common/audit/security-audit.service';
import { AuditEventType } from '../../common/audit/audit-event.enum';

import { QcService } from './qc.service';


@ApiTags('qc')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('qc')
export class QcController {
  constructor(
    private readonly qcService: QcService,
    private readonly prisma: PrismaService,
    private readonly securityAudit: SecurityAuditService,
  ) {}

  @Post('measurements')
  @RequireRole(UserRole.ANALYST, UserRole.SENIOR_ANALYST, UserRole.QUALITY_MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: '记录 QC 测量' })
  record(
    @Body()
    body: {
      qcType: QcType;
      element: string;
      measured: string;
      expected?: string;
      sd?: string;
      referenceId?: string;
      testId?: string;
    },
    @CurrentUser() user: User,
  ) {
    return this.qcService.recordMeasurement({ ...body, operatorId: user.id });
  }

  @Get('trend')
  @ApiOperation({ summary: 'QC 趋势数据' })
  trend(@Query('element') element: string, @Query('days') days?: number) {
    return this.qcService.getTrend(element, days ? Number(days) : 30);
  }

  // ---- OOS / NonConformance 管理(P0-Fix-2/3) ----
  @Get('nonconformances')
  @RequireRole(UserRole.QUALITY_MANAGER, UserRole.LAB_DIRECTOR, UserRole.SENIOR_ANALYST, UserRole.ADMIN)
  @ApiOperation({ summary: '查询 OOS / 不符合工作列表' })
  listOOS(@Query('status') status?: string, @Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.qcService.listOOS(status, page ? Number(page) : 1, pageSize ? Number(pageSize) : 20);
  }

  @Get('nonconformances/:id')
  @RequireRole(UserRole.QUALITY_MANAGER, UserRole.LAB_DIRECTOR, UserRole.SENIOR_ANALYST, UserRole.ADMIN)
  @ApiOperation({ summary: '查询 NC 详情' })
  async getNC(@Param('id', ParseUUIDPipe) id: string) {
    return this.prisma.nonConformance.findUnique({
      where: { id },
      include: {
        reportedBy: { select: { id: true, name: true } },
        investigatedBy: { select: { id: true, name: true } },
        closedBy: { select: { id: true, name: true } },
        qcMeasurement: true,
        test: { include: { sample: { select: { sampleNo: true, customerName: true } } } },
      },
    });
  }

  // P0-Fix-2: OOS 关闭必须 MFA(CNAS §7.10 不符合工作 — 评审必查)
  @Patch('nonconformances/:id/close')
  @MfaProtected(MFA_SCENES.OOS_CLOSE)
  @RequireRole(UserRole.QUALITY_MANAGER, UserRole.LAB_DIRECTOR)
  @ApiOperation({ summary: '关闭 OOS / NC(MFA 强制 — 评审必查)' })
  async closeNC(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { rootCause: string; immediateAction?: string; correctiveAction?: string; preventiveAction?: string; effectivenessVerification?: string },
    @CurrentUser() user: User,
  ) {
    const nc = await this.prisma.nonConformance.update({
      where: { id },
      data: {
        status: 'CLOSED',
        closedById: user.id,
        closedAt: new Date(),
        rootCause: body.rootCause,
        immediateAction: body.immediateAction,
        correctiveAction: body.correctiveAction,
        preventiveAction: body.preventiveAction,
        effectivenessVerification: body.effectivenessVerification,
      },
    });
    // P0-Fix-3:审计事件
    await this.securityAudit.system(AuditEventType.OOS_CLOSED, {
      ncId: nc.id,
      ncNo: nc.ncNo,
      rootCause: body.rootCause,
      closedById: user.id,
    });
    return nc;
  }

  @Get('westgard')
  @ApiOperation({ summary: 'Westgard 多规则评估' })
  westgard(@Query('element') element: string, @Query('days') days?: number) {
    return this.qcService.evaluateWestgard(element, days ? Number(days) : 30);
  }

  @Get('summary')
  @ApiOperation({
    summary: 'QC 仪表盘摘要(Phase 2 Day 5)',
    description: '返回总测量数/通过率/最近 N 条测量/违规规则,供 QcDashboard 使用',
  })
  async summary(@Query('days') days?: number) {
    const d = days ? Number(days) : 30;
    const since = new Date(Date.now() - d * 24 * 3600 * 1000);
    const [total, passed, recent, byElement, violations] = await Promise.all([
      this.prisma.qcMeasurement.count({ where: { measuredAt: { gte: since } } }),
      this.prisma.qcMeasurement.count({ where: { measuredAt: { gte: since }, passed: true } }),
      this.prisma.qcMeasurement.findMany({
        where: { measuredAt: { gte: since } },
        orderBy: { measuredAt: 'desc' },
        take: 50,
        include: { test: { include: { sample: { select: { sampleNo: true, customerName: true } } } } },
      }),
      this.prisma.qcMeasurement.groupBy({
        by: ['element'],
        where: { measuredAt: { gte: since } },
        _count: true,
      }),
      this.prisma.qcMeasurement.findMany({
        where: { measuredAt: { gte: since }, passed: false },
        take: 10,
        orderBy: { measuredAt: 'desc' },
      }),
    ]);
    return {
      window: { days: d, since: since.toISOString() },
      total,
      passed,
      passRate: total > 0 ? (passed / total) * 100 : 0,
      byElement: byElement.map((b) => ({ element: b.element, count: b._count })),
      recent: recent.map((r) => ({
        id: r.id,
        element: r.element,
        measured: r.measured.toString(),
        expected: r.expected?.toString() ?? null,
        sd: r.sd?.toString() ?? null,
        zScore: r.zScore?.toString() ?? null,
        passed: r.passed,
        westgardRule: r.westgardRule,
        measuredAt: r.measuredAt,
        test: r.test
          ? {
              id: r.test.id,
              purityPct: r.test.purityPct?.toString() ?? null,
              sample: r.test.sample
                ? { sampleNo: r.test.sample.sampleNo, customerName: r.test.sample.customerName }
                : null,
            }
          : null,
      })),
      violations: violations.map((v) => ({
        id: v.id,
        element: v.element,
        measured: v.measured.toString(),
        westgardRule: v.westgardRule,
        measuredAt: v.measuredAt,
      })),
    };
  }
}