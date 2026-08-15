// =====================================================
// W4 贵金属业务 - Controller
// =====================================================

import {
  Body, Controller, Get, Param, ParseIntPipe, ParseUUIDPipe,
  Post, Query, UseGuards, BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/auth/guards/rbac.guard';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { User, SamplingMethod, SamplingLocation, SampleForm, MetalType, BarQualityGrade } from '@prisma/client';
import {
  CreateSamplingRecordDto, CreatePreciousMetalBarDto, PreciousMetalService,
} from './precious-metal.service';

@ApiTags('precious-metal')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('precious-metal')
export class PreciousMetalController {
  constructor(private readonly preciousMetalService: PreciousMetalService) {}

  // ============ SamplingRecord 取样记录 ============

  @Post('sampling')
  @ApiOperation({ summary: '登记取样记录(CNAS §7.8)' })
  createSampling(@Body() dto: CreateSamplingRecordDto, @CurrentUser() user: User) {
    return this.preciousMetalService.createSampling(dto, user.id);
  }

  @Get('sampling/list')
  @ApiOperation({ summary: '取样记录列表' })
  findAllSamplings(
    @Query('method') method?: SamplingMethod,
    @Query('metalType') metalType?: MetalType,
    @Query('sampledById') sampledById?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.preciousMetalService.findAllSamplings({
      method, metalType, sampledById,
      page: page ? parseInt(page) : undefined,
      pageSize: pageSize ? parseInt(pageSize) : undefined,
    });
  }

  @Get('sampling/:id')
  @ApiOperation({ summary: '取样记录详情' })
  findSamplingById(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.preciousMetalService.findSamplingById(id);
  }

  // ============ PreciousMetalBar 贵金属条码 ============

  @Post('bar')
  @ApiOperation({ summary: '生成贵金属条码(出证)' })
  createBar(@Body() dto: CreatePreciousMetalBarDto, @CurrentUser() user: User) {
    return this.preciousMetalService.createBar(dto, user.id);
  }

  @Get('bar/scan/:barCode')
  @ApiOperation({ summary: '扫码追溯(按条码查询完整检测链)' })
  scanBar(@Param('barCode') barCode: string) {
    return this.preciousMetalService.findBarByCode(barCode);
  }

  @Get('bar/list')
  @ApiOperation({ summary: '贵金属条码列表' })
  findAllBars(
    @Query('metalType') metalType?: MetalType,
    @Query('qualityGrade') qualityGrade?: BarQualityGrade,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.preciousMetalService.findAllBars({
      metalType, qualityGrade, status,
      page: page ? parseInt(page) : undefined,
      pageSize: pageSize ? parseInt(pageSize) : undefined,
    });
  }

  // ============ 合规摘要 ============

  @Get('summary')
  @ApiOperation({ summary: '贵金属业务合规摘要(CNAS §7.5 + §7.8)' })
  summary() {
    return this.preciousMetalService.summary();
  }
}