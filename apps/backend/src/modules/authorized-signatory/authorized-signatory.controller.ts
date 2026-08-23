// =====================================================
// 授权签字人 Controller(W1 架构 — CNAS-CL01:2018 §7.5.3)
// 列表/详情所有角色可见;新增/编辑/停用需 LAB_DIRECTOR
// =====================================================

import { Body, Controller, Delete, Get, Param, ParseBoolPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/auth/guards/rbac.guard';
import { RequireRole } from '../../common/auth/decorators/require-role.decorator';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { User, UserRole } from '@prisma/client';

import { AuthorizedSignatoryService } from './authorized-signatory.service';
import { CreateAuthorizedSignatoryDto, UpdateAuthorizedSignatoryDto } from './dto/authorized-signatory.dto';

@ApiTags('authorized-signatories')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('authorized-signatories')
export class AuthorizedSignatoryController {
  constructor(private readonly service: AuthorizedSignatoryService) {}

  @Get()
  @ApiOperation({ summary: '授权签字人列表(可过滤生效中)' })
  findAll(@Query('activeOnly') activeOnly?: string) {
    return this.service.findAll(activeOnly === 'true');
  }

  @Get(':id')
  @ApiOperation({ summary: '授权签字人详情' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequireRole(UserRole.LAB_DIRECTOR, UserRole.ADMIN)
  @ApiOperation({ summary: '新增授权签字人(主任)' })
  create(@Body() dto: CreateAuthorizedSignatoryDto, @CurrentUser() user: User) {
    return this.service.create(dto, user.id);
  }

  @Patch(':id')
  @RequireRole(UserRole.LAB_DIRECTOR, UserRole.ADMIN)
  @ApiOperation({ summary: '更新授权签字人' })
  update(@Param('id') id: string, @Body() dto: UpdateAuthorizedSignatoryDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @RequireRole(UserRole.LAB_DIRECTOR, UserRole.ADMIN)
  @ApiOperation({ summary: '停用授权签字人(软删除)' })
  disable(@Param('id') id: string) {
    return this.service.disable(id);
  }
}
