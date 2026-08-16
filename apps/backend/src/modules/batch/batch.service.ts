// =====================================================
// 批次服务 - XState + DB 字段冗余
// 详见 ADR-0005
// =====================================================

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AssayMethod, BatchStatus, SampleBatch } from '@prisma/client';
import { createActor } from 'xstate';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';

import { fireAssayBatchMachine, icpBatchMachine } from './batch.state-machine';
import { AddSamplesToBatchDto, BatchActionDto, CreateBatchDto, ProcessParameterDto } from './dto/batch.dto';

type SupportedMethod = 'FIRE_ASSAY' | 'ICP_OES' | 'ICP_MS';

function resolveMachine(method: AssayMethod) {
  if (method === 'FIRE_ASSAY') return fireAssayBatchMachine;
  if (method === 'ICP_OES' || method === 'ICP_MS') return icpBatchMachine;
  throw new BadRequestException(`不支持的检测方法: ${method}`);
}

@Injectable()
export class BatchService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 创建批次
   */
  async create(dto: CreateBatchDto, operatorId: string): Promise<SampleBatch> {
    const batchNo = await this.generateBatchNo(dto.method);

    return this.prisma.sampleBatch.create({
      data: {
        batchNo,
        method: dto.method,
        replicateCount: dto.replicateCount ?? 3,
        furnaceNo: dto.furnaceNo,
        qcSampleId: dto.qcSampleId,
        operatorId,
        status: BatchStatus.PENDING,
      },
    });
  }

  /**
   * 添加样品到批次
   */
  async addSamples(batchId: string, dto: AddSamplesToBatchDto): Promise<SampleBatch> {
    const batch = await this.findOne(batchId);
    if (batch.status !== BatchStatus.PENDING && batch.status !== BatchStatus.MIXING) {
      throw new BadRequestException(`批次已 ${batch.status},无法添加样品`);
    }

    await this.prisma.sample.updateMany({
      where: { id: { in: dto.sampleIds } },
      data: { batchId, status: 'BATCHED' },
    });

    return this.findOne(batchId);
  }

  /**
   * 状态机推进(XState 5 actor)
   * @param process 工艺参数(可选,Phase 2 Day 3 录入并存入 fire_assay_details)
   */
  async transition(
    batchId: string,
    action: BatchActionDto,
    process?: ProcessParameterDto,
  ): Promise<SampleBatch> {
    const batch = await this.findOne(batchId);
    // 白名单校验:非法事件直接 400,避免 XState actor 异步异常逃逸导致进程崩溃
    if (!['START', 'ADVANCE', 'COMPLETE', 'REJECT'].includes(action?.action)) {
      throw new BadRequestException(`未知批次事件: ${action?.action}`);
    }
    const machine = resolveMachine(batch.method);
    let nextState: string;
    const actor = createActor(machine, { snapshot: machine.resolveState({ value: batch.status }) });
    actor.start();
    try {
      actor.send({ type: action.action });
      const snapshot = actor.getSnapshot();
      const next = snapshot.value;
      if (typeof next !== 'string') {
        throw new BadRequestException(`非法状态转换: ${batch.status} → ${action.action}`);
      }
      if (next === batch.status) {
        throw new BadRequestException(`非法状态转换: ${batch.status} → ${action.action}`);
      }
      nextState = next;
    } catch (err) {
      actor.stop();
      if (err instanceof Error) {
        throw new BadRequestException(`状态机错误: ${err.message}`);
      }
      throw err;
    }
    actor.stop();

    const updateData: any = { status: nextState as BatchStatus };
    if (action.action === 'START' && !batch.startedAt) {
      updateData.startedAt = new Date();
    }
    if (action.action === 'COMPLETE') {
      updateData.completedAt = new Date();
    }

    // 工艺参数入库(只有火试金 + 有工艺参数时才落 fire_assay_details)
    if (
      process &&
      batch.method === 'FIRE_ASSAY' &&
      Object.values(process).some((v) => v !== undefined && v !== null && v !== '')
    ) {
      // 事务:先更新 batch 状态,再为每个样品 upsert FireAssayDetail
      return this.prisma.$transaction(async (tx) => {
        const updated = await tx.sampleBatch.update({
          where: { id: batchId },
          data: updateData,
        });

        const detailData: any = {};
        if (process.mixingTempC) detailData.furnaceTempC = parseFloat(process.mixingTempC);
        if (process.mixingDurationMin) detailData.cupellationMin = parseFloat(process.mixingDurationMin);
        if (process.furnaceTempC) detailData.furnaceTempC = parseFloat(process.furnaceTempC);
        if (process.fusingDurationMin) detailData.cupellationMin = parseFloat(process.fusingDurationMin);
        if (process.cupellationTempC) detailData.furnaceTempC = parseFloat(process.cupellationTempC);
        if (process.cupellationDurationMin) detailData.cupellationMin = parseFloat(process.cupellationDurationMin);
        if (process.partingAcid) detailData.partingAcid = process.partingAcid;
        if (process.partingDurationMin) detailData.partingMin = parseFloat(process.partingDurationMin);
        if (process.annealingTempC) detailData.furnaceTempC = parseFloat(process.annealingTempC);
        if (process.annealingDurationMin) detailData.annealingMin = parseFloat(process.annealingDurationMin);

        // 为批次每个样品 upsert 一条 FireAssayDetail(若已存在则只更新)
        for (const sample of batch.samples) {
          // 自动创建 test(若不存在),Phase 2 Day 3 允许 state machine 自动建 test
          let test = await tx.test.findFirst({
            where: { batchId, sampleId: sample.id, method: 'FIRE_ASSAY' },
          });
          if (!test) {
            test = await tx.test.create({
              data: {
                sampleId: sample.id,
                batchId,
                method: 'FIRE_ASSAY',
                status: 'PENDING',
                operatorId: batch.operatorId,
              },
            });
          }

          // sampleWeightG 是必填,取样品 weightG 兜底
          const baseCreateData = {
            testId: test.id,
            sampleWeightG: sample.weightG, // 必填
            ...detailData,
          };

          await tx.fireAssayDetail.upsert({
            where: { testId: test.id },
            create: baseCreateData,
            update: detailData,
          });
        }

        return updated;
      });
    }

    return this.prisma.sampleBatch.update({
      where: { id: batchId },
      data: updateData,
    });
  }

  /**
   * 查询批次工艺参数(批次内所有样品的 fire_assay_detail 集合)
   * Phase 2 Day 3: 工艺历史展示
   */
  async getProcessParams(batchId: string) {
    const batch = await this.findOne(batchId);

    // 取所有样品的 test + fire_assay_detail
    const sampleIds = batch.samples.map((s) => s.id);
    if (sampleIds.length === 0) {
      return { batchId, batchNo: batch.batchNo, params: [] };
    }

    const tests = await this.prisma.test.findMany({
      where: {
        batchId,
        sampleId: { in: sampleIds },
        method: 'FIRE_ASSAY',
      },
      include: {
        fireAssay: true,
        sample: { select: { id: true, sampleNo: true, customerName: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return {
      batchId,
      batchNo: batch.batchNo,
      currentStatus: batch.status,
      params: tests
        .filter((t) => t.fireAssay)
        .map((t) => ({
          testId: t.id,
          sample: t.sample,
          method: t.method,
          furnaceTempC: t.fireAssay?.furnaceTempC?.toString() ?? null,
          cupellationMin: t.fireAssay?.cupellationMin?.toString() ?? null,
          partingMin: t.fireAssay?.partingMin?.toString() ?? null,
          partingAcid: t.fireAssay?.partingAcid ?? null,
          annealingMin: t.fireAssay?.annealingMin?.toString() ?? null,
          recordedAt: t.fireAssay?.createdAt ?? t.createdAt,
        })),
    };
  }

  /**
   * 查询批次详情
   */
  async findOne(id: string) {
    const batch = await this.prisma.sampleBatch.findUnique({
      where: { id },
      include: {
        operator: { select: { id: true, username: true, name: true } },
        samples: {
          select: {
            id: true,
            sampleNo: true,
            customerName: true,
            sampleType: true,
            weightG: true,
            status: true,
            tests: {
              where: { batchId: id, method: 'FIRE_ASSAY' },
              select: {
                id: true,
                status: true,
                purityPct: true,
                uncertainty: true,
                qcPassed: true,
              },
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
    });
    if (!batch) {
      throw new NotFoundException(`批次 ${id} 不存在`);
    }
    return batch;
  }

  /**
   * 查询批次列表
   */
  async findAll(filter: { method?: AssayMethod | string; status?: BatchStatus | string; page?: number; pageSize?: number }) {
    const { page = 1, pageSize = 20, ...where } = filter;
    const where_: any = {};
    if (where.method) where_.method = where.method;
    if (where.status) where_.status = where.status;

    const [data, total] = await Promise.all([
      this.prisma.sampleBatch.findMany({
        where: where_,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          operator: { select: { id: true, username: true, name: true } },
          _count: { select: { samples: true } },
        },
      }),
      this.prisma.sampleBatch.count({ where: where_ }),
    ]);

    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  /**
   * 生成批次号: METHOD-YYYYMMDD-NNN
   */
  private async generateBatchNo(method: AssayMethod): Promise<string> {
    const prefix = method === AssayMethod.FIRE_ASSAY ? 'FB' : 'ICP';
    const now = new Date();
    const dateStr =
      now.getFullYear().toString() +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0');

    const last = await this.prisma.sampleBatch.findFirst({
      where: { batchNo: { startsWith: `${prefix}-${dateStr}` } },
      orderBy: { batchNo: 'desc' },
      select: { batchNo: true },
    });

    let nextSeq = 1;
    if (last) {
      const lastSeq = parseInt(last.batchNo.split('-')[2] ?? '0', 10);
      nextSeq = lastSeq + 1;
    }

    return `${prefix}-${dateStr}-${String(nextSeq).padStart(3, '0')}`;
  }
}