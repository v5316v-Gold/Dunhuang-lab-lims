// =====================================================
// 能力验证 PT Controller — W4-A
// GET/POST /proficiency-tests + 结果录入 + 年度汇总
// =====================================================

import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsNumberString, IsOptional, IsString } from 'class-validator';
import { User, UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/auth/guards/rbac.guard';
import { RequireRole } from '../../common/auth/decorators/require-role.decorator';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { ProficiencyTestService } from './proficiency-test.service';

class CreatePtDto {
  @IsString() ptNo!: string;
  @IsString() organizer!: string;
  @IsString() item!: string;
  @IsString() method!: string;
  @IsString() startDate!: string;
  @IsOptional() @IsString() endDate?: string;
  @IsOptional() @IsString() remarks?: string;
}

class RecordResultDto {
  @IsNumberString() zScore!: string;
  @IsIn(['SATISFACTORY', 'QUESTIONABLE', 'UNSATISFACTORY']) result!: 'SATISFACTORY' | 'QUESTIONABLE' | 'UNSATISFACTORY';
  @IsOptional() @IsString() remarks?: string;
}

@ApiTags('proficiency-tests')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('proficiency-tests')
export class ProficiencyTestController {
  constructor(private readonly service: ProficiencyTestService) {}

  @Get()
  @ApiOperation({ summary: 'PT 列表(年度过滤)' })
  findAll(@Query() filter: { year?: number; page?: number; pageSize?: number }) {
    return this.service.findAll(filter);
  }

  @Get('summary')
  @ApiOperation({ summary: '年度 PT 汇总(评审展示)' })
  summary() {
    return this.service.annualSummary();
  }

  @Get(':id')
  @ApiOperation({ summary: 'PT 详情' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequireRole(UserRole.ADMIN, UserRole.LAB_DIRECTOR, UserRole.QUALITY_MANAGER)
  @ApiOperation({ summary: '创建 PT 计划' })
  create(@Body() dto: CreatePtDto, @CurrentUser() user: User) {
    return this.service.create({ ...dto, createdById: user.id });
  }

  @Post(':id/result')
  @RequireRole(UserRole.ADMIN, UserRole.LAB_DIRECTOR, UserRole.QUALITY_MANAGER)
  @ApiOperation({ summary: '录入 PT 结果 + z 值评价' })
  recordResult(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RecordResultDto) {
    return this.service.recordResult(id, {
      zScore: parseFloat(dto.zScore),
      result: dto.result,
      remarks: dto.remarks,
    });
  }
}
