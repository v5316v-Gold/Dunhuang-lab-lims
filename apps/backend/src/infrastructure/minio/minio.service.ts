// =====================================================
// MinIO 服务 - S3 兼容对象存储
// 详见 ADR-0006
// =====================================================

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';

export type BucketName = 'reports' | 'certificates' | 'photos' | 'qc-data';

@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger = new Logger(MinioService.name);
  private client!: Minio.Client;
  private readonly buckets = {
    reports: process.env.MINIO_BUCKET_REPORTS || 'dunhuang-reports',
    certificates: process.env.MINIO_BUCKET_CERTIFICATES || 'dunhuang-certificates',
    photos: process.env.MINIO_BUCKET_PHOTOS || 'dunhuang-photos',
    'qc-data': process.env.MINIO_BUCKET_QC || 'dunhuang-qc-data',
  };

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    this.client = new Minio.Client({
      endPoint: this.config.get<string>('MINIO_ENDPOINT', 'localhost'),
      port: this.config.get<number>('MINIO_PORT', 9000),
      useSSL: this.config.get<string>('MINIO_USE_SSL', 'false') === 'true',
      accessKey: this.config.get<string>('MINIO_ACCESS_KEY', 'dunhuang_minio'),
      secretKey: this.config.get<string>('MINIO_SECRET_KEY', 'dunhuang_minio_dev_pwd'),
    });

    // 自动创建 bucket(开发环境)
    if (process.env.NODE_ENV !== 'production') {
      await this.ensureBuckets();
    }
    this.logger.log('✅ MinIO 客户端已初始化');
  }

  private async ensureBuckets(): Promise<void> {
    for (const [, bucket] of Object.entries(this.buckets)) {
      try {
        const exists = await this.client.bucketExists(bucket);
        if (!exists) {
          await this.client.makeBucket(bucket, 'cn-north-1');
          this.logger.log(`创建 Bucket: ${bucket}`);
        }
      } catch (err) {
        this.logger.error(`Bucket 创建失败 ${bucket}: ${(err as Error).message}`);
      }
    }
  }

  /**
   * 上传文件
   */
  async upload(
    bucket: BucketName,
    path: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<string> {
    const bucketName = this.buckets[bucket];
    await this.client.putObject(bucketName, path, buffer, buffer.length, {
      'Content-Type': mimeType,
      'X-Amz-Server-Side-Encryption': 'AES256',
    });
    return path;
  }

  /**
   * 下载文件
   */
  async download(bucket: BucketName, path: string): Promise<Buffer> {
    const bucketName = this.buckets[bucket];
    const stream = await this.client.getObject(bucketName, path);
    const chunks: Buffer[] = [];
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }

  /**
   * 删除文件
   */
  async delete(bucket: BucketName, path: string): Promise<void> {
    const bucketName = this.buckets[bucket];
    await this.client.removeObject(bucketName, path);
  }

  /**
   * 生成预签名 URL(临时访问)
   */
  async getPresignedUrl(
    bucket: BucketName,
    path: string,
    expiresInSec: number = 3600,
  ): Promise<string> {
    const bucketName = this.buckets[bucket];
    return this.client.presignedGetObject(bucketName, path, expiresInSec);
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<boolean> {
    try {
      // listBuckets 是轻量级操作
      await this.client.listBuckets();
      return true;
    } catch {
      return false;
    }
  }
}