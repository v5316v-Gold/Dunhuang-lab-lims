// =====================================================
// 火试金检测服务
// =====================================================

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import {
  calculateFireAssayPurity,
  calculateParallelRSD,
  FireAssayPurityInput,
} from './fire-assay.calculator';
import Decimal from 'decimal.js';

export interface CreateFireAssayTestDto {
  sampleId: string;
  batchId?: string;
  sampleWeightG: string;
}

export interface RecordProcessDto {
  testId: string;
  furnaceTempC?: number;
  cupellationMin?: number;
  partingMin?: number;
  annealingMin?: number;
  partingAcid?: string;
}

export interface RecordWeightsDto {
  testId: string;
  leadButtonWeightG?: string;
  prillWeightG: string;
  qcRecoveryPct?: string;
}

@Injectable()
export class FireAssayService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 创建火试金检测
   */
  async create(dto: CreateFireAssayTestDto, operatorId: string) {
    return this.prisma.test.create({
      data: {
        sampleId: dto.sampleId,
        batchId: dto.batchId,
        method: 'FIRE_ASSAY',
        operatorId,
        status: 'PENDING',
        fireAssay: {
          create: {
            sampleWeightG: dto.sampleWeightG,
          },
        },
      },
      include: { fireAssay: true },
    });
  }

  /**
   * 记录工艺参数
   */
  async recordProcess(dto: RecordProcessDto) {
    await this.findOne(dto.testId);
    return this.prisma.fireAssayDetail.update({
      where: { testId: dto.testId },
      data: {
        furnaceTempC: dto.furnaceTempC,
        cupellationMin: dto.cupellationMin,
        partingMin: dto.partingMin,
        annealingMin: dto.annealingMin,
        partingAcid: dto.partingAcid,
      },
    });
  }

  /**
   * 记录重量 + 计算纯度
   */
  async recordWeights(dto: RecordWeightsDto) {
    const test = await this.findOne(dto.testId);
    if (!test.fireAssay) {
      throw new NotFoundException('火试金详情不存在');
    }

    // 计算纯度
    const calcInput: FireAssayPurityInput = {
      sampleWeightG: test.fireAssay.sampleWeightG.toString(),
      prillWeightG: dto.prillWeightG,
      qcRecoveryPct: dto.qcRecoveryPct,
    };

    const result = calculateFireAssayPurity(calcInput);

    // 更新数据库(单事务)
    return this.prisma.$transaction(async (tx) => {
      await tx.fireAssayDetail.update({
        where: { testId: dto.testId },
        data: {
          leadButtonWeightG: dto.leadButtonWeightG,
          prillWeightG: dto.prillWeightG,
          qcRecoveryPct: dto.qcRecoveryPct,
        },
      });

      await tx.test.update({
        where: { id: dto.testId },
        data: {
          purityPct: result.purityPct,
          uncertainty: result.uncertainty,
          qcPassed: result.qcPassed,
          completedAt: new Date(),
          status: result.qcPassed ? 'COMPLETED' : 'QC_FAILED',
        },
      });

      // 更新样品状态
      await tx.sample.update({
        where: { id: test.sampleId },
        data: { status: result.qcPassed ? 'TESTED' : 'IN_TEST' },
      });

      return { ...result, testId: dto.testId };
    });
  }

  /**
   * 完成检测(终态)
   */
  async complete(testId: string) {
    await this.findOne(testId);
    return this.prisma.test.update({
      where: { id: testId },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
  }

  /**
   * 查询检测详情
   */
  async findOne(testId: string) {
    const test = await this.prisma.test.findUnique({
      where: { id: testId },
      include: {
        fireAssay: true,
        elementResults: true,
        sample: true,
        operator: { select: { id: true, username: true, name: true } },
      },
    });
    if (!test) {
      throw new NotFoundException(`检测 ${testId} 不存在`);
    }
    return test;
  }

  /**
   * 平行样 RSD 计算(辅助)
   */
  async calculateParallelRSD(testIds: string[]) {
    const tests = await this.prisma.test.findMany({
      where: { id: { in: testIds } },
      select: { purityPct: true },
    });

    const values = tests.map((t) => t.purityPct?.toString()).filter((v): v is string => !!v);
    if (values.length < 2) {
      throw new NotFoundException('平行样至少 2 个结果');
    }

    return {
      rsd: calculateParallelRSD(values),
      count: values.length,
    };
  }
}