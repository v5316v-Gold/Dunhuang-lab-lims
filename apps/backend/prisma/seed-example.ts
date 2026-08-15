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
  { employeeNo: 'EMP-0001', userId: analystUser.id, name: '张三(分析员)' },
  { employeeNo: 'EMP-0002', userId: seniorUser.id, name: '李四(高级分析员)' },
  { employeeNo: 'EMP-0003', userId: qmUser.id, name: '王五(质量经理)' },
];
for (const p of personnelData) {
  await prisma.personnel.upsert({
    where: { employeeNo: p.employeeNo }, update: { userId: p.userId },
    create: {
      employeeNo: p.employeeNo, userId: p.userId, name: p.name,
      title: p.employeeNo === 'EMP-0003' ? '高级工程师' : '助理工程师',
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
        sampleType: 'GOLD_INGOT', weightG: '1.0230' as any,
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
        purityPct: s.purity as any,
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
      data: { testId: t.id, qcType: 'PARALLEL', element: 'Au', measured: '99.95' as any, expected: '99.98' as any, sd: '0.05' as any, passed: true },
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

  // 9.5 W1 危废管理种子数据(CNAS §7.10 不符合工作)
console.log('[seed] W1 waste records...');
const wasteSeeds = [
  { code: 'WT-20260815-0001', type: 'WASTE_LIQUID', hazardClass: 'HW34', hazardDesc: '王水废液', sourceType: 'TEST', weightKg: '5.5000', volumeL: '5.0000', containerCount: 2, containerType: '25L 塑料桶', storageLocation: '危废暂存间 A-01', status: 'STORED' },
  { code: 'WT-20260815-0002', type: 'WASTE_GOLD_BEARING', hazardClass: 'HW29', hazardDesc: '含黄金滤纸+坩埚残渣', sourceType: 'TEST', weightKg: '0.8500', containerCount: 1, containerType: '5L 玻璃瓶', storageLocation: '危废暂存间 A-02', status: 'STORED' },
  { code: 'WT-20260815-0003', type: 'WASTE_SOLID', hazardClass: 'HW35', hazardDesc: '含银铅扣废渣', sourceType: 'TEST', weightKg: '1.2500', containerCount: 1, containerType: '10L 铁桶', storageLocation: '危废暂存间 A-03', status: 'TRANSFERRED' },
  { code: 'WT-20260815-0004', type: 'WASTE_REAGENT', hazardClass: 'HW29', hazardDesc: '失效碘化钾溶液', sourceType: 'TEST', weightKg: '0.5000', volumeL: '0.5000', containerCount: 1, containerType: '1L 棕色瓶', storageLocation: '危废暂存间 B-01', status: 'INCINERATED' },
];
for (const w of wasteSeeds) {
  await prisma.wasteRecord.upsert({
    where: { code: w.code }, update: {},
    create: {
      code: w.code,
      type: w.type as any,
      hazardClass: w.hazardClass as any,
      hazardDesc: w.hazardDesc,
      sourceType: w.sourceType,
      weightKg: w.weightKg as any,
      volumeL: w.volumeL as any,
      containerCount: w.containerCount,
      containerType: w.containerType,
      storageLocation: w.storageLocation,
      hazardManagerId: qmUser.id,
      generatedAt: daysAgo(5),
      status: w.status as any,
      remarks: 'Phase W1 seed',
      receiverName: w.status === 'TRANSFERRED' || w.status === 'INCINERATED' ? '甘肃金亿环保科技有限公司' : null,
      receiverLicenceNo: w.status === 'TRANSFERRED' || w.status === 'INCINERATED' ? 'GS-HW-2024-0815' : null,
      transferManifestNo: w.status === 'TRANSFERRED' || w.status === 'INCINERATED' ? `MAN-${w.code}` : null,
      transferredAt: w.status === 'TRANSFERRED' || w.status === 'INCINERATED' ? daysAgo(2) : null,
      disposalAt: w.status === 'INCINERATED' ? daysAgo(1) : null,
      disposalMethod: w.status === 'INCINERATED' ? '高温焚烧(>1200°C)' : null,
    } as any,
  });
}

// 9.6 W2 气体管理种子数据(CNAS §7.5 + §6.4)
console.log('[seed] W2 gases + purchases + usages...');
const gasSeeds = [
  { code: 'GAS-202608-0001', name: '高纯氩气 Ar 99.999%', type: 'ARGON', purity: '99.999%', unit: 'CYLINDER', currentStock: '18.0000', minStock: '5.0000', maxStock: '40.0000', storageLocation: '气瓶间 A-01', hazardLevel: '惰性' },
  { code: 'GAS-202608-0002', name: '高纯氮气 N2 99.999%', type: 'NITROGEN', purity: '99.999%', unit: 'CYLINDER', currentStock: '25.0000', minStock: '8.0000', maxStock: '50.0000', storageLocation: '气瓶间 A-02', hazardLevel: '惰性' },
  { code: 'GAS-202608-0003', name: '高纯氢气 H2 99.999%', type: 'HYDROGEN', purity: '99.999%', unit: 'CYLINDER', currentStock: '4.0000', minStock: '5.0000', maxStock: '20.0000', storageLocation: '气瓶间 B-01', hazardLevel: '易燃' },
  { code: 'GAS-202608-0004', name: '高纯氦气 He 99.999%', type: 'HELIUM', purity: '99.999%', unit: 'CYLINDER', currentStock: '12.0000', minStock: '3.0000', maxStock: '25.0000', storageLocation: '气瓶间 A-03', hazardLevel: '惰性' },
];
const gasIds: Record<string, string> = {};
for (const g of gasSeeds) {
  const r = await prisma.gas.upsert({
    where: { code: g.code }, update: { currentStock: g.currentStock as any },
    create: {
      code: g.code, name: g.name, type: g.type as any, purity: g.purity,
      unit: g.unit as any, currentStock: g.currentStock as any,
      minStock: g.minStock as any, maxStock: g.maxStock as any,
      storageLocation: g.storageLocation, hazardLevel: g.hazardLevel,
      responsibleUserId: qmUser.id, status: 'ACTIVE',
      remarks: 'Phase W2 seed',
    } as any,
  });
  gasIds[g.code] = r.id;
}

// 气体采购:已验收 + 待验收
const purchaseSeeds = [
  { purchaseNo: 'PO-20260815-0001', gasCode: 'GAS-202608-0001', supplier: '液化空气(中国)投资有限公司', quantity: '20.0000', unitPrice: '380.00', status: 'INSPECTED' as const, inspectedBy: qmUser.id, batchNo: 'LA-AR-20260815-A' },
  { purchaseNo: 'PO-20260815-0002', gasCode: 'GAS-202608-0002', supplier: '林德(中国)投资有限公司', quantity: '30.0000', unitPrice: '120.00', status: 'INSPECTED' as const, inspectedBy: qmUser.id, batchNo: 'LIN-N2-20260815-A' },
  { purchaseNo: 'PO-20260815-0003', gasCode: 'GAS-202608-0003', supplier: '液化空气(中国)投资有限公司', quantity: '10.0000', unitPrice: '1200.00', status: 'ORDERED' as const, batchNo: 'LA-H2-20260820-B' },
];
for (const p of purchaseSeeds) {
  await prisma.gasPurchase.upsert({
    where: { purchaseNo: p.purchaseNo }, update: {},
    create: {
      purchaseNo: p.purchaseNo,
      gasId: gasIds[p.gasCode],
      supplier: p.supplier,
      quantity: p.quantity as any,
      unit: 'CYLINDER' as any,
      unitPrice: p.unitPrice as any,
      totalAmount: (parseFloat(p.quantity) * parseFloat(p.unitPrice)).toFixed(2) as any,
      orderDate: daysAgo(3),
      expectedDate: daysFromNow(2),
      receivedDate: p.status === 'INSPECTED' ? daysAgo(1) : null,
      inspectedById: p.status === 'INSPECTED' ? p.inspectedBy : null,
      status: p.status as any,
      batchNo: p.batchNo,
      remarks: 'Phase W2 seed',
    } as any,
  });
}

// 气体使用记录:最近 7 天,几条
const usageSeeds = [
  { usageNo: 'USAGE-20260815-0001', gasCode: 'GAS-202608-0001', quantity: '2.0000', usedBy: seniorUser.id, purpose: 'ICP-OES 载气', daysAgo: 1 },
  { usageNo: 'USAGE-20260815-0002', gasCode: 'GAS-202608-0002', quantity: '1.0000', usedBy: seniorUser.id, purpose: '吹扫保护气', daysAgo: 2 },
  { usageNo: 'USAGE-20260815-0003', gasCode: 'GAS-202608-0001', quantity: '1.5000', usedBy: analystUser.id, purpose: 'ICP-OES 载气', daysAgo: 3 },
  { usageNo: 'USAGE-20260815-0004', gasCode: 'GAS-202608-0004', quantity: '0.5000', usedBy: analystUser.id, purpose: '气相色谱载气', daysAgo: 4 },
];
for (const u of usageSeeds) {
  await prisma.gasUsage.upsert({
    where: { usageNo: u.usageNo }, update: {},
    create: {
      usageNo: u.usageNo,
      gasId: gasIds[u.gasCode],
      usedById: u.usedBy,
      quantity: u.quantity as any,
      unit: 'CYLINDER' as any,
      usedAt: daysAgo(u.daysAgo),
      purpose: u.purpose,
      remarks: 'Phase W2 seed',
    } as any,
  });
}

    // 9.7 W3 容器管理种子数据(CNAS §7.5 + §6.5)
    console.log('[seed] W3 containers + usages...');
    const containerSeeds = [
      { code: 'CT-202608-0001', name: '30mL 瓷坩埚', type: 'CRUCIBLE', material: 'PORCELAIN', capacityMl: '30.00', manufacturer: '唐山陶瓷集团', serialNo: 'TC-CR-001', location: '容器柜 B-01', status: 'IN_STOCK' as const },
      { code: 'CT-202608-0002', name: '50mL 瓷坩埚', type: 'CRUCIBLE', material: 'PORCELAIN', capacityMl: '50.00', manufacturer: '唐山陶瓷集团', serialNo: 'TC-CR-002', location: '容器柜 B-01', status: 'IN_STOCK' as const },
      { code: 'CT-202608-0003', name: '铂金坩埚 30mL', type: 'CRUCIBLE', material: 'PLATINUM', capacityMl: '30.00', toleranceMl: '0.0500', toleranceClass: 'A', manufacturer: '贵研铂业', serialNo: 'PT-CR-A001', location: '贵金属柜 P-01', status: 'IN_STOCK' as const },
      { code: 'CT-202608-0004', name: '100mL 容量瓶 A级', type: 'VOLUMETRIC_FLASK', material: 'BOROSILICATE', capacityMl: '100.00', toleranceMl: '0.1000', toleranceClass: 'A', manufacturer: '蜀牛玻璃', serialNo: 'SN-VF-100A', location: '容量瓶柜 C-01', status: 'IN_STOCK' as const },
      { code: 'CT-202608-0005', name: '250mL 容量瓶 A级', type: 'VOLUMETRIC_FLASK', material: 'BOROSILICATE', capacityMl: '250.00', toleranceMl: '0.1500', toleranceClass: 'A', manufacturer: '蜀牛玻璃', serialNo: 'SN-VF-250A', location: '容量瓶柜 C-01', status: 'IN_USE' as const },
      { code: 'CT-202608-0006', name: '50mL 滴定管 A级', type: 'BURETTE', material: 'BOROSILICATE', capacityMl: '50.00', toleranceMl: '0.0500', toleranceClass: 'A', manufacturer: '蜀牛玻璃', serialNo: 'SN-BU-50A', location: '滴定管架 C-02', status: 'IN_STOCK' as const },
      { code: 'CT-202608-0007', name: '500mL 烧杯', type: 'BEAKER', material: 'BOROSILICATE', capacityMl: '500.00', manufacturer: '蜀牛玻璃', serialNo: 'SN-BK-500', location: '烧杯架 D-01', status: 'IN_STOCK' as const },
      { code: 'CT-202608-0008', name: '100mL PTFE 量筒', type: 'CYLINDER', material: 'PTFE', capacityMl: '100.00', manufacturer: '南京瑞尼克', serialNo: 'RN-CY-100', location: 'PTFE 柜 P-02', status: 'IN_STOCK' as const },
    ];
    const containerIds: Record<string, string> = {};
    for (const c of containerSeeds) {
      const r = await prisma.container.upsert({
        where: { code: c.code }, update: {},
        create: {
          code: c.code, name: c.name, type: c.type as any, material: c.material as any,
          capacityMl: c.capacityMl as any, toleranceMl: (c as any).toleranceMl as any,
          toleranceClass: (c as any).toleranceClass, serialNo: c.serialNo, manufacturer: c.manufacturer,
          location: c.location, status: c.status as any,
          responsibleUserId: seniorUser.id,
          calibrationDate: new Date('2026-01-15'),
          nextCalDate: c.type === 'CRUCIBLE' ? null : new Date('2027-01-15'),
          remarks: 'Phase W3 seed',
        } as any,
      });
      containerIds[c.code] = r.id;
    }

    // 容器使用记录:1 条已归还 + 1 条未归还
    const containerUsages = [
      { usageNo: 'USE-20260815-0001', containerCode: 'CT-202608-0004', usedById: analystUser.id, purpose: 'ICP 定容', borrowedAgo: 3, conditionBefore: '完好', returnedAgo: 1, conditionAfter: '完好' },
      { usageNo: 'USE-20260815-0002', containerCode: 'CT-202608-0005', usedById: seniorUser.id, purpose: '火试金溶液配制', borrowedAgo: 1, conditionBefore: '完好', returnedAgo: null, conditionAfter: null },
    ];
    for (const u of containerUsages) {
      const borrowedAt = daysAgo(u.borrowedAgo);
      const returnedAt = u.returnedAgo !== null ? daysAgo(u.returnedAgo) : null;
      await prisma.containerUsage.upsert({
        where: { usageNo: u.usageNo }, update: {},
        create: {
          usageNo: u.usageNo,
          containerId: containerIds[u.containerCode],
          usedById: u.usedById,
          purpose: u.purpose,
          borrowedAt,
          returnedAt,
          conditionBefore: u.conditionBefore,
          conditionAfter: u.conditionAfter,
          remarks: 'Phase W3 seed',
        } as any,
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
