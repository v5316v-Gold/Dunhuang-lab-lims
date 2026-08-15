// =====================================================
// W+1-9: 文件上传 Controller(multipart)
// POST /files/upload  → 通用上传(校准证书/报告附件)
// GET  /files/:id     → 下载
// GET  /files/verify/:sha256 → 防伪校验
// =====================================================

import {
  Body, Controller, Get, Param, Post, UploadedFile, UseGuards, UseInterceptors, Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/auth/guards/rbac.guard';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { User } from '@prisma/client';
import { FileUploadService } from './file-upload.service';

@ApiTags('files')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('files')
export class FileController {
  constructor(private readonly fileService: FileUploadService) {}

  @Post('upload')
  @ApiOperation({ summary: '通用文件上传(返回 id + sha256,供证书/附件引用)' })
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @UploadedFile() file: any,
    @Body() body: { category?: string; equipmentId?: string },
    @CurrentUser() user: User,
  ) {
    if (!file) {
      throw new Error('file 字段必填(multipart/form-data)');
    }
    return this.fileService.uploadFile({
      originalName: file.originalname ?? 'unnamed',
      mimeType: file.mimetype ?? 'application/octet-stream',
      buffer: file.buffer,
      category: (body.category as any) ?? 'CERTIFICATE',
      uploadedById: user.id,
      equipmentId: body.equipmentId,
    });
  }

  @Get('verify/:sha256')
  @ApiOperation({ summary: '按 SHA256 校验文件存在性(证书防伪)' })
  verify(@Param('sha256') sha256: string) {
    return this.fileService.verifyBySha256(sha256);
  }

  @Get('download/:id')
  @ApiOperation({ summary: 'W+4-2: 下载/查看文件(校准证书 PDF)' })
  async download(@Param('id') id: string, @Res() res: any) {
    const file = await this.fileService.getFileById(id);
    const buffer = await this.fileService.readFileBuffer(file.storagePath, file.category as any);
    res.setHeader('Content-Type', file.mimeType ?? 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${file.originalName}"`);
    res.setHeader('X-File-SHA256', file.sha256);
    res.send(buffer);
  }

  @Get(':id')
  @ApiOperation({ summary: '文件详情' })
  findOne(@Param('id') id: string) {
    return this.fileService.getFileById(id);
  }
}