/**
 * 敦煌金质检 LIMS - 种子数据脚本
 * 详见 docs/02-DATABASE.md + ADR-0011(贵金属业务约束)
 *
 * 作用:
 *   1. 创建 1 个 admin 用户(可登录)
 *   2. 创建 1 个 QA 经理 + 3 个检测员(火试金/ICP 专员)
 *   3. 创建 1 个部门(检测部)
 *   4. 创建 1 个检测方法(火试金,GB/T 9288)
 *   5. 创建 1 个 QC 标准物质(GBW02757 99.999% Au)
 *   6. 创建 1 个设备(分析天平,精度 0.001mg)
 *
 * 注意:
 *   - 触发 audit_trigger 必须写入 app.current_user_id session 变量
 *   - 必须先 SET LOCAL 才能让审计链记录到正确的 user
 *   - 启动方式: pnpm db:seed (apps/backend)
 */

import { PrismaClient, Prisma, UserRole, UserStatus, PersonnelStatus } from '@prisma/client';
import * as argon2 from 'argon2';

// 必须最先加载 dotenv:Prisma CLI spawn ts-node 时不自动注入 .env
// 兼容 dev (src) / build (dist) / monorepo 多种路径
// eslint-disable-next-line @typescript-eslint/no-var-requires
const dotenv = require('dotenv');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('path');
const envCandidates = [
  path.resolve(__dirname, '../../../../.env'),
  path.resolve(__dirname, '../../../.env'),
  path.resolve(__dirname, '../../.env'),
];
for (const p of envCandidates) {
  dotenv.config({ path: p });
}

const prisma = new PrismaClient();

// ============ 配置 ============
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@Pass123';
const ANALYST_PASSWORD = process.env.ANALYST_PASSWORD || 'Analyst@Pass123';

// 在事务内设置 PG session 变量,确保审计链记录到正确 user
async function withAuditContext<T>(
  userId: string,
  username: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_user_id = '${userId}'`);
    await tx.$executeRawUnsafe(`SET LOCAL app.current_username = '${username}'`);
    return fn(tx);
  });
}

// ============ Hash 密码 ============
async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });
}

// ============ 主流程 ============
async function main() {
  console.log('🌱 开始种子数据初始化...\n');

  // 1. 部门(检测部)
  const dept = await prisma.department.upsert({
    where: { code: 'TEST-LAB' },
    update: {},
    create: {
      code: 'TEST-LAB',
      name: '检测部',
    },
  });
  console.log(`✅ 部门: ${dept.name} (${dept.id})`);

  // 2. admin 用户
  const adminId = '00000000-0000-0000-0000-000000000001';
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      id: adminId,
      username: 'admin',
      email: 'admin@dunhuang-gold.cn',
      passwordHash: await hashPassword(ADMIN_PASSWORD),
      name: '系统管理员',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      mfaEnabled: false,
      deptId: dept.id,
      title: '系统管理员',
      updatedAt: new Date(),
    },
  });
  console.log(`✅ admin 用户: ${admin.username} (密码: ${ADMIN_PASSWORD})`);

  // 用 admin 身份设置审计上下文
  await withAuditContext(admin.id, admin.username, async (tx) => {
    // 3. QA 经理
    const qaManager = await tx.user.upsert({
      where: { username: 'qa.manager' },
      update: {},
      create: {
        username: 'qa.manager',
        email: 'qa.manager@dunhuang-gold.cn',
        passwordHash: await hashPassword(ANALYST_PASSWORD),
        name: '张质量',
        role: UserRole.QUALITY_MANAGER,
        status: UserStatus.ACTIVE,
        mfaEnabled: false,
        deptId: dept.id,
        title: 'QA 经理',
        updatedAt: new Date(),
      },
    });
    console.log(`✅ QA 经理: ${qaManager.username} (密码: ${ANALYST_PASSWORD})`);

    // 4. 火试金高级检测员
    const fireAssaySenior = await tx.user.upsert({
      where: { username: 'fire.senior' },
      update: {},
      create: {
        username: 'fire.senior',
        email: 'fire.senior@dunhuang-gold.cn',
        passwordHash: await hashPassword(ANALYST_PASSWORD),
        name: '李试金',
        role: UserRole.SENIOR_ANALYST,
        status: UserStatus.ACTIVE,
        mfaEnabled: false,
        deptId: dept.id,
        title: '火试金高级检测员',
        updatedAt: new Date(),
      },
    });
    console.log(`✅ 火试金高级检测员: ${fireAssaySenior.username}`);

    // 5. ICP 检测员
    const icpAnalyst = await tx.user.upsert({
      where: { username: 'icp.analyst' },
      update: {},
      create: {
        username: 'icp.analyst',
        email: 'icp.analyst@dunhuang-gold.cn',
        passwordHash: await hashPassword(ANALYST_PASSWORD),
        name: '王光谱',
        role: UserRole.ANALYST,
        status: UserStatus.ACTIVE,
        mfaEnabled: false,
        deptId: dept.id,
        title: 'ICP 检测员',
        updatedAt: new Date(),
      },
    });
    console.log(`✅ ICP 检测员: ${icpAnalyst.username}`);

    // 6. 火试金方法(GB/T 9288)
    const fireAssayMethod = await tx.method.upsert({
      where: { methodCode: 'GB-T-9288' },
      update: {},
      create: {
        methodCode: 'GB-T-9288',
        methodName: '首饰含金量 火试金法测定',
        assayType: 'FIRE_ASSAY',
        standard: 'GB/T 9288',
        scope: '金锭、金粉、合金、首饰、回收金料(50.00% - 99.999%)',
        lod: new Prisma.Decimal('0.000100'),
        loq: new Prisma.Decimal('0.001000'),
        uncertainty: new Prisma.Decimal('0.050000'),
        status: 'ACTIVE',
        version: 1,
        effectiveAt: new Date('2024-01-01'),
      },
    });
    console.log(`✅ 检测方法: ${fireAssayMethod.methodCode} - ${fireAssayMethod.methodName}`);

    // 7. ICP-OES 方法(GB/T 21198)
    const icpMethod = await tx.method.upsert({
      where: { methodCode: 'GB-T-21198' },
      update: {},
      create: {
        methodCode: 'GB-T-21198',
        methodName: '金合金中杂质元素 ICP-OES 测定',
        assayType: 'ICP_OES',
        standard: 'GB/T 21198',
        scope: '金合金中 Ag/Cu/Fe/Pb/Pt/Pd/Ni/Zn 等杂质元素(ppm 级)',
        lod: new Prisma.Decimal('0.500000'),
        loq: new Prisma.Decimal('1.000000'),
        uncertainty: new Prisma.Decimal('2.500000'),
        status: 'ACTIVE',
        version: 1,
        effectiveAt: new Date('2024-01-01'),
      },
    });
    console.log(`✅ 检测方法: ${icpMethod.methodCode} - ${icpMethod.methodName}`);

    // 8. QC 标准物质(GBW02757 99.999% Au)
    const rm = await tx.referenceMaterial.upsert({
      where: { code: 'GBW02757' },
      update: {},
      create: {
        code: 'GBW02757',
        name: '黄金成分分析标准物质',
        element: 'Au',
        certifiedPct: new Prisma.Decimal('99.999000'),
        uncertainty: new Prisma.Decimal('0.000500'),
        manufacturer: '中国地质科学院',
        receivedDate: new Date('2024-06-01'),
        expiryDate: new Date('2030-06-01'),
      },
    });
    console.log(`✅ QC 标准物质: ${rm.code} (Au ${rm.certifiedPct}% ± ${rm.uncertainty}%)`);

    // 9. 设备(分析天平)
    const balance = await tx.equipment.upsert({
      where: { equipmentNo: 'BAL-001' },
      update: {},
      create: {
        equipmentNo: 'BAL-001',
        name: '电子分析天平',
        type: 'ANALYTICAL_BALANCE',
        model: 'Mettler-Toledo XPR2',
        serialNo: 'B123456789',
        manufacturer: '梅特勒-托利多',
        purchaseDate: new Date('2023-01-15'),
        warrantyExpiresAt: new Date('2026-01-15'),
        location: '检测部 · 火试金室',
        status: 'ACTIVE',
        accuracy: '0.001mg / 0.000001g',
        range: '0-2200g',
      },
    });
    console.log(`✅ 设备: ${balance.equipmentNo} - ${balance.name} (${balance.accuracy})`);

    // 10. 设备(试金炉)
    const furnace = await tx.equipment.upsert({
      where: { equipmentNo: 'FUR-001' },
      update: {},
      create: {
        equipmentNo: 'FUR-001',
        name: '试金炉(火试金专用)',
        type: 'FIRE_ASSAY_FURNACE',
        model: 'Carbolite CWF 13/65',
        serialNo: 'F987654321',
        manufacturer: 'Carbolite Gero',
        purchaseDate: new Date('2023-03-20'),
        warrantyExpiresAt: new Date('2026-03-20'),
        location: '检测部 · 火试金室',
        status: 'ACTIVE',
        accuracy: '±5°C',
        range: '0-1300°C',
      },
    });
    console.log(`✅ 设备: ${furnace.equipmentNo} - ${furnace.name}`);
  });

  console.log('\n🎉 种子数据初始化完成！');
  console.log('\n📋 测试账号:');
  console.log(`   admin       / ${ADMIN_PASSWORD}     (系统管理员)`);
  console.log(`   qa.manager  / ${ANALYST_PASSWORD}    (QA 经理)`);
  console.log(`   fire.senior / ${ANALYST_PASSWORD}    (火试金高级检测员)`);
  console.log(`   icp.analyst / ${ANALYST_PASSWORD}    (ICP 检测员)`);
  console.log('\n💡 审计链 SHA256 已自动写入 audit_logs 表(由 PG 触发器)');
}

main()
  .catch((e) => {
    console.error('❌ 种子初始化失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });