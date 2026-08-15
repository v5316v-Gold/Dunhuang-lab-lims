// =====================================================
// Phase 1B P0-A: 不确定度 Controller
// =====================================================

import {
  Body, Controller, Get, Param, ParseIntPipe, ParseUUIDPipe,
  Post, Query, UseGuards, BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/auth/guards/rbac.guard';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { User } from '@prisma/client';
import {
  CreateUncertaintyDto, ReviewUncertaintyDto, UncertaintyService,
} from './uncertainty.service';

@ApiTags('uncertainty')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('uncertainty')
export class UncertaintyController {
  constructor(private readonly uncertaintyService: UncertaintyService) {}

  @Post()
  @ApiOperation({ summary: '创建不确定度报告(DRAFT)' })
  create(@Body() dto: CreateUncertaintyDto, @CurrentUser() user: User) {
    return this.uncertaintyService.create(dto, user.id);
  }

  @Get('summary')
  @ApiOperation({ summary: '不确定度合规摘要' })
  summary() {
    return this.uncertaintyService.summary();
  }

  @Get('by-test/:testId')
  @ApiOperation({ summary: '按 Test 查不确定度报告' })
  findAllByTest(@Param('testId', new ParseUUIDPipe()) testId: string) {
    return this.uncertaintyService.findAllByTest(testId);
  }

  @Get(':id')
  @ApiOperation({ summary: '不确定度报告详情(含 5 类分量)' })
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.uncertaintyService.findOne(id);
  }

  @Post(':id/review')
  @ApiOperation({ summary: '校核 DRAFT → REVIEWED' })
  review(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ReviewUncertaintyDto,
    @CurrentUser() user: User,
  ) {
    return this.uncertaintyService.review(id, user.id, dto);
  }

  @Post(':id/publish')
  @ApiOperation({ summary: '发布 REVIEWED → PUBLISHED + 同步 Test.uncertainty' })
  publish(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: User,
  ) {
    return this.uncertaintyService.publish(id, user.id);
  }
}