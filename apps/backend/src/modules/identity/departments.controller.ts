// =====================================================
// 部门管理 API
// =====================================================

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DepartmentsService } from './departments.service';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/auth/guards/rbac.guard';
import { RequireRole } from '../../common/auth/decorators/require-role.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('departments')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Post()
  @RequireRole(UserRole.ADMIN)
  @ApiOperation({ summary: '创建部门' })
  create(@Body() body: { code: string; name: string; parentId?: string }) {
    return this.departmentsService.create(body);
  }

  @Get()
  @ApiOperation({ summary: '查询部门列表' })
  findAll() {
    return this.departmentsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: '查询部门详情(含子部门 + 用户)' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.departmentsService.findOne(id);
  }

  @Patch(':id')
  @RequireRole(UserRole.ADMIN)
  @ApiOperation({ summary: '更新部门' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() body: { name?: string; parentId?: string }) {
    return this.departmentsService.update(id, body);
  }

  @Delete(':id')
  @RequireRole(UserRole.ADMIN)
  @ApiOperation({ summary: '删除部门' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.departmentsService.softDelete(id);
  }
}