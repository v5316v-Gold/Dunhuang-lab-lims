// =====================================================
// ICP 检测服务
// =====================================================

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { User } from '@prisma/client';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { DomainEventBus } from '../../common/events/domain-event-bus';
import { DomainEvents, TestCompletedEvent } from '../../common/events/domain-events';
import { TestAccessService } from './test-access.service';

export interface CreateIcpTestDto {
  sampleId: string;
  batchId?: string;
}

export interface ElementResultInput {
  element: string; // Au / Ag / Cu / Fe / Pb ...
  concentration: string;
  unit?: string; // ppm/ppb/%
  wavelengthNm?: string;
  intensity?: string;
  lod?: string;
  loq?: string;
  uncertainty?: string;
  calibrationR2?: string;         // W+2-3 校准曲线 R²
  calibrationCurveFileId?: string; // W+2-3 曲线附件
}

@Injectable()
export class IcpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: DomainEventBus,
    private readonly testAccess: TestAccessService,
  ) {}

  async create(dto: CreateIcpTestDto, operatorId: string) {
    // 修复: 校验 sampleId 是合法 UUID(否则 Prisma P2023)
    const sampleId = (dto.sampleId ?? '').trim();
    const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (!UUID_RE.test(sampleId)) {
      throw new BadRequestException('样品 ID 不是有效的 UUID 格式,请检查(如 4542c828-0308-46d6-bd64-df7605f10ed3)');
    }
    const sample = await this.prisma.sample.findUnique({ where: { id: sampleId }, select: { id: true } });
    if (!sample) {
      throw new NotFoundException(`样品 ${sampleId} 不存在,无法创建检测`);
    }
    return this.prisma.test.create({
      data: {
        sampleId,
        batchId: dto.batchId,
        method: 'ICP_OES',
        operatorId,
        status: 'IN_PROGRESS',
        startedAt: new Date(),
      },
    });
  }

  async addElementResults(testId: string, results: ElementResultInput[]) {
    await this.findOne(testId);

    // 批量插入
    await this.prisma.elementResult.createMany({
      data: results.map((r) => ({
        testId,
        element: r.element,
        concentration: r.concentration,
        unit: r.unit ?? 'ppm',
        wavelengthNm: r.wavelengthNm,
        intensity: r.intensity,
        lod: r.lod,
        calibrationR2: r.calibrationR2,
        calibrationCurveFileId: r.calibrationCurveFileId,
        loq: r.loq,
        uncertainty: r.uncertainty,
      })),
    });

    return this.findOne(testId);
  }

  async complete(testId: string, user: User) {
    // 行级权限统一校验(与火试金一致)
    await this.testAccess.assertCanOperate(testId, user);
    const test = await this.findOne(testId);

    // 计算主元素纯度(若有 Au 结果,用作 purityPct)
    const auResult = test.elementResults.find((r) => r.element === 'Au');
    const purityPct = auResult?.concentration.toString();

    await this.prisma.$transaction(async (tx) => {
      await tx.test.update({
        where: { id: testId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          purityPct,
          qcPassed: true,
        },
      });

      await tx.sample.update({
        where: { id: test.sampleId },
        data: { status: 'TESTED' },
      });
    });

    // 架构优化 A1: 发布"检测完成"领域事件 → 报告模块监听后自动建草稿(解耦)
    const payload: TestCompletedEvent = {
      testId,
      sampleId: test.sampleId,
      method: 'ICP_OES',
      qcPassed: true,
      operatorId: user.id,
    };
    await this.eventBus.emitAsync(DomainEvents.TEST_COMPLETED, payload);
    return this.findOne(testId);
  }

  async findOne(testId: string) {
    const test = await this.prisma.test.findUnique({
      where: { id: testId },
      include: {
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
}