// =====================================================
// 检测通用 API
// =====================================================

import { Controller, Delete, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { User, UserRole } from '@prisma/client';

import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { RequireRole } from '../../common/auth/decorators/require-role.decorator';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/auth/guards/rbac.guard';

import { TestService, TestFilterDto } from './test.service';

@ApiTags('tests')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('tests')
export class TestController {
  constructor(private readonly testService: TestService) {}

  @Get()
  @ApiOperation({ summary: '查询检测列表(分页 + 过滤)' })
  findAll(@Query() filter: TestFilterDto) {
    return this.testService.findAll(filter);
  }

  @Delete(':id')
  @RequireRole(UserRole.SENIOR_ANALYST, UserRole.ADMIN)
  @ApiOperation({ summary: '删除检测任务(仅未完成且无原始记录单)' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.testService.remove(id, user.id);
  }
}