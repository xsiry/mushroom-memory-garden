import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const bundle = process.env.CODEX_NODE_MODULES || `${process.env.HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules`;
const require = createRequire(`${bundle}/package.json`);
const { chromium } = require('playwright');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
try {
  for (const device of ['mobile', 'desktop']) for (let run = 1; run <= 3; run++) {
    const context = await browser.newContext({ viewport: device === 'mobile' ? { width: 390, height: 844 } : { width: 1440, height: 900 } });
    const page = await context.newPage(); const session = await context.newCDPSession(page);
    await session.send('Network.enable'); await session.send('Network.setCacheDisabled', { cacheDisabled: true });
    if (device === 'mobile') {
      await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      await session.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1600000 / 8, uploadThroughput: 750000 / 8 });
    }
    await page.addInitScript(() => {
      window.gameMetrics = { lcp: 0, cls: 0, longTasks: [] };
      new PerformanceObserver(list => { for (const entry of list.getEntries()) window.gameMetrics.lcp = entry.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver(list => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.gameMetrics.cls += entry.value; }).observe({ type: 'layout-shift', buffered: true });
      new PerformanceObserver(list => { for (const entry of list.getEntries()) window.gameMetrics.longTasks.push(entry.duration); }).observe({ type: 'longtask', buffered: true });
    });
    await page.goto('http://localhost:4173/'); await page.getByRole('button', { name: '开始游戏', exact: true }).waitFor();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.waitForFunction(() => window.gameMetrics.lcp > 0);
    const metrics = await page.evaluate(() => ({ ...window.gameMetrics, transferBytes: performance.getEntriesByType('resource').reduce((total, entry) => total + entry.transferSize, 0), readyMs: performance.now() }));
    const inputMs = await page.evaluate(() => new Promise(resolve => {
      const before = performance.now(); document.querySelector('[data-count="7"]').click(); requestAnimationFrame(() => resolve(performance.now() - before));
    }));
    const result = { device, run, ...metrics, inputMs };
    results.push(result); console.log(JSON.stringify(result));
    assert.ok(metrics.lcp > 0 && metrics.lcp < 2500, `LCP 测量无效或超出 2.5 秒：${metrics.lcp}`);
    assert.ok(metrics.cls < 0.1, `CLS 超出 0.1：${metrics.cls}`);
    assert.ok(inputMs < 200, `交互响应超出 200ms：${inputMs}`);
    await context.close();
  }
  await writeFile('outputs/qa/performance.json', JSON.stringify({ method: '真实 Chrome，移动端 4 倍 CPU 限速、150ms RTT、1.6Mbps 下载；各 3 轮禁用缓存。输入耗时为点击分发到下一动画帧的实验室测量，不等同现场 INP。', browser: browser.version(), results }, null, 2));
} finally { await browser.close(); }
