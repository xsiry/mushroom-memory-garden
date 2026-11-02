import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const bundle = process.env.CODEX_NODE_MODULES || `${process.env.HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules`;
const require = createRequire(`${bundle}/package.json`);
const { chromium } = require('playwright');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const base = process.env.GAME_URL || 'http://localhost:4173/';
await mkdir('outputs/qa', { recursive: true });
const reports = []; const errors = []; const brokenRequests = [];
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const page = await context.newPage();
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => { if (response.status() >= 400) brokenRequests.push(`${response.status()} ${response.url()}`); });
const record = name => { reports.push({ name, status: 'PASS' }); console.log(`PASS ${name}`); };
const capture = name => page.screenshot({ path: `outputs/qa/${name}.png`, fullPage: true, animations: 'disabled' });
async function ready() { await page.getByRole('button', { name: '开始游戏', exact: true }).waitFor(); }
async function openFresh() { await page.goto(base); await ready(); }
async function completeCorrectly() {
  await page.getByRole('button', { name: '开始游戏', exact: true }).click();
  const sequence = await page.locator('.card-name').allTextContents();
  await page.locator('[data-pick]').first().waitFor({ timeout: 17000 });
  for (const name of sequence) await page.getByRole('button', { name, exact: false }).filter({ has: page.locator('.card-name') }).click();
  await page.getByRole('button', { name: '确认顺序', exact: true }).click();
  await page.getByRole('heading', { name: '耶！一个都没记错' }).waitFor();
}
try {
  // 第一轮：完整游客流程，所有操作从真实页面触发。
  await openFresh();
  await page.getByLabel('给自己一点记忆时间').selectOption('3');
  for (const [width, height] of [[320, 568], [360, 640], [390, 844], [430, 932], [768, 1024], [1440, 900], [844, 390]]) {
    await page.setViewportSize({ width, height });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await capture(`home-${width}x${height}`);
  }
  record('7 种视口首页无横向溢出');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '开始游戏', exact: true }).click();
  const sequence = await page.locator('.card-name').allTextContents();
  await capture('memory-390');
  await page.getByRole('button', { name: '游戏玩法说明' }).click();
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('button', { name: '游戏玩法说明' }).evaluate(node => node === document.activeElement), true);
  await page.getByRole('button', { name: '继续记忆' }).click();
  await page.reload();
  await page.getByRole('button', { name: '继续记忆' }).waitFor();
  assert.equal(await page.locator('.concealed').isVisible(), false);
  await capture('paused-390');
  await page.getByRole('button', { name: '继续记忆' }).click();
  await page.locator('[data-pick]').first().waitFor({ timeout: 6000 });
  const restoredSequence = await page.locator('.card-name').allTextContents();
  assert.deepEqual([...sequence].sort(), [...restoredSequence].sort());
  record('记忆刷新后原题恢复、遮住答案、主动继续');
  assert.equal(await page.getByRole('button', { name: '确认顺序', exact: true }).isDisabled(), true);
  await page.locator('[data-pick]').first().click();
  await page.locator('[data-pick]').nth(1).click();
  await page.locator('[data-pick]').first().click();
  assert.equal(await page.locator('.selected').count(), 1);
  await page.getByRole('button', { name: '撤销上一步' }).click();
  assert.equal(await page.locator('.selected').count(), 0);
  for (const name of sequence) await page.locator('[data-pick]').filter({ hasText: name }).click();
  await capture('sort-selected-390');
  await page.reload();
  await page.getByRole('button', { name: '确认顺序', exact: true }).waitFor();
  assert.equal(await page.locator('.selected').count(), 3);
  await page.getByRole('button', { name: '确认顺序', exact: true }).click();
  await page.getByRole('heading', { name: '耶！一个都没记错' }).waitFor();
  await capture('success-390'); record('点选撤回、撤销、排序刷新、真实通关');
  await page.getByRole('button', { name: '查看领取凭证' }).click();
  const code = await page.locator('.ticket-code').textContent();
  await capture('reward-390');
  await page.getByRole('button', { name: '交给工作人员核验' }).click();
  assert.equal(await page.getByRole('button', { name: '确认已发放，完成核销' }).isDisabled(), true);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: '确认已发放，完成核销' }).click();
  await page.getByRole('heading', { name: '礼物已经到手啦' }).waitFor();
  await capture('redeemed-390');
  await page.reload();
  await page.getByRole('button', { name: '查看领取凭证' }).click();
  await page.getByRole('heading', { name: '礼物已经到手啦' }).waitFor();
  assert.equal(await page.locator('.ticket-code').textContent(), code);
  await page.getByRole('button', { name: '回到森林' }).click();
  await completeCorrectly();
  await page.getByRole('button', { name: '查看领取凭证' }).click();
  await page.getByRole('heading', { name: '礼物已经到手啦' }).waitFor();
  assert.equal(await page.locator('.ticket-code').textContent(), code);
  record('工作人员双步核销、刷新保留、重复通关不再发券');
  // 第二轮：最大数量、错误复盘与设置返回。
  await page.getByRole('button', { name: '回到森林' }).click();
  await page.getByRole('button', { name: '7 张', exact: true }).click();
  await page.getByLabel('给自己一点记忆时间').selectOption('15');
  await page.getByRole('button', { name: '开始游戏', exact: true }).click();
  const seven = await page.locator('.card-name').allTextContents();
  await capture('memory-seven-390');
  for (const [width, height] of [[320, 568], [360, 640], [390, 844], [430, 932], [768, 1024], [1440, 900], [844, 390]]) {
    await page.setViewportSize({ width, height });
    const lastCardBottom = await page.locator('.mushroom-card').last().evaluate(node => node.getBoundingClientRect().bottom);
    assert.ok(lastCardBottom <= height, `记忆卡片必须全部可见：${width}x${height}，最后卡片底部 ${lastCardBottom}`);
    await capture(`memory-seven-${width}x${height}`);
  }
  record('7 种视口记忆阶段全部卡片无需滚动可见');
  await page.locator('[data-pick]').first().waitFor({ timeout: 17000 });
  for (const [width, height] of [[320, 568], [390, 844], [768, 1024], [1440, 900], [844, 390]]) {
    await page.setViewportSize({ width, height });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    const sizes = await page.locator('[data-pick]').evaluateAll(nodes => nodes.map(node => ({ width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height })));
    assert.ok(sizes.every(size => size.width >= 44 && size.height >= 44));
    await capture(`sort-seven-${width}x${height}`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  for (const name of [seven[1], seven[0], ...seven.slice(2)]) await page.locator('[data-pick]').filter({ hasText: name }).click();
  await page.getByRole('button', { name: '确认顺序', exact: true }).click();
  await page.getByRole('heading', { name: '差一点点，再试一次' }).waitFor();
  assert.equal(await page.locator('.mismatch').count(), 2);
  await capture('failure-seven-390');
  await page.getByRole('button', { name: '再试本局', exact: true }).click();
  assert.deepEqual(await page.locator('.card-name').allTextContents(), seven);
  await page.getByRole('button', { name: '返回设置', exact: true }).click();
  await page.getByRole('button', { name: '继续这一局', exact: true }).waitFor();
  await page.getByRole('button', { name: '结束本局，返回设置' }).click();
  await ready(); record('7 张卡片多尺寸、失败复盘、同题重试与退出确认');
  // 第三轮：对话框、扫码、键盘与减少动态效果。
  await page.getByRole('button', { name: '蘑菇图鉴', exact: true }).click();
  assert.equal(await page.locator('.collection-item').count(), 7); await capture('collection-390');
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('button', { name: '蘑菇图鉴', exact: true }).evaluate(node => node === document.activeElement), true);
  await page.getByRole('button', { name: '扫码入口', exact: true }).click();
  await page.locator('#qr-preview>svg').waitFor(); await capture('qr-390');
  await page.locator('#qr-preview').screenshot({ path: 'outputs/qa/qr-decode.png' });
  await page.getByLabel('游戏网址', { exact: true }).fill('http://localhost:4173/');
  await page.getByRole('button', { name: '生成二维码', exact: true }).click();
  assert.ok((await page.locator('#qr-error').textContent()).length > 0);
  await page.getByLabel('游戏网址', { exact: true }).fill('https://example.com/mushroom/');
  await page.getByRole('button', { name: '生成二维码', exact: true }).click();
  const downloadPromise = page.waitForEvent('download'); await page.getByRole('button', { name: '保存二维码 SVG' }).click();
  const download = await downloadPromise; assert.ok(download.suggestedFilename().endsWith('.svg'));
  await page.keyboard.press('Escape');
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
  await page.getByRole('button', { name: '开始游戏', exact: true }).click();
  assert.equal(await page.evaluate(() => getComputedStyle(document.body).colorScheme), 'light');
  await capture('reduced-motion-dark-system-390');
  record('图鉴、弹层焦点、二维码校验与下载、减少动态效果');
  assert.deepEqual(errors, []); assert.deepEqual(brokenRequests, []);
  record('主流程无未捕获异常与失败网络响应');
  // 独立上下文：资源失败与完全禁止存储访问。
  const fallback = await browser.newContext({ viewport: { width: 320, height: 568 } });
  const fallbackPage = await fallback.newPage();
  await fallbackPage.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('denied', 'SecurityError'); } }));
  await fallbackPage.goto(base); await fallbackPage.getByRole('button', { name: '开始游戏', exact: true }).waitFor();
  await fallbackPage.locator('.storage-warning').waitFor();
  await fallbackPage.screenshot({ path: 'outputs/qa/storage-denied-320.png', fullPage: true });
  await fallback.close(); record('完全禁止存储时依然启动并显示保存警告');
  const failureContext = await browser.newContext(); const failurePage = await failureContext.newPage();
  await failurePage.route('**/slippery.webp', route => route.abort());
  await failurePage.goto(base); await failurePage.getByRole('button', { name: '重新加载', exact: true }).waitFor();
  await failurePage.screenshot({ path: 'outputs/qa/asset-error.png', fullPage: true });
  await failurePage.unroute('**/slippery.webp');
  await failurePage.getByRole('button', { name: '重新加载', exact: true }).click();
  await failurePage.getByRole('button', { name: '开始游戏', exact: true }).waitFor();
  await failureContext.close(); record('图片加载失败反馈与重试恢复');
  const loadContext = await browser.newContext({ viewport: { width: 390, height: 844 } }); const loadPage = await loadContext.newPage();
  await loadPage.route('**/golden-ear.webp', async route => { await new Promise(resolve => setTimeout(resolve, 1200)); await route.continue(); });
  await loadPage.goto(base, { waitUntil: 'domcontentloaded' }); await loadPage.locator('#load-status').waitFor();
  await loadPage.screenshot({ path: 'outputs/qa/loading-390.png' });
  await loadPage.getByRole('button', { name: '开始游戏', exact: true }).waitFor();
  await loadContext.close(); record('真实素材加载进度及卡通加载页');
  await writeFile('outputs/qa/browser-results.json', JSON.stringify({ reports, errors, brokenRequests, browser: browser.version(), at: new Date().toISOString() }, null, 2));
} finally { await browser.close(); }
