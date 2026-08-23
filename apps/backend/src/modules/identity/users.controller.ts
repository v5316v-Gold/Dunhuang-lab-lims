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
import { User, UserRole } from '@prisma/client';

import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { RequireRole } from '../../common/auth/decorators/require-role.decorator';
import { MfaProtected } from '../../common/auth/decorators/mfa-api.decorator';
import { MFA_SCENES } from '../../common/auth/decorators/require-mfa.decorator';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/auth/guards/rbac.guard';

import { CreateUserDto, UpdateUserDto, UserFilterDto } from './dto/user.dto';
import { UsersService } from './users.service';


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
  @MfaProtected(MFA_SCENES.USER_DELETE)
  @RequireRole(UserRole.ADMIN)
  @ApiOperation({ summary: '软删除用户(MFA 强制)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.softDelete(id);
  }

  @Post(':id/reset-mfa')
  @MfaProtected(MFA_SCENES.USER_LOCKOUT_RESET)
  @RequireRole(UserRole.ADMIN)
  @ApiOperation({ summary: '重置用户 MFA(管理员,MFA 强制)' })
  resetMfa(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.resetMfa(id);
  }

  @Post(':id/roles')
  @MfaProtected(MFA_SCENES.USER_ROLE_CHANGE)
  @RequireRole(UserRole.ADMIN)
  @ApiOperation({ summary: '分配角色(MFA 强制)' })
  assignRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { role: UserRole },
    @CurrentUser() currentUser: User,
  ) {
    return this.usersService.assignRole(id, body.role, currentUser.id);
  }

  /**
   * POST /users/:id/activate — 审核激活(PENDING → ACTIVE)或重激活(INACTIVE → ACTIVE)
   * 仅 ADMIN,需 MFA
   */
  @Post(':id/activate')
  @MfaProtected(MFA_SCENES.USER_LOCKOUT_RESET)
  @RequireRole(UserRole.ADMIN)
  @ApiOperation({ summary: '审核激活/重激活用户(ADMIN,MFA)' })
  activate(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.activate(id);
  }

  /**
   * POST /users/:id/deactivate — 管理停用(ACTIVE → INACTIVE)
   * 仅 ADMIN,需 MFA
   */
  @Post(':id/deactivate')
  @MfaProtected(MFA_SCENES.USER_LOCKOUT_RESET)
  @RequireRole(UserRole.ADMIN)
  @ApiOperation({ summary: '管理停用用户(ADMIN,MFA)' })
  deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.adminDeactivate(id);
  }

  /**
   * POST /users/:id/reset-password — 管理员重置密码(无需旧密码)
   * 仅 ADMIN,需 MFA
   */
  @Post(':id/reset-password')
  @MfaProtected(MFA_SCENES.USER_LOCKOUT_RESET)
  @RequireRole(UserRole.ADMIN)
  @ApiOperation({ summary: '管理员重置密码(无需旧密码,MFA)' })
  async resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { newPassword: string },
  ) {
    return this.usersService.adminResetPassword(id, body.newPassword);
  }
}