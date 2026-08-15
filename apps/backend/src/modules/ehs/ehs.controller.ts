// =====================================================
// EHS API
// =====================================================

import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { User } from '@prisma/client';

import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/auth/guards/rbac.guard';

import { EhsService } from './ehs.service';


@ApiTags('ehs')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('ehs')
export class EhsController {
  constructor(private readonly ehsService: EhsService) {}

  @Post('hazards')
  @ApiOperation({ summary: '上报隐患' })
  createHazard(@Body() body: any, @CurrentUser() user: User) {
    return this.ehsService.createHazard({ ...body, reportedById: user.id });
  }

  @Get('hazards')
  @ApiOperation({ summary: '查询隐患列表' })
  findHazards(@Query() filter: any) {
    return this.ehsService.findHazards(filter);
  }

  @Post('hazards/:id/resolve')
  @ApiOperation({ summary: '整改隐患' })
  resolveHazard(@Param('id', ParseUUIDPipe) id: string, @Body() body: { resolution: string }, @CurrentUser() user: User) {
    return this.ehsService.resolveHazard(id, user.id, body.resolution);
  }

  @Post('emergency-plans')
  @ApiOperation({ summary: '创建应急预案' })
  createPlan(@Body() body: any) {
    return this.ehsService.createEmergencyPlan(body);
  }

  @Get('emergency-plans')
  @ApiOperation({ summary: '查询应急预案' })
  findPlans() {
    return this.ehsService.findEmergencyPlans();
  }
}