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

/** 支撑模块 CRUD E2E: 设备/人员/试剂/气体/危废/容器/贵金属 */
test.describe('支撑模块 CRUD', () => {
  test('9. 设备管理: 创建设备', async ({ page, request }) => {
    const code = `EQP-${ts()}`;
    await login(page);
    await page.goto('/equipment');
    await page.getByRole('button', { name: btn('创建设备') }).click();
    await fillByLabel(page, '设备编号', code);
    await fillByLabel(page, '设备名称', 'E2E分析天平');
    await okModal(page);
    await waitSuccess(page);
    // 列表分页可能不显示最新行,用 API 复核落库
    const token = await loginApi(request);
    const list = await request.get('/api/v1/equipment?pageSize=20', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await list.json();
    const found = (body.data ?? []).some((e: any) => e.equipmentNo === code);
    expect(found).toBeTruthy();
  });

  test('10. 人员管理: 创建人员', async ({ page, request }) => {
    const emp = `EMP-${ts()}`;
    const token = await loginApi(request);
    // 新建一个用户并关联(Personnel.userId 唯一,种子用户会被历次运行耗尽)
    const uname = `e2e.person.${ts()}`;
    const u = await request.post('/api/v1/users', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        username: uname,
        email: `${uname}@dunhuang-gold.cn`,
        password: 'E2ePass@12345',
        name: 'E2E人员用户',
        role: 'ANALYST',
      },
    });
    expect(u.ok()).toBeTruthy();
    const userId = (await u.json()).id as string;

    await login(page);
    await page.goto('/personnel');
    await page.getByRole('button', { name: btn('创建人员') }).click();
    await fillByLabel(page, '工号', emp);
    await fillByLabel(page, '姓名', 'E2E检测员');
    await fillByLabel(page, '关联用户 ID', userId);
    await okModal(page);
    await waitSuccess(page);
    const list = await request.get('/api/v1/personnel?pageSize=20', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await list.json();
    const found = (body.data ?? []).some((p: any) => p.employeeNo === emp);
    expect(found).toBeTruthy();
  });

  test('11. 试剂库存: 创建试剂', async ({ page, request }) => {
    const code = `RGT-${ts()}`;
    await login(page);
    await page.goto('/reagents');
    await page.getByRole('button', { name: btn('创建试剂') }).click();
    await fillByLabel(page, '试剂编码', code);
    await fillByLabel(page, '试剂名称', 'E2E硝酸');
    await okModal(page);
    await waitSuccess(page);
    const token = await loginApi(request);
    const list = await request.get('/api/v1/reagents?pageSize=20', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await list.json();
    const found = (body.data ?? []).some((r: any) => r.code === code);
    expect(found).toBeTruthy();
  });

  test('12. 气体管理: 创建气体主数据', async ({ page }) => {
    await login(page);
    await page.goto('/gas');
    await page.getByRole('button', { name: btn('创建气体') }).click();
    await fillByLabel(page, '名称', `E2E氩气-${ts()}`);
    await pickOption(page, '类型', '氩气');
    await fillByLabel(page, '当前库存(瓶)', '2');
    await fillByLabel(page, '最低库存(瓶)', '1');
    await okModal(page);
    await waitSuccess(page);
  });

  test('13. 危废管理: 登记 + 转移', async ({ page }) => {
    await login(page);
    await page.goto('/waste');
    await page.getByRole('button', { name: btn('危废登记') }).click();
    await pickOption(page, '类型', '废液');
    await pickOption(page, '危险类别', /HW34/);
    await pickOption(page, '来源类型', '检测产生');
    await fillByLabel(page, '重量(kg)', '12.5');
    await fillByLabel(page, '存放位置', 'E2E危废间');
    await okModal(page);
    await waitToast(page, /登记成功/);
    await rowVisible(page, '已暂存');

    await page.getByRole('button', { name: btn('转移') }).first().click();
    await fillByLabel(page, '接收企业名称', 'E2E环保公司');
    await fillByLabel(page, '接收企业资质证号(CNAS §7.10 必填)', 'HW-2026-E2E');
    await fillByLabel(page, '危废转移联单号', 'MF-E2E-0001');
    await okModal(page);
    await waitToast(page, /转移登记成功/);
  });

  test('14. 容器管理: 建档 + 领用', async ({ page }) => {
    await login(page);
    await page.goto('/container');
    await page.getByRole('button', { name: btn('容器建档') }).click();
    await fillByLabel(page, '名称', `E2E瓷坩埚-${ts()}`);
    await pickOption(page, '类型', '坩埚');
    await pickOption(page, '材质', '瓷');
    await okModal(page);
    await waitSuccess(page);
    await rowVisible(page, '在库');

    await page.getByRole('button', { name: btn('领用') }).first().click();
    await fillByLabel(page, '用途', 'E2E火试金');
    await okModal(page);
    await waitSuccess(page);
    await rowVisible(page, '使用中');
  });

  test('15. 贵金属业务: 取样登记 + 条码出证', async ({ page, request }) => {
    const token = await loginApi(request);
    const res = await request.post('/api/v1/samples', {
      headers: { Authorization: `Bearer ${token}` },
      data: { customerName: `E2E贵金属-${ts()}`, sampleType: 'GOLD_INGOT', weightG: '50.0000' },
    });
    expect(res.ok()).toBeTruthy();
    const sample = await res.json();

    await login(page);
    await page.goto('/precious-metal');

    // 取样记录 Tab
    await page.getByRole('tab', { name: /取样记录/ }).click();
    await page.getByRole('button', { name: btn('取样登记') }).click();
    await pickOption(page, '取样方式', '客户送样');
    await pickOption(page, '取样地点', '实验室内');
    await pickOption(page, '样品形态', '金锭');
    await pickOption(page, '金属种类', '金');
    await okModal(page);
    await waitSuccess(page);
    // 等取样弹窗完全关闭再操作条码弹窗
    await expect(page.locator('.ant-modal:visible')).toHaveCount(0, { timeout: 5000 });

    // 生成条码(卡片右上,始终可见)
    await page.getByRole('button', { name: btn('生成条码') }).click();
    await fillByLabel(page, '样品 ID(UUID)', sample.id);
    await pickOption(page, '金属种类', '金');
    await pickOption(page, '成色', /AU9999/);
    await fillByLabel(page, '实测重量(g)', '50.0000');
    await fillByLabel(page, '实测纯度(%)', '99.99');
    await okModal(page);
    await waitSuccess(page);
    // 回到条码 Tab 验证新条码
    await page.getByRole('tab', { name: /贵金属条码/ }).click();
    await rowVisible(page, 'BAR-AU');
  });
});
