// =====================================================
// 原始记录单 Controller — W4-B
// GET/POST(生成)/POST :id/lock / POST :id/sign / GET :id/pdf
// =====================================================

import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';
import { User, UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/auth/guards/rbac.guard';
import { RequireRole } from '../../common/auth/decorators/require-role.decorator';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { RawRecordSheetService } from './raw-record.service';

class GenerateDto {
  @IsString() testId!: string;
}

class SignDto {
  @IsIn(['OPERATOR', 'REVIEWER', 'APPROVER'])
  role!: 'OPERATOR' | 'REVIEWER' | 'APPROVER';
}

@ApiTags('raw-records')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('raw-records')
export class RawRecordController {
  constructor(private readonly service: RawRecordSheetService) {}

  @Get()
  @ApiOperation({ summary: '原始记录单列表' })
  findAll(@Query() filter: { sampleId?: string; status?: string; page?: number; pageSize?: number }) {
    return this.service.findAll(filter);
  }

  @Post('generate')
  @RequireRole(UserRole.ANALYST, UserRole.SENIOR_ANALYST, UserRole.ADMIN)
  @ApiOperation({ summary: '检测完成 → 生成原始记录单(数据快照冻结)' })
  generate(@Body() dto: GenerateDto, @CurrentUser() user: User) {
    return this.service.generateForTest(dto.testId, user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: '原始记录单详情' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Post(':id/lock')
  @RequireRole(UserRole.ADMIN, UserRole.SENIOR_ANALYST)
  @ApiOperation({ summary: '锁定记录单(数据冻结)' })
  lock(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.service.lock(id, user.id);
  }

  @Post(':id/sign')
  @RequireRole(UserRole.ADMIN, UserRole.SENIOR_ANALYST, UserRole.QUALITY_MANAGER)
  @ApiOperation({ summary: '三签(OPERATOR/REVIEWER/APPROVER,SoD 互斥)' })
  sign(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SignDto, @CurrentUser() user: User) {
    return this.service.sign(id, dto.role, user.id);
  }
}
