// =====================================================
// 留样期配置 Controller(W1 架构 — CNAS-CL01 §7.5.2)
// 列表所有角色可见;修改需 LAB_DIRECTOR
// =====================================================

import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/auth/guards/rbac.guard';
import { RequireRole } from '../../common/auth/decorators/require-role.decorator';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { User, UserRole } from '@prisma/client';
import { RetentionPolicyService } from './retention-policy.service';

@ApiTags('retention-policies')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('retention-policies')
export class RetentionPolicyController {
  constructor(private readonly service: RetentionPolicyService) {}

  @Get()
  @ApiOperation({ summary: '留样/记录保存期列表' })
  findAll() {
    return this.service.findAll();
  }

  @Patch(':entityType')
  @RequireRole(UserRole.LAB_DIRECTOR, UserRole.ADMIN)
  @ApiOperation({ summary: '更新留样期(创建新版本,实验室主任)' })
  update(
    @Param('entityType') entityType: string,
    @Body() body: { retentionMonths: number; archiveAfterMonths: number; description?: string },
    @CurrentUser() user: User,
  ) {
    return this.service.update(
      entityType,
      body.retentionMonths,
      body.archiveAfterMonths,
      user.id,
      body.description,
    );
  }
}
