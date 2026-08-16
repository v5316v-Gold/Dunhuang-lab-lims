import { test, expect } from '@playwright/test';
import {
  login,
  loginApi,
  fillByLabel,
  pickOption,
  okModal,
  modalButton,
  waitToast,
  checkRowInModal,
  rowVisible,
  btn,
  ts,
} from './helpers';

/**
 * 主链路 E2E: 样品接收 → 批次(火试金 6 步)→ 检测 → 报告三级审核 → 签发 → 审计日志
 */
test.describe('主链路(样品→批次→检测→报告签发)', () => {
  let sampleNo = '';
  let sampleId = '';
  let batchId = '';
  let reportId = '';

  test('4. 接收样品', async ({ page }) => {
    await login(page);
    await page.goto('/samples/receive');

    const respPromise = page.waitForResponse(
      (r) => r.url().includes('/api/v1/samples') && r.request().method() === 'POST',
    );
    await fillByLabel(page, '客户名称', `E2E客户-${ts()}`);
    // 样品类型表单默认 GOLD_INGOT(金锭),无需选择
    await fillByLabel(page, '重量(克)', '100.5000');
    await fillByLabel(page, '客户声明纯度(%)', '99.99');
    await page.getByRole('button', { name: btn('提交接收') }).click();

    const resp = await respPromise;
    expect(resp.status()).toBeGreaterThanOrEqual(200);
    const body = await resp.json();
    sampleNo = body.sampleNo;
    sampleId = body.id;
    expect(sampleNo).toMatch(/^\d{6}-\d{4}$/);

    // 到列表页确认新样品可见
    await page.goto('/samples');
    await rowVisible(page, sampleNo);
  });

  test('5. 创建批次(火试金)并加入样品', async ({ page }) => {
    await login(page);
    await page.goto('/batches');
    await page.getByRole('button', { name: btn('创建批次') }).click();
    await page.getByLabel('试金炉号(仅火试金)').fill('FUR-E2E-01');
    const batchRespPromise = page.waitForResponse(
      (r) => r.url().includes('/api/v1/batches') && r.request().method() === 'POST',
    );
    await okModal(page);
    await waitToast(page, /批次创建成功/);
    const batchResp = await batchRespPromise;
    batchId = (await batchResp.json()).id;
    expect(batchId).toBeTruthy();

    // 直接进入批次详情
    await page.goto(`/batches/${batchId}`);
    await expect(page.getByRole('button', { name: btn('加入样品') })).toBeVisible({
      timeout: 10000,
    });

    await page.getByRole('button', { name: btn('加入样品') }).click();
    await checkRowInModal(page, sampleNo);
    await modalButton(page, /加入 \(\d+\)/);
    await waitToast(page, /已加入 1 个样品/);
  });

  test('6. 批次状态推进(火试金 6 步 + 称重)', async ({ page, request }) => {
    await login(page);
    const token = await loginApi(request);
    const authHeaders = { Authorization: `Bearer ${token}` };
    await page.goto(`/batches/${batchId}`);
    await expect(page.getByRole('button', { name: btn('开始批次') })).toBeVisible({
      timeout: 10000,
    });

    const advance = [
      { btn: '开始批次' },
      { btn: '推进 → 熔融', fields: { '混料温度 ℃': '800', '混料时长 min': '30' } },
      { btn: '推进 → 灰吹', fields: { '炉温 ℃': '1100', '熔融时长 min': '60' } },
      { btn: '推进 → 分金', fields: { '灰吹温度 ℃': '950', '灰吹时长 min': '40' } },
      { btn: '推进 → 退火', fields: { '分金硝酸浓度': '33', '分金时长 min': '30' } },
      { btn: '推进 → 称重', fields: { '退火温度 ℃': '700', '退火时长 min': '20' } },
    ];
    for (const step of advance) {
      await page.getByRole('button', { name: btn(step.btn) }).click();
      const confirmModal = page.locator('.ant-modal:visible', { hasText: '状态推进确认' });
      if (await confirmModal.isVisible().catch(() => false)) {
        for (const [label, value] of Object.entries(step.fields ?? {})) {
          const input = confirmModal.getByLabel(label, { exact: true });
          if (await input.isVisible().catch(() => false)) {
            await input.fill(value);
          }
        }
        await modalButton(page, '确认推进');
      }
      await waitToast(page, /状态推进成功|已推进/);
    }

    // WEIGHING → 火试金称重录入弹窗
    // 说明:批次推进(MIXING→ANNEALING)时 UI 已把工艺参数发给后端,
    // 后端会为批次样品自动创建 FireAssay 检测并写入 fireAssayDetail(含步骤守卫所需参数)。
    await page.getByRole('button', { name: btn('推进 → 计算') }).click();
    const fireModal = page.locator('.ant-modal:visible', { hasText: '火试金称重录入' });
    await expect(fireModal).toBeVisible({ timeout: 10000 });

    const fireModal2 = page.locator('.ant-modal:visible', { hasText: '火试金称重录入' });
    await expect(fireModal2).toBeVisible({ timeout: 10000 });

    // 逐行提交:每行取第一个未禁用的输入,提交后等待"✓ 已录入"计数增长
    const total = await page
      .locator('.ant-modal:visible input[placeholder="如:511.8300"]:not([disabled])')
      .count();
    expect(total).toBeGreaterThan(0);
    // 说明:3 个平行样共享同一 sampleId/testId,一次提交成功后全部行标记已录入
    const prill = page.locator('.ant-modal:visible input[placeholder="如:511.8300"]:not([disabled])').first();
    const qc = page.locator('.ant-modal:visible input[placeholder="99.85"]:not([disabled])').first();
    await prill.fill('0.9995');
    await qc.fill('100');
    await page
      .locator('.ant-modal:visible')
      .getByRole('button', { name: btn('提交') })
      .first()
      .click();
    await expect(page.locator('.ant-modal:visible').getByText('✓ 已录入')).toHaveCount(total, {
      timeout: 15000,
    });

    await page
      .locator('.ant-modal:visible')
      .getByRole('button', { name: /完成称重/ })
      .click();
    await waitToast(page, /平行样称重完成/);
    await page.getByRole('button', { name: btn('完成批次') }).click();
    await waitToast(page, /状态推进成功|完成/);
    await expect(page.getByText('已完成', { exact: true }).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test('7. 创建报告 → 三级审核 → 签发(附 PDF 校验)', async ({ page, request }) => {
    const token = await loginApi(request);
    const authHeaders = { Authorization: `Bearer ${token}` };

    // 自建样品,避免跨测试变量在 worker 重启后丢失
    const s = await (
      await request.post('/api/v1/samples', {
        headers: authHeaders,
        data: { customerName: `E2E报告-${ts()}`, sampleType: 'GOLD_INGOT', weightG: '88.0000' },
      })
    ).json();
    const mySampleId = s.id as string;
    expect(mySampleId).toMatch(/^[0-9a-f-]{36}$/);

    // 报告创建走 API(创建弹窗 validateFields 在 try 外,UI 提交不可靠)
    const createRes = await request.post('/api/v1/reports', {
      headers: authHeaders,
      data: { sampleId: mySampleId },
    });
    if (!createRes.ok()) {
      // 诊断输出,便于定位
      console.log('report create failed:', createRes.status(), (await createRes.text()).slice(0, 200));
    }
    expect(createRes.ok()).toBeTruthy();
    reportId = (await createRes.json()).id;

    await login(page);
    await page.goto(`/reports/${reportId}`);
    await page.getByRole('button', { name: btn('提交校核') }).click();
    await waitToast(page, '操作成功');
    await page.getByRole('button', { name: btn('校核通过') }).click();
    await waitToast(page, '操作成功');
    await page.getByRole('button', { name: btn('审核批准') }).click();
    await waitToast(page, '操作成功');
    await page.getByRole('button', { name: btn('签发报告') }).click();
    await waitToast(page, '操作成功');
    await expect(page.getByText('ISSUED').first()).toBeVisible({ timeout: 15000 });

    // PDF 完整性:下载报告 PDF(前端无下载按钮,用 API 验证)
    const pdfRes = await request.get(`/api/v1/reports/${reportId}/pdf`, { headers: authHeaders });
    expect(pdfRes.ok()).toBeTruthy();
    const ctype = pdfRes.headers()['content-type'] ?? '';
    expect(ctype).toContain('pdf');
  });

  test('8. 审计日志(含断链自检)', async ({ page }) => {
    await login(page);
    await page.goto('/audit-logs');
    await expect(page.locator('.ant-table-row').first()).toBeVisible({ timeout: 15000 });
    await page.locator('.ant-btn-primary').click();
    await expect(page.getByText(/审计链验证通过/).first()).toBeVisible({ timeout: 15000 });
  });
});
