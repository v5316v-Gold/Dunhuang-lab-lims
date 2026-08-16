import { test, expect } from '@playwright/test';
import {
  login,
  loginApi,
  fillByLabel,
  pickOption,
  okModal,
  waitSuccess,
  waitToast,
  rowVisible,
  btn,
  ts,
} from './helpers';

/** 合规管理(CMA 五表): 临时授权/监督/盲样/PT */
test.describe('合规管理(CMA)', () => {
  let granteeLabel = '';

  test('16. 临时授权: 授予 + 撤销', async ({ page, request }) => {
    const token = await loginApi(request);
    const ur = await request.get('/api/v1/users?pageSize=20', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(ur.ok()).toBeTruthy();
    const users = (await ur.json()).data ?? [];
    const grantee = users.find((u: any) => u.username === 'icp.analyst') ?? users[0];
    granteeLabel = grantee.name ? `${grantee.name}(${grantee.username})` : grantee.username;

    await login(page);
    await page.goto('/compliance');
    await page.getByRole('button', { name: btn('授予临时权限') }).click();
    await pickOption(page, '被授权人(代班)', granteeLabel);
    await fillByLabel(page, '授权原因', 'E2E 代班测试');
    await okModal(page);
    await waitSuccess(page);
    await rowVisible(page, 'ACTIVE');

    await page.getByRole('button', { name: btn('撤销') }).first().click();
    await page.locator('.ant-popover:visible').getByRole('button', { name: btn('撤销') }).click();
    await waitSuccess(page);
  });

  test('17. 监督记录: 新建', async ({ page, request }) => {
    const token = await loginApi(request);
    const ur = await request.get('/api/v1/users?pageSize=20', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const users = (await ur.json()).data ?? [];
    const a = users[0];
    const b = users.find((u: any) => u.id !== a.id) ?? users[0];
    const labelOf = (u: any) => u.name ?? u.username;

    await login(page);
    await page.goto('/compliance');
    await page.getByRole('tab', { name: '监督记录' }).click();
    await page.getByRole('button', { name: btn('新建监督') }).click();
    await pickOption(page, '监督员', labelOf(a));
    await pickOption(page, '被监督人', labelOf(b));
    await fillByLabel(page, '监督内容', 'E2E 现场监督:火试金称样操作');
    await page.locator('.ant-modal:visible input[type="date"]').first().fill('2026-08-16');
    await okModal(page);
    await waitSuccess(page);
  });

  test('18. 盲样考核: 新建 + 评定', async ({ page, request }) => {
    const token = await loginApi(request);
    const ur = await request.get('/api/v1/users?pageSize=20', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const users = (await ur.json()).data ?? [];
    const assignee = users.find((u: any) => u.username === 'icp.analyst') ?? users[0];
    const labelOf = (u: any) => u.name ?? u.username;

    await login(page);
    await page.goto('/compliance');
    await page.getByRole('tab', { name: '盲样考核' }).click();
    await page.getByRole('button', { name: btn('新建盲样') }).click();
    const blindNo = `BL-E2E-${ts()}`;
    await fillByLabel(page, '盲样编号', blindNo);
    await fillByLabel(page, '真值(已知)', '99.99');
    await pickOption(page, '被考核人', labelOf(assignee));
    await okModal(page);
    await waitSuccess(page);

    const blindRow = page.locator('.ant-table-row', { hasText: blindNo }).first();
    await expect(blindRow).toBeVisible({ timeout: 15000 });
    await blindRow.getByRole('button', { name: btn('录入') }).click();
    await fillByLabel(page, '被考核人测得值', '99.98');
    await okModal(page);
    await waitToast(page, /考核完成/);
  });

  test('19. 能力验证(PT): 新建 + 录入结果', async ({ page }) => {
    await login(page);
    await page.goto('/compliance');
    await page.getByRole('tab', { name: '能力验证(PT)' }).click();
    await page.getByRole('button', { name: btn('新建 PT') }).click();
    const organizer = `CNAS E2E PT ${ts()}`;
    await fillByLabel(page, '组织方', organizer);
    await page.locator('.ant-modal:visible input[type="date"]').first().fill('2026-08-16');
    await okModal(page);
    await waitSuccess(page);

    // 定位刚创建的行(组织方唯一)
    const ptRow = page.locator('.ant-table-row', { hasText: organizer }).first();
    await expect(ptRow).toBeVisible({ timeout: 15000 });
    await ptRow.getByRole('button', { name: btn('录入') }).click();
    await fillByLabel(page, 'zScore', '0.5');
    await okModal(page);
    await waitToast(page, /PT 结果已录入/);
  });
});
