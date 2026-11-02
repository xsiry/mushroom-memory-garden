import { createRequire } from 'node:module';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const url = process.env.GAME_URL;
if (!url) throw new Error('请通过 GAME_URL 指定已部署的游戏入口');
const bundle = process.env.CODEX_NODE_MODULES || `${process.env.HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules`;
const { chromium } = createRequire(`${bundle}/package.json`)('playwright');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await context.newPage();
const errors = []; const failures = []; const passed = [];
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => { if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`); });
const output = process.env.QA_OUTPUT || 'outputs/deployment/20261101-124208/qa';
await mkdir(output, { recursive: true });
const capture = name => page.screenshot({ path: `${output}/${name}.png`, fullPage: true, animations: 'disabled' });
try {
  // Given: 公网空白浏览器，未依赖本机服务或预置存档。
  await page.goto(url); await page.getByRole('button', { name: '开始游戏', exact: true }).waitFor();
  assert.equal(await page.locator('[data-action="sound"]').count(), 0);
  await capture('public-home');
  passed.push('公网首页、七张素材、右上角音效图标移除');

  // When: 按真实记忆顺序完成一局。
  await page.locator('#memory-time-trigger').click();
  await page.getByRole('option', { name: '3 秒', exact: true }).click();
  await page.getByRole('button', { name: '开始游戏', exact: true }).click();
  const sequence = await page.locator('.card-name').allTextContents();
  await page.locator('[data-pick]').first().waitFor({ timeout: 10000 });
  for (const name of sequence) await page.locator('[data-pick]').filter({ hasText: name }).click();
  await page.getByRole('button', { name: '确认顺序', exact: true }).click();
  // Then: 公网 HTTP 环境可生成领取凭证。
  await page.getByRole('button', { name: '查看领取凭证' }).waitFor();
  await capture('public-success');
  await page.getByRole('button', { name: '查看领取凭证' }).click();
  const code = await page.locator('.ticket-code').textContent();
  assert.ok(code.trim().length > 0); await capture('public-reward');
  passed.push('公网记忆、排序、通关、领取凭证生成');

  // Given: 原游客浏览器已持有凭证。
  await page.getByRole('button', { name: '交给工作人员核验' }).click();
  assert.equal(await page.getByRole('button', { name: '确认已发放，完成核销' }).isDisabled(), true);
  // When: 工作人员确认交付。
  await page.getByRole('checkbox').check(); await page.getByRole('button', { name: '确认已发放，完成核销' }).click();
  // Then: 原凭证已领取且刷新后保留。
  await page.getByRole('heading', { name: '礼物已经到手啦' }).waitFor();
  await page.reload(); await page.getByRole('button', { name: '查看领取凭证' }).click();
  await page.getByRole('heading', { name: '礼物已经到手啦' }).waitFor();
  assert.equal(await page.locator('.ticket-code').textContent(), code);
  passed.push('公网核销与刷新恢复');

  // Given: 从公网首页生成分享二维码。
  await page.getByRole('button', { name: '回到森林' }).click();
  await page.getByRole('button', { name: '蘑菇图鉴', exact: true }).click();
  assert.equal(await page.locator('.collection-item').count(), 7);
  await capture('public-collection');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '扫码入口', exact: true }).click();
  await page.locator('#qr-preview>svg').waitFor();
  await page.locator('#qr-preview').screenshot({ path: `${output}/public-qr.png` });
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: '保存二维码 PNG' }).click();
  const download = await downloadEvent;
  assert.ok(download.suggestedFilename().endsWith('.png'));
  await download.saveAs(`${output}/downloaded-entry.png`);
  const png = await readFile(`${output}/downloaded-entry.png`);
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(png.readUInt32BE(16), 900); assert.equal(png.readUInt32BE(20), 900);
  await page.keyboard.press('Escape'); passed.push('公网二维码显示与下载');

  // When: 故意按打乱后的顺序提交。
  await page.getByRole('button', { name: '开始游戏', exact: true }).click();
  await page.locator('[data-pick]').first().waitFor({ timeout: 10000 });
  const choices = await page.locator('[data-pick]').first().getAttribute('data-pick');
  assert.ok(choices);
  const order = await page.locator('[data-pick]').evaluateAll(nodes => nodes.map(node => node.dataset.pick));
  for (const id of order) await page.locator(`[data-pick="${id}"]`).click();
  await page.getByRole('button', { name: '确认顺序', exact: true }).click();
  // Then: 失败可复盘并重试。
  await page.getByRole('heading', { name: '差一点点，再试一次' }).waitFor();
  await page.getByRole('button', { name: '再试本局', exact: true }).click();
  await page.getByRole('heading', { name: '记住小伙伴的顺序' }).waitFor();
  passed.push('公网失败复盘与原题重试');
  assert.deepEqual(errors, []); assert.deepEqual(failures, []);
  await writeFile(`${output}/smoke-results.json`, JSON.stringify({ url, passed, errors, failures, browser: browser.version(), checkedAt: new Date().toISOString() }, null, 2));
  console.log(JSON.stringify({ passed, errors, failures }));
} finally { await browser.close(); }
