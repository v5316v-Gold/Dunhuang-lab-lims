import { defineConfig, devices } from '@playwright/test';

/**
 * 敦煌金质检 LIMS — Playwright E2E 配置
 * 目标: 对运行中的前端(5173)+ 后端(3030)做全流程 UI 测试
 * 运行: pnpm test:e2e  (或 npx playwright test)
 * 报告: npx playwright show-report  (HTML 报告)
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,          // 串行:共享同一个数据库,避免数据互相干扰
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    headless: true,
    viewport: { width: 1440, height: 900 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    actionTimeout: 20_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: 'msedge',
      use: { ...devices['Desktop Edge'], channel: 'msedge' },
    },
  ],
});
