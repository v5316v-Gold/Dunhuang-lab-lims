// =====================================================
// 飞书表格导入 Controller — W3-A
// 上传+预览 / 确认 / 历史 / 模板 / 列映射
// =====================================================

import {
  Body, Controller, Get, Param, Post, Query, Res, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator';
import { ImportEntityType, User, UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../../common/auth/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/auth/guards/rbac.guard';
import { RequireRole } from '../../../common/auth/decorators/require-role.decorator';
import { CurrentUser } from '../../../common/auth/decorators/current-user.decorator';

import { FeishuImportService } from './feishu-import.service';

class UploadImportDto {
  @IsEnum(ImportEntityType)
  entityType!: ImportEntityType;
}

class ConfirmImportDto {
  @IsOptional()
  dryRun?: boolean;
}

class SaveMappingDto {
  @IsEnum(ImportEntityType)
  entityType!: ImportEntityType;
  @IsString()
  name!: string;
  @IsObject()
  mappings!: Record<string, string>;
}

@ApiTags('imports')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('imports')
export class FeishuImportController {
  constructor(private readonly service: FeishuImportService) {}

  @Get('entity-types')
  @ApiOperation({ summary: '可导入的实体类型列表(22 个)' })
  entityTypes() {
    return this.service.listEntityTypes();
  }

  @Get('templates/:entityType')
  @ApiOperation({ summary: '下载实体导入模板 Excel' })
  downloadTemplate(@Param('entityType') entityType: ImportEntityType, @Res() res: any) {
    const buffer = this.service.downloadTemplate(entityType);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${entityType}_template.xlsx"`);
    res.send(buffer);
  }

  @Post('upload')
  @RequireRole(UserRole.ADMIN, UserRole.LAB_DIRECTOR, UserRole.QUALITY_MANAGER)
  @ApiOperation({ summary: '上传飞书导出 Excel + 解析预览' })
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @UploadedFile() file: any,
    @Body() dto: UploadImportDto,
    @CurrentUser() user: User,
  ) {
    return this.service.uploadAndPreview(file, dto.entityType, user.id);
  }

  @Post(':batchId/confirm')
  @RequireRole(UserRole.ADMIN, UserRole.LAB_DIRECTOR, UserRole.QUALITY_MANAGER)
  @ApiOperation({ summary: '确认导入(逐行事务,失败不影响其他行)' })
  confirm(
    @Param('batchId') batchId: string,
    @Body() dto: ConfirmImportDto,
    @CurrentUser() user: User,
  ) {
    return this.service.confirmImport(batchId, user.id, dto.dryRun);
  }

  @Get()
  @ApiOperation({ summary: '导入历史(分页)' })
  findAll(@Query() filter: { page?: number; pageSize?: number }) {
    return this.service.findAll(filter);
  }

  @Get(':id')
  @ApiOperation({ summary: '导入批次详情(含每行明细)' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Get('mappings/:entityType')
  @ApiOperation({ summary: '实体默认列映射 + 已保存模板' })
  mappings(@Param('entityType') entityType: ImportEntityType) {
    return {
      ...this.service.getDefaultMappings(entityType),
      templates: this.service.listColumnMappings(entityType),
    };
  }

  @Post('mappings')
  @RequireRole(UserRole.ADMIN, UserRole.LAB_DIRECTOR, UserRole.QUALITY_MANAGER)
  @ApiOperation({ summary: '保存自定义列映射模板' })
  saveMapping(@Body() dto: SaveMappingDto, @CurrentUser() user: User) {
    return this.service.saveColumnMapping(dto.entityType, dto.name, dto.mappings, user.id);
  }
}
