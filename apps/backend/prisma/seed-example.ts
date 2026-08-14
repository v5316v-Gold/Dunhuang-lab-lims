// =====================================================
// Phase 3 数据填充 - standalone seed(不依赖 src/ 内部模块)
// 改用 PrismaClient 直接 + ts-node --transpile-only 即可运行
// =====================================================

import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();
const SEED_PASSWORD = 'Analyst@Pass123';

/** 本地时区 YYYY-MM-DD */
function localDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 原子行锁获取+更新 sample_no_sequences */
async function nextSampleSeq(dateKey: string): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<Array<{ last_seq: number }>>(
    `INSERT INTO sample_no_sequences (date_key, last_seq) VALUES ($1, 1)
     ON CONFLICT (date_key) DO UPDATE SET last_seq = sample_no_sequences.last_seq + 1
     RETURNING last_seq`,
    dateKey,
  );
  return rows[0]?.last_seq ?? 1;
}

async function generateSampleNo(): Promise<string> {
  const dateKey = localDateKey();
  const seq = await nextSampleSeq(dateKey);
  const yymmdd = dateKey.slice(2).replace(/-/g, '');
  return `${yymmdd}-${String(seq).padStart(4, '0')}`;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}
function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

async function main() {
  console.log('[seed] start Phase 3 example data');
  const passwordHash = await argon2.hash(SEED_PASSWORD);

  // 1. 用户
  console.log('[seed] users + personnel...');
  const analystUser = await prisma.user.upsert({
    where: { username: 'zhang.san' }, update: {},
    create: { username: 'zhang.san', email: 'zhang.san@dunhuang-gold.cn', passwordHash, name: '张三', role: 'ANALYST', status: 'ACTIVE' },
  });
  const seniorUser = await prisma.user.upsert({
    where: { username: 'li.si' }, update: {},
    create: { username: 'li.si', email: 'li.si@dunhuang-gold.cn', passwordHash, name: '李四', role: 'SENIOR_ANALYST', status: 'ACTIVE' },
  });
  const qmUser = await prisma.user.upsert({
    where: { username: 'wang.wu' }, update: {},
    create: { username: 'wang.wu', email: 'wang.wu@dunhuang-gold.cn', passwordHash, name: '王五', role: 'QUALITY_MANAGER', status: 'ACTIVE' },
  });

  // 2. 人员档案
  const personnelData = [
    { employeeNo: 'EMP-0001', userId: analystUser.id, name: '张三(分析员)', position: 'ANALYST' as const },
    { employeeNo: 'EMP-0002', userId: seniorUser.id, name: '李四(高级分析员)', position: 'SENIOR_ANALYST' as const },
    { employeeNo: 'EMP-0003', userId: qmUser.id, name: '王五(质量经理)', position: 'QUALITY_MANAGER' as const },
  ];
  for (const p of personnelData) {
    await prisma.personnel.upsert({
      where: { employeeNo: p.employeeNo }, update: { userId: p.userId },
      create: {
        employeeNo: p.employeeNo, userId: p.userId, name: p.name, position: p.position,
        phone: '13800138000', email: 'demo@dunhuang.cn', status: 'ACTIVE',
      } as any,
    });
  }
  const senior = await prisma.personnel.findUnique({ where: { employeeNo: 'EMP-0002' } });
  if (senior) {
    await prisma.competency.upsert({
      where: { personnelId_method: { personnelId: senior.id, method: 'FIRE_ASSAY' } },
      update: {},
      create: { personnelId: senior.id, method: 'FIRE_ASSAY', level: 'SENIOR', certifiedAt: new Date(), expiresAt: daysFromNow(365) },
    });
  }

  // 3. 设备
  console.log('[seed] equipment...');
  const equipmentData = [
    { equipmentNo: 'EQ-FA-001', name: '试金炉 #1', type: 'FIRE_ASSAY_FURNACE', model: 'Nabertherm L 9/11', location: '火试金实验室' },
    { equipmentNo: 'EQ-BAL-001', name: '分析天平', type: 'ANALYTICAL_BALANCE', model: 'Mettler-Toledo XPR', location: '称量室' },
    { equipmentNo: 'EQ-ICP-001', name: 'ICP-OES', type: 'ICP_OES', model: 'Agilent 5110', location: '元素分析实验室' },
    { equipmentNo: 'EQ-WP-001', name: '超纯水机', type: 'WATER_PURIFIER', model: 'Milli-Q IQ 7000', location: '试剂配制室' },
  ];
  for (const eq of equipmentData) {
    await prisma.equipment.upsert({ where: { equipmentNo: eq.equipmentNo }, update: {}, create: eq as any });
  }
  const balance = await prisma.equipment.findUnique({ where: { equipmentNo: 'EQ-BAL-001' } });
  if (balance) {
    await prisma.calibration.create({
      data: {
        equipmentId: balance.id, calibrationDate: new Date(),
        calibrationOrg: '上海市计量测试研究院', certificateNo: `CERT-${Date.now()}`,
        nextDueDate: daysFromNow(365),
      },
    });
  }

  // 4. 试剂
  console.log('[seed] reagents + lots...');
  const reagentData = [
    { code: 'RE-NIT-001', name: '硝酸(分析纯)', type: 'NITRIC_ACID', casNo: '7697-37-2', unit: 'mL', packageSize: '500.000000', safetyStock: '1000.000000', hazardClass: '腐蚀品' },
    { code: 'RE-HCL-001', name: '盐酸(分析纯)', type: 'HYDROCHLORIC_ACID', casNo: '7647-01-0', unit: 'mL', packageSize: '500.000000', safetyStock: '1000.000000' },
    { code: 'RE-AQU-001', name: '王水(现配)', type: 'AQUA_REGIA', unit: 'mL', packageSize: '1000.000000', safetyStock: '500.000000' },
    { code: 'RE-LEAD-001', name: '纯铅箔(99.99%)', type: 'LEAD_BUTTON', unit: 'g', packageSize: '500.000000', safetyStock: '200.000000' },
    { code: 'RE-SIL-001', name: '纯银丝(99.99%)', type: 'OTHER', unit: 'g', packageSize: '50.000000', safetyStock: '100.000000' },
    { code: 'RE-AU-001', name: '金标准物质 GBW02757', type: 'GOLD_STANDARD', casNo: '7440-57-5', unit: 'g', packageSize: '10.000000', safetyStock: '5.000000' },
  ];
  for (const r of reagentData) {
    const re = await prisma.reagent.upsert({ where: { code: r.code }, update: {}, create: r as any });
    const lotNo = `${r.code.replace('RE-', '')}-${Date.now()}`;
    await prisma.reagentLot.upsert({
      where: { reagentId_lotNo: { reagentId: re.id, lotNo } },
      update: {},
      create: { reagentId: re.id, lotNo, receivedDate: daysAgo(30),
        expiryDate: daysFromNow(335), quantity: r.packageSize, remainingQty: r.packageSize,
        supplier: '国药集团化学试剂有限公司' },
    });
  }

  // 5. 样品
  console.log('[seed] samples...');
  const sampleData = [
    { customer: '上海黄金交易所', purity: '99.98', status: 'ARCHIVED' },
    { customer: '紫金矿业集团', purity: '99.92', status: 'TESTED' },
    { customer: '周大福珠宝', purity: '99.85', status: 'BATCHED' },
  ];
  const createdSamples: Array<{ id: string; no: string; status: string; purity: string }> = [];
  for (const s of sampleData) {
    const sampleNo = await generateSampleNo();
    const sample = await prisma.sample.upsert({
      where: { sampleNo }, update: {},
      create: { sampleNo, customerName: s.customer, customerRef: `CUST-${sampleNo}`,
        sampleType: 'GOLD_INGOT', weightG: new (prisma as any).$extends ? '1.0230' as any : ('1.0230' as any),
        status: s.status as any,
        receivedById: analystUser.id, receivedAt: daysAgo(7), remarks: `Phase 3 示例 ${sampleNo}` } as any,
    });
    createdSamples.push({ id: sample.id, no: sampleNo, status: sample.status, purity: s.purity });
  }

  // 6. 批次
  console.log('[seed] batches...');
  const batch1 = await prisma.sampleBatch.upsert({
    where: { batchNo: 'BATCH-FA-001' }, update: {},
    create: { batchNo: 'BATCH-FA-001', method: 'FIRE_ASSAY', operatorId: seniorUser.id, replicateCount: 3,
      furnaceNo: 'F1', status: 'CALCULATING' },
  });
  await prisma.sample.update({ where: { id: createdSamples[0].id }, data: { batchId: batch1.id, status: 'TESTED' } });
  await prisma.sample.update({ where: { id: createdSamples[1].id }, data: { batchId: batch1.id, status: 'TESTED' } });
  const batch2 = await prisma.sampleBatch.upsert({
    where: { batchNo: 'BATCH-FA-002' }, update: {},
    create: { batchNo: 'BATCH-FA-002', method: 'FIRE_ASSAY', operatorId: seniorUser.id, replicateCount: 3,
      furnaceNo: 'F1', status: 'PENDING' },
  });
  await prisma.sample.update({ where: { id: createdSamples[2].id }, data: { batchId: batch2.id, status: 'BATCHED' } });

  // 7. 检测
  console.log('[seed] tests + fire-assay details...');
  for (let i = 0; i < 2; i++) {
    const s = createdSamples[i];
    const existing = await prisma.test.findFirst({ where: { sampleId: s.id, method: 'FIRE_ASSAY' } });
    if (existing) continue;
    const t = await prisma.test.create({
      data: {
        sampleId: s.id, batchId: batch1.id, method: 'FIRE_ASSAY', operatorId: seniorUser.id,
        status: 'COMPLETED', startedAt: daysAgo(3), completedAt: daysAgo(2),
        purityPct: new (prisma as any).$extends ? s.purity as any : (s.purity as any),
        uncertainty: '0.0200' as any, qcPassed: true,
        fireAssay: { create: { sampleWeightG: '1.0000' as any } },
      } as any,
    });
    const purity = parseFloat(s.purity);
    const sampleWeight = 1.0230;
    const qcRecovery = 100.0;
    const prill = (sampleWeight * purity / 100 * 100) / qcRecovery;
    await (prisma as any).fireAssayDetail.update({
      where: { testId: t.id },
      data: { prillWeightG: prill.toFixed(4) as any },
    });
  }

  // 8. QC
  console.log('[seed] QC measurements...');
  const tests = await prisma.test.findMany({ where: { method: 'FIRE_ASSAY' } });
  for (const t of tests) {
    const existing = await (prisma as any).qcMeasurement.findFirst({ where: { testId: t.id } });
    if (existing) continue;
    await (prisma as any).qcMeasurement.create({
      data: { testId: t.id, qcType: 'PARALLEL', element: 'Au', measured: '99.95' as any, expected: '99.98' as any, sd: '0.05' as any },
    });
  }

  // 9. 报告
  console.log('[seed] report...');
  const s1 = createdSamples[0];
  const reportNo = `RPT-${s1.no}`;
  let report = await (prisma as any).report.findUnique({ where: { reportNo } });
  if (!report) {
    report = await (prisma as any).report.create({
      data: { reportNo, sampleId: s1.id, status: 'ISSUED',
        pdfSha256: 'a'.repeat(64),
        summary: `样品编号: ${s1.no}
客户名称: 上海黄金交易所
样品类型: 金锭
接收重量: 1.0230 g
纯度结果: 99.98%`,
        createdById: seniorUser.id, issuedAt: daysAgo(1) },
    });
    await (prisma as any).reportStage.createMany({
      data: [
        { reportId: report.id, stage: 'DRAFT', userId: seniorUser.id, comments: '报告创建' },
        { reportId: report.id, stage: 'INTERNAL_REVIEW', userId: seniorUser.id, comments: '提交校核' },
        { reportId: report.id, stage: 'FINAL_REVIEW', userId: seniorUser.id, comments: '校核通过' },
        { reportId: report.id, stage: 'APPROVED', userId: qmUser.id, comments: '审核批准' },
        { reportId: report.id, stage: 'ISSUED', userId: qmUser.id, comments: '签发' },
      ] as any,
    });
  }

  // 10. 设备维护 + 期间核查
  console.log('[seed] maintenance + periodic check...');
  const furnace = await prisma.equipment.findUnique({ where: { equipmentNo: 'EQ-FA-001' } });
  if (furnace) {
    await (prisma as any).maintenance.upsert({
      where: { id: '00000000-0000-0000-0000-000000000001' },
      update: {},
      create: { id: '00000000-0000-0000-0000-000000000001', equipmentId: furnace.id,
        maintenanceType: 'PREVENTIVE', maintenanceDate: daysAgo(20),
        performedBy: seniorUser.id, content: '更换加热元件,清理炉膛',
        nextDueDate: daysFromNow(160) },
    });
    await prisma.periodicCheck.create({
      data: { equipmentId: furnace.id, checkDate: daysAgo(7),
        performedBy: seniorUser.id, passed: true, zScore: '0.42' as any,
        remarks: '温度校准 Z-score 0.42(<2 阈值),无异常' },
    });
  }

  console.log('[seed] done.');
}

main()
  .catch((e) => { console.error('[seed] FAILED:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
