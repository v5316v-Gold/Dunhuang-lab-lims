// =====================================================
// 火试金检测服务
// =====================================================

import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { User, UserRole } from '@prisma/client';
import Decimal from 'decimal.js';

import { validateStepOrder, isAllStepsDone } from './fire-assay-steps';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';

import {
  calculateFireAssayPurity,
  calculateParallelRSD,
  FireAssayPurityInput,
} from './fire-assay.calculator';

export interface CreateFireAssayTestDto {
  sampleId: string;
  batchId?: string;
  sampleWeightG?: string;   // 修复: 可选,未传则从样品表自动取 weightG
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
   * Phase 1 Task 2.2: row-level 权限校验(检测归属)
   * 规则: ANALYST/INTERN 只能操作自己负责的检测任务;
   *       SENIOR_ANALYST/QUALITY_MANAGER/LAB_DIRECTOR/ADMIN 可操作全部
   */
  private async assertCanOperate(testId: string, user: User): Promise<void> {
    if (user.role === UserRole.ADMIN || user.role === UserRole.LAB_DIRECTOR ||
        user.role === UserRole.QUALITY_MANAGER || user.role === UserRole.SENIOR_ANALYST) {
      return;
    }
    const test = await this.prisma.test.findUnique({
      where: { id: testId },
      select: { operatorId: true },
    });
    if (!test) {
      throw new NotFoundException(`检测 ${testId} 不存在`);
    }
    if (test.operatorId !== user.id) {
      throw new ForbiddenException('只能操作自己负责的检测任务');
    }
  }

  /**
   * 创建火试金检测
   */
  async create(dto: CreateFireAssayTestDto, operatorId: string) {
    // 修复: 校验 sampleId 是合法 UUID(否则 Prisma P2023)
    const sampleId = (dto.sampleId ?? '').trim();
    const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (!UUID_RE.test(sampleId)) {
      throw new BadRequestException('样品 ID 不是有效的 UUID 格式,请检查(如 4542c828-0308-46d6-bd64-df7605f10ed3)');
    }
    // 修复: sampleWeightG 未传时,自动从样品表取 weightG
    let sampleWeightG = dto.sampleWeightG;
    if (!sampleWeightG) {
      const sample = await this.prisma.sample.findUnique({
        where: { id: sampleId },
        select: { weightG: true },
      });
      if (!sample) {
        throw new NotFoundException(`样品 ${sampleId} 不存在,无法创建检测`);
      }
      if (sample?.weightG != null) {
        sampleWeightG = String(sample.weightG);
      }
    }
    return this.prisma.test.create({
      data: {
        sampleId,
        batchId: dto.batchId,
        method: 'FIRE_ASSAY',
        operatorId,
        status: 'PENDING',
        fireAssay: {
          create: {
            sampleWeightG: sampleWeightG ?? '0',
          },
        },
      },
      include: { fireAssay: true },
    });
  }

  /**
   * 记录工艺参数
   */
  async recordProcess(dto: RecordProcessDto, user: User) {
    await this.assertCanOperate(dto.testId, user);
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
  async recordWeights(dto: RecordWeightsDto, user: User) {
    await this.assertCanOperate(dto.testId, user);
    const test = await this.findOne(dto.testId);
    if (!test.fireAssay) {
      throw new NotFoundException('火试金详情不存在');
    }

    // Phase 2 填充(F1): 步骤顺序守卫 — 称重(最终步骤)前必须完成全部前序工艺
    const order = validateStepOrder('FINAL_WEIGHING', test.fireAssay);
    if (!order.ok) {
      throw new BadRequestException(
        `火试金步骤未完成,缺少: ${order.missingSteps.join(' → ')}。请按 称样→熔融→灰吹→分金→退火 顺序执行`,
      );
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

      // Phase 2 Day 5:自动入库 QC 测量记录 + 触发 Westgard 规则
      try {
        // 1) 写 qc_measurements(Z-score 需要历史数据,这里先存 measured 值)
        await tx.qcMeasurement.create({
          data: {
            testId: dto.testId,
            referenceId: test.batchId ? null : null, // 简化:暂不关联标准物质
            qcType: 'STANDARD',
            element: 'Au',
            measured: result.purityPct,
            expected: '99.999',
            sd: '0.0005',
            zScore: null, // 留待 Westgard 评估
            recoveryPct: dto.qcRecoveryPct ?? null,
            passed: result.qcPassed,
            operatorId: test.operatorId,
            westgardRule: null,
          },
        });
      } catch (qcErr) {
        // QC 测量入库失败不影响主流程
        // eslint-disable-next-line no-console
        console.warn('[QC] 自动入库失败:', (qcErr as Error).message);
      }

      return { ...result, testId: dto.testId };
    });
  }

  /**
   * 完成检测(终态)
   */
  async complete(testId: string, user: User) {
    await this.assertCanOperate(testId, user);
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