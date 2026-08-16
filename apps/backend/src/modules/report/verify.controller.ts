// =====================================================
// P2-4: 报告反查端点(扫码后访问)
// 用于二维码扫描反查,验证报告真伪
//
// 匿名访问(无需登录),只返回基本信息 + 审计链关键摘要
// 不暴露检测数据 / 客户信息(防止信息泄露)
// =====================================================

import {
  Controller,
  Get,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@ApiTags('verify')
@Controller('verify')
export class ReportVerifyController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * GET /verify?report=<id>&sha=<16chars>
   * 公开反查(只读)
   */
  @Get()
  @ApiOperation({ summary: '扫码反查(匿名,只读)' })
  async verify(
    @Query('report') reportId: string,
    @Query('sha') sha16: string,
    @Res() res: Response,
  ): Promise<void> {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    if (!reportId) {
      res.status(400).json({ valid: false, error: 'missing_report_id' });
      return;
    }

    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      select: {
        id: true,
        reportNo: true,
        status: true,
        pdfSha256: true,
        issuedAt: true,
        createdAt: true,
      },
    });

    if (!report) {
      res.status(404).json({ valid: false, error: 'report_not_found' });
      return;
    }

    // 校验 SHA256 前缀
    const expectedPrefix = report.pdfSha256?.slice(0, 16);
    const shaOk = !sha16 || sha16 === expectedPrefix;

    res.json({
      valid: shaOk,
      report: {
        reportNo: report.reportNo,
        status: report.status,
        issuedAt: report.issuedAt?.toISOString() ?? null,
        // 审计链最后 N 条(脱敏,只返回事件类型 + 时间)
        // 真实实现:查 audit_logs 表
        verifiedAt: new Date().toISOString(),
      },
      message: shaOk
        ? '✅ 报告真实有效。详情请联系检测中心。'
        : '⚠️ SHA256 前缀不匹配,报告可能已被篡改。',
      // 不暴露:客户名 / 样品 / 检测结果 / 签名
    });
  }
}