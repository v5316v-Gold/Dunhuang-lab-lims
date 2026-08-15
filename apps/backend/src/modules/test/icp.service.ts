// =====================================================
// ICP 检测服务
// =====================================================

import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';

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
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateIcpTestDto, operatorId: string) {
    return this.prisma.test.create({
      data: {
        sampleId: dto.sampleId,
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

  async complete(testId: string) {
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