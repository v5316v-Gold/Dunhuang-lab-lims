// =====================================================
// 用户管理 API
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
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto, UserFilterDto } from './dto/user.dto';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/auth/guards/rbac.guard';
import { RequireRole } from '../../common/auth/decorators/require-role.decorator';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { User, UserRole } from '@prisma/client';

@ApiTags('users')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @RequireRole(UserRole.ADMIN)
  @ApiOperation({ summary: '创建用户' })
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: '查询用户列表(分页 + 过滤)' })
  findAll(@Query() filter: UserFilterDto) {
    return this.usersService.findAll(filter);
  }

  @Get(':id')
  @ApiOperation({ summary: '查询单个用户' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @RequireRole(UserRole.ADMIN)
  @ApiOperation({ summary: '更新用户' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @RequireRole(UserRole.ADMIN)
  @ApiOperation({ summary: '软删除用户' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.softDelete(id);
  }

  @Post(':id/reset-mfa')
  @RequireRole(UserRole.ADMIN)
  @ApiOperation({ summary: '重置用户 MFA(管理员)' })
  resetMfa(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.resetMfa(id);
  }

  @Post(':id/roles')
  @RequireRole(UserRole.ADMIN)
  @ApiOperation({ summary: '分配角色' })
  assignRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { role: UserRole },
    @CurrentUser() currentUser: User,
  ) {
    return this.usersService.assignRole(id, body.role, currentUser.id);
  }
}