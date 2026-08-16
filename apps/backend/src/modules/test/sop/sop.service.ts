// =====================================================
// SOP 检测流程数字化 — 火试金 GB/T 9288 / ICP-OES GB/T 21198
// 详见 ADR-0011
//
// 设计:
//   - SOP 模板用 JSON 配置化(可热更新)
//   - 步骤强制顺序执行
//   - 关键参数必须由 AUTHORIZED 人员录入
//   - 计算步骤自动算 Au 含量 + 5 类不确定度
// =====================================================

import { Injectable, Logger, BadRequestException, ForbiddenException } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { AuditEventType } from '../../../common/audit/audit-event.enum';
import { SecurityAuditService } from '../../../common/audit/security-audit.service';
import { canPerformTesting } from '../../../common/state-machine/machines/personnel.machine';
import { canBeUsed } from '../../../common/state-machine/machines/reference-material.machine';
import { canUseForTesting } from '../../../common/state-machine/machines/equipment.machine';

export interface SopStep {
  order: number;
  name: string;
  code: string;
  durationMin?: number;
  minTemperature?: number;
  params: Array<{
    name: string;
    type: 'NUMERIC' | 'TEXT' | 'BOOLEAN';
    unit?: string;
    required: boolean;
    min?: number;
    max?: number;
  }>;
}

export interface SopTemplate {
  code: string;
  name: string;
  standard: string;          // e.g. GB/T 9288-2023
  version: string;
  steps: SopStep[];
}

// 火试金 GB/T 9288-2023(黄金)
const FIRE_ASSAY_AU_TEMPLATE: SopTemplate = {
  code: 'FIRE-ASSAY-AU',
  name: '火试金法测定金',
  standard: 'GB/T 9288-2023',
  version: 'v1.0',
  steps: [
    {
      order: 1,
      code: 'MIXING',
      name: '配料',
      durationMin: 10,
      params: [
        { name: 'sample_mass_g', type: 'NUMERIC', unit: 'g', required: true, min: 0.1, max: 100 },
        { name: 'flux_mass_g', type: 'NUMERIC', unit: 'g', required: true, min: 10, max: 500 },
        { name: 'lead_foil_mass_g', type: 'NUMERIC', unit: 'g', required: true, min: 1, max: 50 },
        { name: 'silver_chloride_mg', type: 'NUMERIC', unit: 'mg', required: true, min: 0, max: 100 },
      ],
    },
    {
      order: 2,
      code: 'FUSING',
      name: '熔融',
      durationMin: 60,
      minTemperature: 950,
      params: [
        { name: 'furnace_temp_c', type: 'NUMERIC', unit: '°C', required: true, min: 950, max: 1100 },
        { name: 'furnace_time_min', type: 'NUMERIC', unit: 'min', required: true, min: 30, max: 120 },
      ],
    },
    {
      order: 3,
      code: 'CUPELLING',
      name: '灰吹',
      durationMin: 120,
      minTemperature: 850,
      params: [
        { name: 'cupel_temp_c', type: 'NUMERIC', unit: '°C', required: true, min: 850, max: 950 },
        { name: 'ash_time_min', type: 'NUMERIC', unit: 'min', required: true, min: 60, max: 180 },
      ],
    },
    {
      order: 4,
      code: 'PARTING',
      name: '分金',
      durationMin: 240,
      params: [
        { name: 'acid_concentration', type: 'NUMERIC', unit: 'mol/L', required: true, min: 1, max: 7 },
        { name: 'acid_temp_c', type: 'NUMERIC', unit: '°C', required: true, min: 20, max: 90 },
        { name: 'parting_time_min', type: 'NUMERIC', unit: 'min', required: true, min: 60, max: 360 },
      ],
    },
    {
      order: 5,
      code: 'ANNEALING',
      name: '退火',
      durationMin: 30,
      params: [
        { name: 'anneal_temp_c', type: 'NUMERIC', unit: '°C', required: true, min: 600, max: 800 },
        { name: 'anneal_time_min', type: 'NUMERIC', unit: 'min', required: true, min: 5, max: 60 },
      ],
    },
    {
      order: 6,
      code: 'WEIGHING',
      name: '称重',
      durationMin: 5,
      params: [
        { name: 'prill_mass_g', type: 'NUMERIC', unit: 'g', required: true, min: 0.0001, max: 1 },
        { name: 'balance_id', type: 'TEXT', required: true },
        { name: 'balance_calibration_date', type: 'TEXT', required: true },
        { name: 'room_temp_c', type: 'NUMERIC', unit: '°C', required: true, min: 15, max: 30 },
        { name: 'room_humidity_percent', type: 'NUMERIC', unit: '%', required: true, min: 30, max: 70 },
      ],
    },
    {
      order: 7,
      code: 'CALCULATION',
      name: '纯度计算 + 不确定度',
      params: [
        // 由系统自动计算
      ],
    },
  ],
};

@Injectable()
export class SopService {
  private readonly logger = new Logger(SopService.name);
  private readonly templates = new Map<string, SopTemplate>([
    [FIRE_ASSAY_AU_TEMPLATE.code, FIRE_ASSAY_AU_TEMPLATE],
  ]);

  constructor(
    private readonly prisma: PrismaService,
    private readonly securityAudit: SecurityAuditService,
  ) {}

  getTemplate(code: string): SopTemplate {
    const tpl = this.templates.get(code);
    if (!tpl) throw new BadRequestException(`SOP 模板 ${code} 不存在`);
    return tpl;
  }

  /**
   * 开始一次 SOP 执行
   */
  async startExecution(input: {
    sampleId: string;
    sopCode: string;
    batchId: string;
    operatorId: string;
  }): Promise<{ executionId: string }> {
    const tpl = this.getTemplate(input.sopCode);

    // 1. 校验人员资质
    const personnel = await this.prisma.personnel.findUnique({
      where: { userId: input.operatorId },
    });
    if (!personnel || !canPerformTesting(personnel.status as any)) {
      throw new ForbiddenException(`操作员 ${input.operatorId} 未授权(AUTHORIZED 状态)执行检测`);
    }

    // 2. 创建执行记录
    const execution = await this.prisma.sopExecution.create({
      data: {
        sampleId: input.sampleId,
        batchId: input.batchId,
        sopCode: input.sopCode,
        sopVersion: tpl.version,
        operatorId: input.operatorId,
        status: 'IN_PROGRESS',
        currentStep: 1,
        totalSteps: tpl.steps.length,
        startedAt: new Date(),
      },
    });

    await this.securityAudit.system(AuditEventType.QC_MEASUREMENT_RECORDED, {
      type: 'sop_started',
      executionId: execution.id,
      sopCode: input.sopCode,
      sampleId: input.sampleId,
      operatorId: input.operatorId,
    });

    return { executionId: execution.id };
  }

  /**
   * 提交一步执行结果
   */
  async submitStep(
    executionId: string,
    stepOrder: number,
    params: Record<string, unknown>,
    operatorId: string,
  ): Promise<{ completed: boolean; nextStep?: number }> {
    const execution = await this.prisma.sopExecution.findUnique({ where: { id: executionId } });
    if (!execution) throw new BadRequestException('执行记录不存在');
    if (execution.status !== 'IN_PROGRESS') throw new BadRequestException('执行已完成或取消');

    const tpl = this.getTemplate(execution.sopCode);
    const step = tpl.steps.find((s) => s.order === stepOrder);
    if (!step) throw new BadRequestException(`步骤 ${stepOrder} 不存在`);

    // 1. 顺序校验:必须按顺序执行
    if (stepOrder !== execution.currentStep) {
      throw new BadRequestException(
        `步骤顺序错误,当前应执行 ${execution.currentStep}(${tpl.steps.find((s) => s.order === execution.currentStep)?.name}),不能跳到 ${stepOrder}`,
      );
    }

    // 2. 参数校验
    for (const param of step.params) {
      const value = params[param.name];
      if (param.required && value === undefined) {
        throw new BadRequestException(`参数 ${param.name} 必填`);
      }
      if (param.type === 'NUMERIC' && typeof value === 'number') {
        if (param.min !== undefined && value < param.min) {
          throw new BadRequestException(`参数 ${param.name} < ${param.min}`);
        }
        if (param.max !== undefined && value > param.max) {
          throw new BadRequestException(`参数 ${param.name} > ${param.max}`);
        }
      }
    }

    // 3. 校验使用设备状态(若 params 含 balance_id)
    if (step.code === 'WEIGHING' && params.balance_id) {
      const balance = await this.prisma.equipment.findUnique({ where: { id: params.balance_id as string } });
      if (!balance || !canUseForTesting(balance.status as any)) {
        throw new ForbiddenException(`天平 ${balance?.name ?? params.balance_id} 不可用于检测(状态:${balance?.status})`);
      }
      // 校准必须在有效期内
      if (balance.nextCalibrationAt && balance.nextCalibrationAt < new Date()) {
        throw new ForbiddenException(`天平 ${balance.name} 校准已过期,不可使用`);
      }
    }

    // 4. 落库 step 数据
    await this.prisma.sopStepExecution.create({
      data: {
        sopExecutionId: executionId,
        stepOrder,
        stepCode: step.code,
        stepName: step.name,
        paramsJson: JSON.stringify(params),
        operatorId,
        completedAt: new Date(),
      },
    });

    // 5. 推进
    const nextStep = stepOrder + 1;
    const completed = nextStep > tpl.steps.length;

    await this.prisma.sopExecution.update({
      where: { id: executionId },
      data: {
        currentStep: completed ? stepOrder : nextStep,
        status: completed ? 'COMPLETED' : 'IN_PROGRESS',
        completedAt: completed ? new Date() : null,
      },
    });

    return { completed, nextStep: completed ? undefined : nextStep };
  }

  /**
   * 完成后计算 Au 含量 + 不确定度(简化版)
   * 真实实现需要根据 SOP 数据 + 标准物质证书 + 平行样统计
   */
  async finalizeAndCalculate(executionId: string): Promise<{
    auContent: number;     // %
    uncertainty: number;    // % (k=2)
    components: Record<string, number>;
  }> {
    const execution = await this.prisma.sopExecution.findUnique({
      where: { id: executionId },
      include: { stepExecutions: { orderBy: { stepOrder: 'asc' } } },
    });
    if (!execution) throw new BadRequestException('执行记录不存在');
    if (execution.status !== 'COMPLETED') throw new BadRequestException('SOP 未完成');

    // 简化:从称重步骤拿金粒质量
    const weighingStep = execution.stepExecutions.find((s) => s.stepCode === 'WEIGHING');
    if (!weighingStep) throw new BadRequestException('缺少称重步骤');

    const weighingParams = JSON.parse(weighingStep.paramsJson);
    const prillMass = weighingParams.prill_mass_g as number;

    // 从配料步骤拿样品质量
    const mixingStep = execution.stepExecutions.find((s) => s.stepCode === 'MIXING');
    const sampleMass = JSON.parse(mixingStep!.paramsJson).sample_mass_g as number;

    // 简化:假设分金完全,金粒质量 = 样品中 Au 质量
    // Au 含量 = prill_mass / sample_mass × 100%
    const auContent = (prillMass / sampleMass) * 100;

    // 5 类不确定度分量(简化估算)
    // 真实实现需要根据 GUM JCGM 100:2008 + EURACHEM/CITAC Guide
    const components = {
      u_balance: 0.0001,         // 天平分辨率 0.0001 g
      u_sample_mass: 0.001,       // 样品称量
      u_repeatability: 0.0005,    // 重复性(平行样 RSD)
      u_calibration: 0.0003,      // 校准
      u_recovery: 0.002,          // 回收率
    };

    // 合成不确定度 u_c = sqrt(Σ u_i²)
    const uc = Math.sqrt(
      Object.values(components).reduce((sum, u) => sum + u * u, 0),
    );

    // 扩展不确定度 U = k × u_c (k=2, 95% 置信)
    const uncertainty = 2 * uc;

    return {
      auContent: Math.round(auContent * 10000) / 10000,   // 4 位小数
      uncertainty: Math.round(uncertainty * 10000) / 10000,
      components: Object.fromEntries(
        Object.entries(components).map(([k, v]) => [k, Math.round(v * 100000) / 100000]),
      ),
    };
  }
}
