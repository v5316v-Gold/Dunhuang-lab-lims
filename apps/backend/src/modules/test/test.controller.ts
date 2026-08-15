// =====================================================
// 检测通用 API
// =====================================================

import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';

import { TestService, TestFilterDto } from './test.service';

@ApiTags('tests')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('tests')
export class TestController {
  constructor(private readonly testService: TestService) {}

  @Get()
  @ApiOperation({ summary: '查询检测列表(分页 + 过滤)' })
  findAll(@Query() filter: TestFilterDto) {
    return this.testService.findAll(filter);
  }
}