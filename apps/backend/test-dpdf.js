
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'a-strong-dev-secret-32-characters-long!!';
process.env.DATABASE_URL = 'postgresql://dunhuang:***@127.0.0.1:55432/dunhuang_lims?schema=public';
const { ReportService } = require('./dist/src/modules/report/report.service.js');
const { PrismaService } = require('./dist/src/infrastructure/prisma/prisma.service.js');
const prisma = new PrismaService();
const svc = new ReportService(prisma, { generate: () => ({ pdfBuffer: Buffer.from('test'), sha256: 'a'.repeat(64) }) }, { system: () => ({ error: () => {} }) });
(async () => {
  // 模拟错误场景
  const report = await prisma.report.findFirst({ where: { pdfSha256: { not: null } } });
  if (!report) { console.log('no pdf report'); process.exit(0); }
  try {
    const r = await svc.downloadPdf(report.id);
    console.log('ok:', r.sha256.slice(0, 8));
  } catch (e) {
    console.log('err type:', e.constructor.name, 'msg:', e.message);
  }
  await prisma.$disconnect();
})();
