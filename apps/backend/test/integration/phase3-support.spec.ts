// =====================================================
// Phase 3 支撑模块集成测试 — 设备/试剂/人员/EHS
// Task 3.1-3.4 统一验证
// =====================================================

import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { installBigIntReplacer } from '../../src/common/filters/bigint-replacer';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import { EquipmentService } from '../../src/modules/equipment/equipment.service';
import { ReagentService } from '../../src/modules/reagent/reagent.service';
import { PersonnelService } from '../../src/modules/personnel/personnel.service';
import { EhsService } from '../../src/modules/ehs/ehs.service';
import request = require('supertest');

describe('Phase 3 support modules (equipment/reagent/personnel/ehs)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let equipmentSvc: EquipmentService;
  let reagentSvc: ReagentService;
  let personnelSvc: PersonnelService;
  let ehsSvc: EhsService;
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
    reagentSvc = app.get(ReagentService);
    personnelSvc = app.get(PersonnelService);
    ehsSvc = app.get(EhsService);
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

  // ===== 3.1 设备校准状态 =====
  it('equipment: calibration status CALIBRATED / EXPIRED / usable check', async () => {
    const eq = await equipmentSvc.create({
      equipmentNo: `EQ-${Date.now()}`,
      name: '测试分析天平',
      type: 'ANALYTICAL_BALANCE',
      status: 'ACTIVE',
    } as any);

    // 无校准 → 不可用
    const noCal = await equipmentSvc.getCalibrationStatus(eq.id);
    expect(noCal.status).toBe('NO_CALIBRATION');
    const usableNoCal = await equipmentSvc.isUsableForTesting(eq.id);
    expect(usableNoCal.usable).toBe(false);

    // 添加有效校准(明年到期)
    await prisma.calibration.create({
      data: {
        equipmentId: eq.id,
        calibrationDate: new Date(),
        calibrationOrg: '测试计量院',
        certificateNo: `CERT-${Date.now()}`,
        nextDueDate: new Date(Date.now() + 365 * 86400000),
      },
    });
    const ok = await equipmentSvc.getCalibrationStatus(eq.id);
    expect(ok.status).toBe('CALIBRATED');
    const usable = await equipmentSvc.isUsableForTesting(eq.id);
    expect(usable.usable).toBe(true);

    // 过期校准 → 不可用(CNAS §6.4 拦截)
    const eq2 = await equipmentSvc.create({
      equipmentNo: `EQ2-${Date.now()}`,
      name: '过期设备',
      type: 'FIRE_ASSAY_FURNACE',
      status: 'ACTIVE',
    } as any);
    await prisma.calibration.create({
      data: {
        equipmentId: eq2.id,
        calibrationDate: new Date(Date.now() - 400 * 86400000),
        calibrationOrg: '测试计量院',
        certificateNo: `CERT-OLD-${Date.now()}`,
        nextDueDate: new Date(Date.now() - 30 * 86400000), // 已过期 30 天
      },
    });
    const exp = await equipmentSvc.getCalibrationStatus(eq2.id);
    expect(exp.status).toBe('EXPIRED');
    const usableExp = await equipmentSvc.isUsableForTesting(eq2.id);
    expect(usableExp.usable).toBe(false);

    // 清理
    await prisma.$executeRawUnsafe(`DELETE FROM calibrations WHERE equipment_id IN ('${eq.id}', '${eq2.id}')`).catch(() => {});
    await prisma.$executeRawUnsafe(`DELETE FROM equipment WHERE id IN ('${eq.id}', '${eq2.id}')`).catch(() => {});
  });

  // ===== 3.2 试剂库存/效期 =====
  it('reagent: lot stock, usage deduction, expiry alerts', async () => {
    const re = await reagentSvc.create({
      code: `RE-${Date.now()}`,
      name: '测试硝酸',
      type: 'NITRIC_ACID',
      unit: 'mL',
    } as any);

    // 入库 100mL,过期 30 天后
    const lot = await reagentSvc.addLot(re.id, {
      lotNo: `LOT-${Date.now()}`,
      receivedDate: new Date(),
      expiryDate: new Date(Date.now() + 15 * 86400000),
      quantity: '100.000000',
    } as any);
    expect(parseFloat(lot.remainingQty.toString())).toBeCloseTo(100, 6);

    // 出库 20mL
    const usage = await reagentSvc.recordUsage(lot.id, {
      quantity: '20.000000',
      operatorId: '00000000-0000-0000-0000-000000000001',
    } as any);
    expect(usage).toBeTruthy();

    const after = await prisma.reagentLot.findUnique({ where: { id: lot.id } });
    expect(parseFloat(after!.remainingQty.toString())).toBeCloseTo(80, 6);

    // 效期预警(30 天内到期应出现)
    const alerts = await reagentSvc.getAlerts() as any;
    const alertRows = Array.isArray(alerts) ? alerts : alerts?.data ?? [];
    expect(alertRows.some((a: any) => a.lotId === lot.id)).toBe(true);

    // 清理
    await prisma.$executeRawUnsafe(`DELETE FROM reagent_usages WHERE reagent_lot_id = '${lot.id}'`).catch(() => {});
    await prisma.$executeRawUnsafe(`DELETE FROM reagent_lots WHERE id = '${lot.id}'`).catch(() => {});
    await prisma.$executeRawUnsafe(`DELETE FROM reagents WHERE id = '${re.id}'`).catch(() => {});
  });

  // ===== 3.3 人员能力授权 =====
  it('personnel: competency matrix + authorization', async () => {
    // 创建独立测试 user(admin 已关联 personnel,user_id 唯一)
    const testUser = await prisma.user.create({
      data: {
        username: `p3_user_${Date.now()}`,
        email: `p3_${Date.now()}@test.local`,
        passwordHash: 'x',
        name: 'P3 测试用户',
        role: 'ANALYST',
        status: 'ACTIVE',
      } as any,
    });
    // 创建人员
    const p = await personnelSvc.createPersonnel({
      employeeNo: `EMP-${Date.now()}`,
      name: '测试检测员',
      userId: testUser.id,
    } as any);

    // 授权火试金方法
    const comp = await personnelSvc.addCompetency(p.id, {
      method: 'FIRE_ASSAY',
      level: 'SENIOR',
      certifiedAt: new Date(),
      expiresAt: new Date(Date.now() + 365 * 86400000),
    } as any);
    expect(comp.level).toBe('SENIOR');

    // 能力矩阵
    const matrix = await personnelSvc.getCompetencyMatrix();
    expect(matrix).toBeTruthy();

    // 清理
    await prisma.$executeRawUnsafe(`DELETE FROM competencies WHERE id = '${comp.id}'`).catch(() => {});
    await prisma.$executeRawUnsafe(`DELETE FROM personnel WHERE id = '${p.id}'`).catch(() => {});
    await prisma.$executeRawUnsafe(`DELETE FROM users WHERE id = '${testUser.id}'`).catch(() => {});
  });

  // ===== 3.4 EHS 隐患流程 =====
  it('ehs: hazard create → resolve lifecycle', async () => {
    const h = await ehsSvc.createHazard({
      source: '炉体高温区',
      description: '隔热层破损(测试)',
      severity: 'HIGH',
      reportedById: '00000000-0000-0000-0000-000000000001',
    } as any);
    expect(h.status).toBe('REPORTED');

    const resolved = await ehsSvc.resolveHazard(h.id, '00000000-0000-0000-0000-000000000001', '已更换隔热层(测试)');
    expect(resolved.status).toBe('RESOLVED');

    const list = await ehsSvc.findHazards({});
    expect(list.data.length).toBeGreaterThan(0);

    // 清理
    await prisma.$executeRawUnsafe(`DELETE FROM hazards WHERE id = '${h.id}'`).catch(() => {});
  });

  // ===== 3.1 API 端点可用 =====
  it('API: equipment/reagent/personnel/ehs endpoints reachable', async () => {
    const eqRes = await request(app.getHttpServer())
      .get('/equipment')
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 201]).toContain(eqRes.status);

    const reRes = await request(app.getHttpServer())
      .get('/reagents')
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 201]).toContain(reRes.status);

    const pRes = await request(app.getHttpServer())
      .get('/personnel')
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 201]).toContain(pRes.status);

    const ehsRes = await request(app.getHttpServer())
      .get('/ehs/hazards')
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 201]).toContain(ehsRes.status);
  });
});
