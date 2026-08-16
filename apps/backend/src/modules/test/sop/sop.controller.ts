// =====================================================
// SOP HTTP 端点
//   POST /api/v1/sop/executions         开始一次 SOP 执行
//   POST /api/v1/sop/executions/:id/steps/:order  提交一步
//   POST /api/v1/sop/executions/:id/calculate     完成 + 算不确定度
//   GET  /api/v1/sop/templates                    列出模板
//   GET  /api/v1/sop/templates/:code              模板详情
// =====================================================

import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';

import { JwtAuthGuard } from '../../../common/auth/guards/jwt-auth.guard';
import { SopService, SopTemplate } from './sop.service';

@ApiTags('sop')
@Controller('sop')
export class SopController {
  constructor(private readonly sop: SopService) {}

  @Get('templates')
  @ApiOperation({ summary: '列出所有 SOP 模板' })
  listTemplates(): { templates: SopTemplate[] } {
    return {
      templates: Array.from((this.sop as any).templates.values()) as SopTemplate[],
    };
  }

  @Get('templates/:code')
  @ApiOperation({ summary: '获取 SOP 模板详情' })
  getTemplate(@Param('code') code: string): SopTemplate {
    return this.sop.getTemplate(code);
  }

  @Post('executions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '开始一次 SOP 执行' })
  async start(
    @Body() body: { sampleId: string; batchId: string; sopCode: string },
    @Req() req: Request,
  ): Promise<{ executionId: string }> {
    const user = (req as any).user;
    return this.sop.startExecution({
      sampleId: body.sampleId,
      batchId: body.batchId,
      sopCode: body.sopCode,
      operatorId: user.sub,
    });
  }

  @Post('executions/:id/steps/:order')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '提交 SOP 一步执行结果' })
  async submitStep(
    @Param('id') id: string,
    @Param('order') order: string,
    @Body() params: Record<string, unknown>,
    @Req() req: Request,
  ): Promise<{ completed: boolean; nextStep?: number }> {
    const user = (req as any).user;
    return this.sop.submitStep(id, parseInt(order, 10), params, user.sub);
  }

  @Post('executions/:id/calculate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '完成 SOP 并计算 Au 含量 + 不确定度' })
  async calculate(@Param('id') id: string): Promise<{
    auContent: number;
    uncertainty: number;
    components: Record<string, number>;
  }> {
    return this.sop.finalizeAndCalculate(id);
  }
}
