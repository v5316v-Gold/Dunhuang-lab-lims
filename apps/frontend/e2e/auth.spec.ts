import { test, expect } from '@playwright/test';
import { login, btn } from './helpers';

test.describe('认证流程', () => {
  test('1. 正确账号登录成功', async ({ page }) => {
    await login(page);
    // 进入主布局:侧边栏菜单可见
    await expect(page.getByText('样品管理').first()).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('仪表盘', { exact: true }).first()).toBeVisible({ timeout: 30000 });
  });

  test('2. 错误密码登录失败', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('用户名').fill('admin');
    await page.getByPlaceholder('密码').fill('WrongPass123!');
    await page.getByRole('button', { name: btn('登录') }).click();
    // 登录失败:拦截器登出并跳回 /login,本地不残留 token
    await expect(page).toHaveURL(/login/, { timeout: 15000 });
    await page.waitForTimeout(1500);
    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('dunhuang-lims-auth') ?? '{}'),
    );
    expect(stored?.state?.accessToken).toBeFalsy();
  });

  test('3. 登出', async ({ page }) => {
    await login(page);
    await page.locator('.ant-dropdown-trigger').click();
    await page.getByText('退出登录').click();
    await expect(page).toHaveURL(/login/, { timeout: 15000 });
  });
});
