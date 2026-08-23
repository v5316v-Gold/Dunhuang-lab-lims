/**
 * 评审演示数据种子脚本 — W4 任务 4
 *
 * 用途:评审现场(/compliance/management-review/inputs)能显示有意义的统计数字
 *      (期内完成 N 次培训/M 次监督/数项 PT 等),确保 12 项评审输入非空
 *
 * 用法:
 *   node dist/seed-demo-data.js                  # 默认:评审前 12 个月
 *   node dist/seed-demo-data.js --from=2025-11-01 --to=2026-08-23
 *
 * 可重复执行(用 upsert / skip-if-exists):不破坏现有真数据
 */
import { PrismaClient, Prisma } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

// 命令行参数
const args = process.argv.slice(2);
const argMap: Record<string, string> = {};
for (const a of args) {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  if (m) argMap[m[1]] = m[2] ?? 'true';
}

const NOW = new Date();
const FROM = argMap.from ? new Date(argMap.from) : new Date(NOW.getTime() - 365 * 24 * 3600 * 1000);
const TO = argMap.to ? new Date(argMap.to) : NOW;

async function ensureUser(username: string, name: string, role: any) {
  const u = await prisma.user.findUnique({ where: { username } });
  if (u) return u;
  return prisma.user.create({
    data: {
      username,
      passwordHash: await argon2.hash('Admin@Pass123', { type: argon2.argon2id }),
      name,
      email: `${username}@lims.local`,
      role,
      status: 'ACTIVE',
    },
  });
}

async function seedInternalAudits() {
  // 期内 2 次内审(年初 + 年中),CLOSED 状态
  const admin = await ensureUser('admin', '管理员', 'ADMIN');
  const director = await ensureUser('director.zhao', '赵主任', 'LAB_DIRECTOR');
  const existing = await prisma.internalAudit.count({ where: { auditDate: { gte: FROM, lte: TO } } });
  if (existing >= 2) return;
  const data: Prisma.InternalAuditCreateInput[] = [
    {
      auditNo: `IA-DEMO-${FROM.getFullYear()}-001`,
      title: '年度管理体系内部审核(上半年度)',
      scope: '检测全流程:样品接收 → 检测 → 报告签发 → 原始记录',
      auditDate: new Date((FROM.getTime() + TO.getTime()) / 4),
      auditorIds: [admin.id, director.id],
      status: 'CLOSED',
      findings: '整体符合 CNAS-CL01:2018 要求,部分记录格式需统一,已完成整改',
      ncCount: 3,
      createdBy: { connect: { id: admin.id } },
    },
    {
      auditNo: `IA-DEMO-${FROM.getFullYear()}-002`,
      title: '专项内部审核(设备 + 试剂)',
      scope: '设备校准/期间核查 + 试剂/标准物质管理',
      auditDate: new Date((FROM.getTime() + TO.getTime()) * 3 / 4),
      auditorIds: [admin.id],
      status: 'CLOSED',
      findings: '2 台设备校准证书临近过期已更新;1 个标准物质过期已替换',
      ncCount: 1,
      createdBy: { connect: { id: admin.id } },
    },
  ];
  for (const d of data) {
    await prisma.internalAudit.upsert({
      where: { auditNo: d.auditNo as string },
      update: {},
      create: d,
    });
  }
  console.log(`✓ 内审: ${data.length} 条已 seed`);
}

async function seedTrainings() {
  const count = await prisma.training.count({ where: { trainingDate: { gte: FROM, lte: TO } } });
  if (count >= 5) return;
  const personnel = await prisma.personnel.findMany({ take: 10 });
  const admin = await ensureUser('admin', '管理员', 'ADMIN');
  const trainings = [
    { name: 'CNAS-CL01:2018 体系文件培训', type: '体系文件', cert: 'CERT-2026-001' },
    { name: '火试金法 GB/T 9288 操作规范', type: '检测技术', cert: 'CERT-2026-002' },
    { name: 'ICP-OES 多元素分析培训', type: '检测技术', cert: 'CERT-2026-003' },
    { name: 'MFA 双因素认证与信息安全', type: '信息安全', cert: 'CERT-2026-004' },
    { name: '不确定度评定 GUM 实务', type: '不确定度', cert: 'CERT-2026-005' },
  ];
  for (let i = 0; i < trainings.length; i++) {
    const t = trainings[i];
    const d = new Date(FROM.getTime() + ((i + 1) * (TO.getTime() - FROM.getTime())) / (trainings.length + 1));
    const target = personnel[i % Math.max(personnel.length, 1)];
    await prisma.training.create({
      data: {
        personnelId: target?.id ?? admin.id,
        trainingType: t.type,
        trainingName: t.name,
        trainingDate: d,
        durationHours: 4,
        certificateNo: t.cert,
        content: `${t.name} 培训内容涵盖相关 CNAS 条款与操作要点`,
        result: 'PASS',
      },
    });
  }
  console.log(`✓ 培训: ${trainings.length} 条已 seed`);
}

async function seedSupervisions() {
  const count = await prisma.supervisionRecord.count({ where: { supDate: { gte: FROM, lte: TO } } });
  if (count >= 3) return;
  const wangWu = await ensureUser('wang.wu', '王五', 'QUALITY_MANAGER');
  const analyst = await ensureUser('zhang.san', '张三', 'ANALYST');
  const senior = await ensureUser('li.si', '李四', 'SENIOR_ANALYST');
  const sups = [
    { supervisee: senior, content: '现场观察火试金炉温控制 + 称重记录', result: 'PASS' },
    { supervisee: analyst, content: '现场观察 ICP-OES 校准 + 样品测试', result: 'PASS' },
  ];
  for (let i = 0; i < sups.length; i++) {
    await prisma.supervisionRecord.create({
      data: {
        supNo: `SUP-DEMO-${Date.now()}-${i}`,
        supervisorId: wangWu.id,
        superviseeId: sups[i].supervisee.id,
        supDate: new Date(FROM.getTime() + (i + 1) * (TO.getTime() - FROM.getTime()) / (sups.length + 1)),
        content: sups[i].content,
        result: sups[i].result,
        createdById: wangWu.id,
      },
    });
  }
  console.log(`✓ 监督: ${sups.length} 条已 seed`);
}

async function seedProficiencyTests() {
  const count = await prisma.proficiencyTest.count({ where: { startDate: { gte: FROM, lte: TO } } });
  if (count >= 2) return;
  const admin = await ensureUser('admin', '管理员', 'ADMIN');
  const mid = new Date((FROM.getTime() + TO.getTime()) / 2);
  await prisma.proficiencyTest.upsert({
    where: { ptNo: `PT-DEMO-${FROM.getFullYear()}-001` },
    update: {},
    create: {
      ptNo: `PT-DEMO-${FROM.getFullYear()}-001`,
      organizer: 'CNAS 能力验证计划(模拟)',
      item: 'Au 纯度',
      method: 'FIRE_ASSAY',
      startDate: new Date(FROM.getTime() + 30 * 24 * 3600 * 1000),
      endDate: new Date(FROM.getTime() + 45 * 24 * 3600 * 1000),
      zScore: '0.45',
      result: 'SATISFACTORY',
      createdById: admin.id,
    },
  });
  await prisma.proficiencyTest.upsert({
    where: { ptNo: `PT-DEMO-${FROM.getFullYear()}-002` },
    update: {},
    create: {
      ptNo: `PT-DEMO-${FROM.getFullYear()}-002`,
      organizer: '国家金银制品质量监督检验中心(模拟)',
      item: 'Au 纯度',
      method: 'FIRE_ASSAY',
      startDate: mid,
      endDate: new Date(mid.getTime() + 15 * 24 * 3600 * 1000),
      zScore: '1.20',
      result: 'SATISFACTORY',
      createdById: admin.id,
    },
  });
  console.log(`✓ PT: 2 条已 seed`);
}

async function seedBlindSamples() {
  const count = await prisma.blindSample.count({ where: { createdAt: { gte: FROM, lte: TO } } });
  if (count >= 2) return;
  const wangWu = await ensureUser('wang.wu', '王五', 'QUALITY_MANAGER');
  const intern = await ensureUser('intern.song', '宋实习', 'INTERN');
  await prisma.blindSample.upsert({
    where: { blindNo: `BL-DEMO-${FROM.getFullYear()}-001` },
    update: {},
    create: {
      blindNo: `BL-DEMO-${FROM.getFullYear()}-001`,
      sampleCode: 'BS-AU-001',
      assignedToId: intern.id,
      trueValue: '99.9900',
      measuredValue: '99.9500',
      deviationPct: '0.0400',
      passed: true,
      assessDate: new Date((FROM.getTime() + TO.getTime()) / 2),
      remarks: '盲样考核合格(偏差 0.04%)',
      createdById: wangWu.id,
    },
  });
  console.log(`✓ 盲样: 1 条已 seed`);
}

async function seedManagementReview() {
  const count = await prisma.managementReview.count();
  if (count >= 1) return;
  const admin = await ensureUser('admin', '管理员', 'ADMIN');
  await prisma.managementReview.upsert({
    where: { reviewNo: `MR-DEMO-${TO.getFullYear()}-001` },
    update: {},
    create: {
      reviewNo: `MR-DEMO-${TO.getFullYear()}-001`,
      title: '年度管理评审',
      periodFrom: FROM,
      periodTo: TO,
      reviewDate: new Date(TO.getTime() - 14 * 24 * 3600 * 1000),
      attendees: [],
      status: 'CLOSED',
      createdById: admin.id,
    },
  });
  console.log(`✓ 管理评审: 1 条已 seed`);
}

async function main() {
  console.log(`▶ 生成评审演示数据, 期间: ${FROM.toISOString().slice(0, 10)} ~ ${TO.toISOString().slice(0, 10)}`);
  await seedInternalAudits();
  await seedTrainings();
  await seedSupervisions();
  await seedProficiencyTests();
  await seedBlindSamples();
  await seedManagementReview();
  console.log('✓ 评审演示数据 seed 完成');
  console.log('  验证: 访问 /compliance/management-review/inputs 查看 12 项统计');
}

main()
  .catch((e) => { console.error('FAIL', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
