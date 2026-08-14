// =====================================================
// Phase 2/3 功能填充测试 (F1-F5)
// F1 火试金多步骤(顺序守卫)
// F2 报告签发自动生成 PDF(SHA256 绑定)
// F3 设备三查状态(校准/维护/期间核查)
// F4 培训/能力授权(hasValidCompetency)
// F5 试剂低库存预警
// =====================================================

import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { installBigIntReplacer } from '../../src/common/filters/bigint-replacer';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import { EquipmentService } from '../../src/modules/equipment/equipment.service';
import { PersonnelService } from '../../src/modules/personnel/personnel.service';
import { ReagentService } from '../../src/modules/reagent/reagent.service';
import { getFireAssayStepStatus, validateStepOrder, isAllStepsDone } from '../../src/modules/test/fire-assay-steps';
import request = require('supertest');

describe('Phase 2/3 feature fills (F1-F5)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let equipmentSvc: EquipmentService;
  let personnelSvc: PersonnelService;
  let reagentSvc: ReagentService;
  let adminToken: string;

  beforeAll(async () => {
    installBigIntReplacer();
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
    prisma = app.get(PrismaService);
    equipmentSvc = app.get(EquipmentService);
    personnelSvc = app.get(PersonnelService);
    reagentSvc = app.get(ReagentService);
    const jwt = require('jsonwebtoken');
    const secret = process.env.JWT_SECRET || 'a-strong-dev-secret-32-characters-long!!';
    adminToken = jwt.sign(
      { sub: '00000000-0000-0000-0000-000000000001', username: 'admin', role: 'ADMIN' },
      secret,
      { expiresIn: '15m' },
    );
  });

  afterAll(async () => {
    await app.close();
  });

  // ===== F1 火试金步骤 =====
  it('F1: step status derivation + order guard', () => {
    // 只完成称样
    const partial = {
      sampleWeightG: '1.0000',
      furnaceTempC: null,
      cupellationMin: null,
      partingMin: null,
      annealingMin: null,
      prillWeightG: null,
    } as any;
    const st = getFireAssayStepStatus(partial);
    expect(st.filter((s) => s.done).map((s) => s.step)).toEqual(['WEIGHING']);
    expect(isAllStepsDone(partial)).toBe(false);

    // 称重(最终步骤)前缺 4 步 → 拒绝
    const order = validateStepOrder('FINAL_WEIGHING', partial);
    expect(order.ok).toBe(false);
    expect(order.missingSteps).toContain('MELTING');
    expect(order.missingSteps).toContain('CUPELLATION');

    // 完成全部前序 → 允许称重
    const full = {
      sampleWeightG: '1.0000',
      furnaceTempC: 1050,
      cupellationMin: 45,
      partingMin: 30,
      annealingMin: 30,
      prillWeightG: null,
    } as any;
    const ok = validateStepOrder('FINAL_WEIGHING', full);
    expect(ok.ok).toBe(true);
  });

  it('F1: API recordWeights blocked until process steps done', async () => {
    // 创建样品 + test(仅称样,无工艺参数)
    const s = await request(app.getHttpServer())
      .post('/samples')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ customerName: 'F1 Test', sampleType: 'GOLD_INGOT', weightG: '1.0000' });
    const sampleId = s.body.id;
    const t = await prisma.test.create({
      data: {
        sampleId,
        method: 'FIRE_ASSAY',
        operatorId: '00000000-0000-0000-0000-000000000001',
        status: 'IN_PROGRESS',
        fireAssay: { create: { sampleWeightG: '1.0000' } },
      } as any,
    });

    // 直接称重 → 400(缺熔融/灰吹/分金/退火)
    const w = await request(app.getHttpServer())
      .post(`/tests/fire-assay/${t.id}/weights`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ prillWeightG: '0.9988', leadButtonWeightG: '3.0' });
    expect(w.status).toBe(400);
    expect(w.body.message).toContain('步骤未完成');

    // 补齐工艺参数 → 称重成功
    await request(app.getHttpServer())
      .post(`/tests/fire-assay/${t.id}/process`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ furnaceTempC: 1050, cupellationMin: 45, partingMin: 30, annealingMin: 30, partingAcid: '1:2' });
    const w2 = await request(app.getHttpServer())
      .post(`/tests/fire-assay/${t.id}/weights`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ prillWeightG: '0.9988', leadButtonWeightG: '3.0', qcRecoveryPct: '100.0' });
    expect([200, 201]).toContain(w2.status);

    // 清理
    await prisma.$executeRawUnsafe(`DELETE FROM fire_assay_details WHERE test_id = '${t.id}'`).catch(() => {});
    await prisma.$executeRawUnsafe(`DELETE FROM tests WHERE id = '${t.id}'`).catch(() => {});
    await prisma.$executeRawUnsafe(`DELETE FROM samples WHERE id = '${sampleId}'`).catch(() => {});
  });

  // ===== F3 设备三查 =====
  it('F3: equipment health status (calibration/maintenance/periodic-check)', async () => {
    const eq = await equipmentSvc.create({
      equipmentNo: `EQH-${Date.now()}`,
      name: '三查测试设备',
      type: 'ANALYTICAL_BALANCE',
      status: 'ACTIVE',
    } as any);

    // 无任何记录 → ATTENTION
    const empty = await equipmentSvc.getEquipmentHealthStatus(eq.id);
    expect(empty.overall).toBe('ATTENTION');
    expect(empty.calibration.status).toBe('NO_CALIBRATION');

    // 补齐三项 → HEALTHY
    await prisma.calibration.create({
      data: {
        equipmentId: eq.id,
        calibrationDate: new Date(),
        calibrationOrg: '测试院',
        certificateNo: `C-${Date.now()}`,
        nextDueDate: new Date(Date.now() + 365 * 86400000),
      },
    });
    await prisma.maintenance.create({
      data: {
        equipmentId: eq.id,
        maintenanceType: 'CALIBRATION',
        maintenanceDate: new Date(),
        performedBy: '00000000-0000-0000-0000-000000000001',
        nextDueDate: new Date(Date.now() + 180 * 86400000),
      },
    });
    await prisma.periodicCheck.create({
      data: {
        equipmentId: eq.id,
        checkDate: new Date(),
        performedBy: '00000000-0000-0000-0000-000000000001',
        passed: true,
      },
    });
    const healthy = await equipmentSvc.getEquipmentHealthStatus(eq.id);
    expect(healthy.overall).toBe('HEALTHY');

    // 清理
    await prisma.$executeRawUnsafe(`DELETE FROM periodic_checks WHERE equipment_id = '${eq.id}'`).catch(() => {});
    await prisma.$executeRawUnsafe(`DELETE FROM maintenances WHERE equipment_id = '${eq.id}'`).catch(() => {});
    await prisma.$executeRawUnsafe(`DELETE FROM calibrations WHERE equipment_id = '${eq.id}'`).catch(() => {});
    await prisma.$executeRawUnsafe(`DELETE FROM equipment WHERE id = '${eq.id}'`).catch(() => {});
  });

  // ===== F4 能力授权 =====
  it('F4: competency authorization (level/expiry checks)', async () => {
    const testUser = await prisma.user.create({
      data: {
        username: `f4_${Date.now()}`,
        email: `f4_${Date.now()}@t.local`,
        passwordHash: 'x',
        name: 'F4 User',
        role: 'ANALYST',
        status: 'ACTIVE',
      } as any,
    });
    const p = await personnelSvc.createPersonnel({
      employeeNo: `F4E-${Date.now()}`,
      name: 'F4 检测员',
      userId: testUser.id,
    } as any);

    // 无授权
    const noAuth = await personnelSvc.hasValidCompetency(p.id, 'FIRE_ASSAY');
    expect(noAuth.authorized).toBe(false);

    // TRAINEE 等级 → 拒绝
    await personnelSvc.addCompetency(p.id, {
      method: 'FIRE_ASSAY',
      level: 'TRAINEE',
      certifiedAt: new Date(),
      expiresAt: new Date(Date.now() + 365 * 86400000),
    } as any);
    const trainee = await personnelSvc.hasValidCompetency(p.id, 'FIRE_ASSAY');
    expect(trainee.authorized).toBe(false);

    // 升级 SENIOR → 通过
    await prisma.competency.update({
      where: { personnelId_method: { personnelId: p.id, method: 'FIRE_ASSAY' } },
      data: { level: 'SENIOR' },
    });
    const senior = await personnelSvc.hasValidCompetency(p.id, 'FIRE_ASSAY');
    expect(senior.authorized).toBe(true);

    // 过期 → 拒绝
    await prisma.competency.update({
      where: { personnelId_method: { personnelId: p.id, method: 'FIRE_ASSAY' } },
      data: { expiresAt: new Date(Date.now() - 86400000) },
    });
    const expired = await personnelSvc.hasValidCompetency(p.id, 'FIRE_ASSAY');
    expect(expired.authorized).toBe(false);

    // 培训概览
    await personnelSvc.addTraining(p.id, {
      trainingType: 'METHOD',
      trainingName: '火试金法培训',
      trainingDate: new Date(),
      result: 'PASS',
    } as any);
    const overview = await personnelSvc.getTrainingOverview(p.id);
    expect(overview.count).toBeGreaterThanOrEqual(1);

    // 清理
    await prisma.$executeRawUnsafe(`DELETE FROM trainings WHERE personnel_id = '${p.id}'`).catch(() => {});
    await prisma.$executeRawUnsafe(`DELETE FROM competencies WHERE personnel_id = '${p.id}'`).catch(() => {});
    await prisma.$executeRawUnsafe(`DELETE FROM personnel WHERE id = '${p.id}'`).catch(() => {});
    await prisma.$executeRawUnsafe(`DELETE FROM users WHERE id = '${testUser.id}'`).catch(() => {});
  });

  // ===== F5 低库存预警 =====
  it('F5: low stock alert (remaining <= safetyStock)', async () => {
    // 低库存试剂(safetyStock 10,剩余 5)
    const re = await reagentSvc.create({
      code: `F5-${Date.now()}`,
      name: '低库存试剂',
      type: 'NITRIC_ACID',
      unit: 'mL',
      safetyStock: '10.000000',
    } as any);
    await reagentSvc.addLot(re.id, {
      lotNo: `F5L-${Date.now()}`,
      receivedDate: new Date(),
      expiryDate: new Date(Date.now() + 300 * 86400000),
      quantity: '5.000000',
    } as any);

    const alerts = await reagentSvc.getLowStockAlerts();
    expect(alerts.some((a: any) => a.reagentId === re.id && a.low)).toBe(true);

    // 清理
    await prisma.$executeRawUnsafe(`DELETE FROM reagent_lots WHERE reagent_id = '${re.id}'`).catch(() => {});
    await prisma.$executeRawUnsafe(`DELETE FROM reagents WHERE id = '${re.id}'`).catch(() => {});
  });
});
