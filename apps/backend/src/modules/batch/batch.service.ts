// =====================================================
// 批次服务 - XState + DB 字段冗余
// 详见 ADR-0005
// =====================================================

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AssayMethod, BatchStatus, SampleBatch } from '@prisma/client';
import { AddSamplesToBatchDto, BatchActionDto, CreateBatchDto } from './dto/batch.dto';
import { createActor } from 'xstate';
import { fireAssayBatchMachine, icpBatchMachine } from './batch.state-machine';

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
   */
  async transition(batchId: string, action: BatchActionDto): Promise<SampleBatch> {
    const batch = await this.findOne(batchId);
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

    return this.prisma.sampleBatch.update({
      where: { id: batchId },
      data: updateData,
    });
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