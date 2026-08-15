// =====================================================
// ICP 检测 API
// =====================================================

import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { User, UserRole } from '@prisma/client';

import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { RequireRole } from '../../common/auth/decorators/require-role.decorator';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/auth/guards/rbac.guard';

import { IcpService, CreateIcpTestDto, ElementResultInput } from './icp.service';


@ApiTags('tests')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('tests/icp')
export class IcpController {
  constructor(private readonly icpService: IcpService) {}

  @Post()
  @RequireRole(UserRole.ANALYST, UserRole.SENIOR_ANALYST, UserRole.ADMIN)
  @ApiOperation({ summary: '创建 ICP 检测' })
  create(@Body() dto: CreateIcpTestDto, @CurrentUser() user: User) {
    return this.icpService.create(dto, user.id);
  }

  @Get(':testId')
  @ApiOperation({ summary: '查询 ICP 检测详情(含多元素)' })
  findOne(@Param('testId', ParseUUIDPipe) testId: string) {
    return this.icpService.findOne(testId);
  }

  @Post(':testId/results')
  @RequireRole(UserRole.ANALYST, UserRole.SENIOR_ANALYST, UserRole.ADMIN)
  @ApiOperation({ summary: '批量录入多元素结果' })
  addResults(@Param('testId', ParseUUIDPipe) testId: string, @Body() body: { results: ElementResultInput[] }) {
    return this.icpService.addElementResults(testId, body.results);
  }

  @Post(':testId/complete')
  @RequireRole(UserRole.SENIOR_ANALYST, UserRole.ADMIN)
  @ApiOperation({ summary: '完成 ICP 检测' })
  complete(@Param('testId', ParseUUIDPipe) testId: string) {
    return this.icpService.complete(testId);
  }
}