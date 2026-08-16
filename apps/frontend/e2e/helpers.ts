import { Page, expect, APIRequestContext } from '@playwright/test';

/** 唯一后缀(时间戳尾 8 位) */
export const ts = () => Date.now().toString().slice(-8);

/**
 * 按钮文本 → 容忍空格的正则。
 * antd autoInsertSpaceInButton 会在纯双汉字按钮里插空格(如 "登 录"),
 * 因此所有按钮定位都用本助手。
 */
export function btn(text: string): RegExp {
  const esc = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(esc.split('').join('\\s*'));
}

/** 登录 */
export async function login(page: Page, username = 'admin', password = 'Admin@Pass123') {
  await page.goto('/login');
  await page.getByPlaceholder('用户名').fill(username);
  await page.getByPlaceholder('密码').fill(password);
  await page.getByRole('button', { name: btn('登录') }).click();
  await expect(page).toHaveURL(/dashboard/, { timeout: 15000 });
}

/** 登录并返回 access token(用于 API 直连) */
export async function loginApi(request: APIRequestContext) {
  const res = await request.post('/api/v1/auth/login', {
    data: { username: 'admin', password: 'Admin@Pass123' },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return body.accessToken as string;
}

/** 按 label 填表单(antd Form.Item label) */
export async function fillByLabel(page: Page, label: string, value: string | number) {
  await page.getByLabel(label, { exact: true }).fill(String(value));
}

/** antd Select 选择:点外层 selector 打开下拉,按文本选选项;已选中目标则跳过 */
export async function pickOption(page: Page, label: string, text: string | RegExp) {
  // 限定在当前可见 Modal 内(避免匹配到已关闭弹窗中隐藏的同名控件)
  const modal = page.locator('.ant-modal:visible');
  const input = modal.getByLabel(label, { exact: true });
  const selector = input.locator('xpath=ancestor::div[contains(@class,"ant-select")][1]');

  // 已选中目标则跳过(如表单 initialValue 默认选中)
  const selItem = selector.locator('.ant-select-selection-item').first();
  if ((await selItem.count()) > 0 && typeof text === 'string') {
    const current = await selItem.innerText();
    if (current === text) return;
  }

  await selector.click();
  // 等下拉稳定(antd 展开动画),取最近打开的下拉
  const dropdown = page
    .locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)')
    .last();
  await expect(dropdown).toBeVisible({ timeout: 5000 });
  await page.waitForTimeout(250); // 等 antd 展开动画稳定
  await dropdown
    .locator('.ant-select-item-option')
    .filter({ hasText: text })
    .first()
    .click({ timeout: 5000 });
}

/** 点击当前可见 Modal 的主按钮(primary footer button,兼容 OK/确定/自定义 okText) */
export async function okModal(page: Page) {
  await page.locator('.ant-modal:visible .ant-modal-footer .ant-btn-primary').click();
}

/** 点击当前可见 Modal 里指定文案的按钮(容忍 antd 自动空格) */
export async function modalButton(page: Page, name: string | RegExp) {
  const matcher = typeof name === 'string' ? btn(name) : name;
  await page.locator('.ant-modal:visible').getByRole('button', { name: matcher }).click();
}

/** 等待成功 toast(antd message,generic) */
export async function waitSuccess(page: Page) {
  await expect(page.locator('.ant-message .ant-message-success').first()).toBeVisible({
    timeout: 15000,
  });
}

/** 等待指定文案出现(页面或 toast) */
export async function waitToast(page: Page, text: string | RegExp) {
  await expect(page.getByText(text).first()).toBeVisible({ timeout: 15000 });
}

/** 等待列表页出现指定文本行 */
export async function rowVisible(page: Page, text: string) {
  await expect(page.locator('.ant-table-row', { hasText: text }).first()).toBeVisible({
    timeout: 15000,
  });
}

/** 在可见 Modal 内定位表格行并勾选 */
export async function checkRowInModal(page: Page, text: string) {
  const row = page.locator('.ant-modal:visible .ant-table-row', { hasText: text }).first();
  await row.locator('input[type="checkbox"]').click();
}
