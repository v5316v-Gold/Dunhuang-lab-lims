// =====================================================
// W+1-9: 通用文件上传服务(校准证书/报告附件复用)
// CNAS §6.5/§7.6: 校准证书 PDF + SHA256 防伪
// =====================================================

import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { Prisma, FileCategory } from '@prisma/client';
import WordExtractor from 'word-extractor';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { MinioService } from '../../infrastructure/minio/minio.service';
import { SecurityAuditService } from '../../common/audit/security-audit.service';
import { AuditEventType } from '../../common/audit/audit-event.enum';

/** DOC/DOCX 文本提取结果 */
export interface DocExtractResult {
  text: string;
  meta: { format: 'doc' | 'docx'; wordCount: number; paragraphCount: number };
}

@Injectable()
export class FileUploadService {
  private readonly logger = new Logger(FileUploadService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly minio: MinioService,
    private readonly securityAudit: SecurityAuditService,
  ) {}

  /**
   * 判断是否为 Word 文档(.doc/.docx,按扩展名 + MIME 双保险)
   */
  static isWordDocument(mimeType: string, originalName: string): boolean {
    const lower = originalName.toLowerCase();
    const byMime =
      mimeType === 'application/msword' ||
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.template' ||
      mimeType === 'application/octet-stream';
    return lower.endsWith('.doc') || lower.endsWith('.docx') || byMime;
  }

  /**
   * 提取 Word 文档正文(word-extractor 支持 .doc(OLE)与 .docx(zip))
   * 提取失败不阻断上传(返回 null,文件仍正常入库)
   */
  async extractDocText(buffer: Buffer, mimeType: string, originalName: string): Promise<DocExtractResult | null> {
    if (!FileUploadService.isWordDocument(mimeType, originalName)) return null;
    const isDocx = originalName.toLowerCase().endsWith('.docx');
    try {
      const extractor = new WordExtractor();
      const doc = await extractor.extract(buffer);
      const raw = doc.getBody() ?? '';
      const text = raw.trim();
      if (!text) return null;
      return {
        text,
        meta: {
          format: isDocx ? 'docx' : 'doc',
          wordCount: text.split(/\s+/).filter(Boolean).length,
          paragraphCount: text.split(/\n+/).filter(Boolean).length,
        },
      };
    } catch (err) {
      this.logger.warn(`DOC 文本提取失败 ${originalName}: ${(err as Error).message}`);
      return null;
    }
  }

  /**
   * 上传文件 → MinIO + FileAttachment 记录(Word 文档自动提取正文)
   * @returns { id, sha256, category, storagePath, extractedText?, docMeta? }
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
    // 2. 防重:同 sha256 已存在则直接返回(sha256 为 @@index 非 @unique,用 findFirst)
    const existing = await this.prisma.fileAttachment.findFirst({ where: { sha256 } });
    if (existing) {
      return existing;
    }

    // 3. Word 文档自动提取正文(识别)
    let extractedText: string | null = null;
    let docMeta: Prisma.InputJsonValue | undefined;
    if (FileUploadService.isWordDocument(mimeType, originalName)) {
      const extracted = await this.extractDocText(buffer, mimeType, originalName);
      if (extracted) {
        extractedText = extracted.text;
        docMeta = extracted.meta as unknown as Prisma.InputJsonValue;
      }
    }

    // 4. 存 MinIO
    const ext = originalName.includes('.') ? originalName.split('.').pop() : 'bin';
    const storagePath = `uploads/${category}/${Date.now()}-${sha256.slice(0, 12)}.${ext}`;
    await this.minio.upload('certificates', storagePath, buffer, mimeType);

    // 5. 写 FileAttachment 表
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
        extractedText,
        docMeta,
      },
    });

    await this.securityAudit.system(AuditEventType.SETTINGS_CHANGED, {
      event: 'FILE_UPLOADED',
      sha256,
      originalName,
      category,
      size: buffer.length,
      extracted: extractedText ? { chars: extractedText.length } : undefined,
    });

    return record;
  }

  /** 文件列表(文档中心) */
  async findAll(params: { category?: FileCategory; page?: number; pageSize?: number }) {
    const page = params.page ? Number(params.page) : 1;
    const pageSize = params.pageSize ? Number(params.pageSize) : 20;
    const where: Prisma.FileAttachmentWhereInput = params.category
      ? { category: params.category }
      : {};
    const [items, total] = await Promise.all([
      this.prisma.fileAttachment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { uploadedBy: { select: { id: true, username: true, name: true } } },
      }),
      this.prisma.fileAttachment.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  /** 按 id 取文件(供下载) */
  async getFileById(id: string) {
    const f = await this.prisma.fileAttachment.findUnique({ where: { id } });
    if (!f) throw new BadRequestException(`文件 ${id} 不存在`);
    return f;
  }

  /**
   * 读取文件内容(从 MinIO)
   * ⚠️ 2026-08-23 修复: 原代码用 category → bucket 映射,但 upload 硬编码存到 'certificates' 桶,
   *    category 只是 path 前缀(uploads/${category}/...),下载与 category 无关。
   *    原实现对所有 category 都会 InvalidBucketNameError → 下载 500。
   */
  async readFileBuffer(storagePath: string): Promise<Buffer> {
    return this.minio.download('certificates', storagePath);
  }

  /** 按 sha256 查(防伪验证:证书哈希比对) */
  async verifyBySha256(sha256: string) {
    // ⚠️ fix: sha256 是 @@index 非 @unique,findUnique 会抛,改 findFirst
    const f = await this.prisma.fileAttachment.findFirst({ where: { sha256 } });
    return { valid: !!f, file: f };
  }
}