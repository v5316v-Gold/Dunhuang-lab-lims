// =====================================================
// W+1-9: 通用文件上传服务(校准证书/报告附件复用)
// CNAS §6.5/§7.6: 校准证书 PDF + SHA256 防伪
// =====================================================

import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { Prisma, FileCategory } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { MinioService } from '../../infrastructure/minio/minio.service';
import { SecurityAuditService } from '../../common/audit/security-audit.service';
import { AuditEventType } from '../../common/audit/audit-event.enum';

@Injectable()
export class FileUploadService {
  private readonly logger = new Logger(FileUploadService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly minio: MinioService,
    private readonly securityAudit: SecurityAuditService,
  ) {}

  /**
   * 上传文件 → MinIO + FileAttachment 记录
   * @returns { id, sha256, category, storagePath }
   */
  async uploadFile(params: {
    originalName: string;
    mimeType: string;
    buffer: Buffer;
    category: FileCategory;
    uploadedById: string;
    equipmentId?: string;
  }): Promise<any> {
    const { originalName, mimeType, buffer, category, uploadedById, equipmentId } = params;
    if (!buffer || buffer.length === 0) {
      throw new BadRequestException('文件内容为空');
    }
    if (buffer.length > 10 * 1024 * 1024) {
      throw new BadRequestException('文件超过 10MB 上限');
    }

    // 1. sha256 指纹
    const sha256 = createHash('sha256').update(buffer).digest('hex');
    // 2. 防重:同 sha256 已存在则直接返回
    const existing = await this.prisma.fileAttachment.findUnique({ where: { sha256 } });
    if (existing) {
      return existing;
    }

    // 3. 存 MinIO
    const ext = originalName.includes('.') ? originalName.split('.').pop() : 'bin';
    const storagePath = `uploads/${category}/${Date.now()}-${sha256.slice(0, 12)}.${ext}`;
    await this.minio.upload('dunhuang-certificates', storagePath, buffer);

    // 4. 写 FileAttachment 表
    const record = await this.prisma.fileAttachment.create({
      data: {
        fileName: storagePath,
        originalName,
        mimeType,
        size: BigInt(buffer.length),
        category,
        storagePath,
        sha256,
        uploadedById,
        equipmentId,
      },
    });

    await this.securityAudit.system(AuditEventType.SETTINGS_CHANGED, {
      event: 'FILE_UPLOADED',
      sha256,
      originalName,
      category,
      size: buffer.length,
    });

    return record;
  }

  /** 按 id 取文件(供下载) */
  async getFileById(id: string) {
    const f = await this.prisma.fileAttachment.findUnique({ where: { id } });
    if (!f) throw new BadRequestException(`文件 ${id} 不存在`);
    return f;
  }

  /** 读取文件内容(从 MinIO) */
  async readFileBuffer(storagePath: string, category: string): Promise<Buffer> {
    return this.minio.download(category as any, storagePath);
  }

  /** 按 sha256 查(防伪验证:证书哈希比对) */
  async verifyBySha256(sha256: string) {
    // ⚠️ fix: sha256 是 @@index 非 @unique,findUnique 会抛,改 findFirst
    const f = await this.prisma.fileAttachment.findFirst({ where: { sha256 } });
    return { valid: !!f, file: f };
  }
}