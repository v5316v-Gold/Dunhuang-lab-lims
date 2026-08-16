// =====================================================
// 期间核查 HTTP 端点
//   GET  /api/v1/equipment/periodic-checks/today         今日待核查
//   POST /api/v1/equipment/periodic-checks/:id/submit    提交结果
//   GET  /api/v1/equipment/:equipmentId/periodic-checks  设备历次核查
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
import { PeriodicCheckService } from './periodic-check.service';

@ApiTags('periodic-check')
@Controller('equipment/periodic-checks')
export class PeriodicCheckController {
  constructor(private readonly service: PeriodicCheckService) {}

  @Get('today')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '今日待核查设备' })
  async today(): Promise<unknown[]> {
    const tasks = await this.service.listTodayTasks();
    return tasks;
  }

  @Post(':id/submit')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '提交期间核查结果' })
  async submit(
    @Param('id') id: string,
    @Body() body: { results: Record<string, number | boolean | string> },
    @Req() req: Request,
  ): Promise<unknown> {
    const user = (req as any).user;
    return this.service.submitTask(id, body.results, user.sub);
  }
}
