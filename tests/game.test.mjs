import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ids, counts, durations, newRound, scrambled, sameOrder, toggleSelection, localDay, rewardForWin, validRound } from '../src/game.js';
import { loadState, saveState, emptyState } from '../src/storage.js';
import { parseAddress, qrMatrix } from '../src/qr.js';

test('每种设置生成规定数量的不重复蘑菇且保留准确记忆时长', () => {
  // Given: 所有合法设置。
  for (const count of counts) for (const seconds of durations) {
    // When: 创建一局。
    const round = newRound({ count, seconds });
    // Then: 卡数、时长和可选成员满足规则，排序不能与答案相同。
    assert.equal(round.sequence.length, count);
    assert.equal(new Set(round.sequence).size, count);
    assert.equal(round.remaining, seconds * 1000);
    assert.ok(round.sequence.every(id => ids.includes(id)));
    assert.ok(!sameOrder(round.sequence, round.choices));
    assert.deepEqual([...round.sequence].sort(), [...round.choices].sort());
  }
});
test('随机洗牌重复执行始终保持所有卡片且改变答案顺序', () => {
  // Given: 三张至七张卡片。
  for (let count = 3; count <= 7; count++) for (let i = 0; i < 200; i++) {
    const sequence = ids.slice(0, count);
    // When: 打乱展示。
    const choices = scrambled(sequence);
    // Then: 题目不泄露原序且没有丢卡。
    assert.ok(!sameOrder(sequence, choices));
    assert.deepEqual([...sequence].sort(), [...choices].sort());
  }
});
test('撤回中间卡片后其余选择自动衔接', () => {
  // Given: 已选三张。
  const selected = ids.slice(0, 3);
  // When: 再次点第二张。
  const next = toggleSelection(selected, selected[1]);
  // Then: 仅撤回第二张，原数组不受影响。
  assert.deepEqual(next, [ids[0], ids[2]]); assert.equal(selected.length, 3);
});
test('顺序与成员相同但次序错误时不能通关', () => {
  // Given: 两组同成员异顺序卡片。
  const a = ids.slice(0, 3); const b = [a[1], a[0], a[2]];
  // When/Then: 判定失败，缺卡也失败。
  assert.equal(sameOrder(a, b), false); assert.equal(sameOrder(a, a.slice(1)), false); assert.equal(sameOrder(a, [...a]), true);
});
test('刷新记忆页恢复原题并暂停计时', () => {
  // Given: 已保存仍有 2750ms 的记忆局。
  const state = emptyState(); state.round = newRound(state.settings); state.round.remaining = 2750;
  const storage = { getItem: () => JSON.stringify(state) };
  // When: 恢复存储。
  const loaded = loadState(storage);
  // Then: 题目和剩余时长保留，必须主动继续。
  assert.deepEqual(loaded.state.round.sequence, state.round.sequence); assert.equal(loaded.state.round.remaining, 2750); assert.equal(loaded.state.round.paused, true);
});
test('存储中错误或不完整的局无法被恢复为通关结果', () => {
  // Given: 原局未完成却伪写成功结果。
  const round = newRound({ count: 3, seconds: 8 }); round.phase = 'result'; round.result = true;
  // When/Then: 边界校验拒绝它。
  assert.equal(validRound(round), false);
});
test('损坏存储回到默认设置', () => {
  // Given: 非法 JSON。
  const storage = { getItem: () => '{bad' };
  // When: 加载。
  const loaded = loadState(storage);
  // Then: 可继续游玩。
  assert.deepEqual(loaded.state, emptyState());
});
test('存储被浏览器禁用时显示非持久化状态', () => {
  // Given: 浏览器拒绝读写。
  const storage = { getItem: () => { throw new DOMException('blocked', 'SecurityError'); }, setItem: () => { throw new DOMException('full', 'QuotaExceededError'); } };
  // When/Then: 返回可处理的保存失败。
  assert.equal(loadState(storage).persistent, false); assert.equal(saveState(emptyState(), storage), false);
});
test('同日多次成功不新增领取凭证', () => {
  // Given: 今日已发出的凭证。
  const first = rewardForWin(null, '2026-11-01');
  // When: 再次通关。
  const again = rewardForWin(first, '2026-11-01');
  // Then: 复用同一凭证。
  assert.deepEqual(first, again);
});
test('localStorage 属性本身不可访问时仍可启动并返回明确降级状态', () => {
  // Given: 浏览器在访问属性阶段就抛 SecurityError。
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new DOMException('denied', 'SecurityError'); } });
  try {
    // When/Then: 读写均处理异常，不让启动过程崩溃。
    assert.equal(loadState().persistent, false); assert.equal(saveState(emptyState()), false);
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original); else delete globalThis.localStorage;
  }
});
test('已领取凭证在当日重玩后保持已领取', () => {
  // Given: 今日已核销。
  const first = { ...rewardForWin(null, '2026-11-01'), redeemedAt: '2026-11-01T01:00:00Z' };
  // When: 再通关。
  const again = rewardForWin(first, '2026-11-01');
  // Then: 不恢复为待领取。
  assert.equal(again.redeemedAt, first.redeemedAt); assert.equal(again.code, first.code);
});
test('次日通关生成新的当日凭证', () => {
  // Given: 昨日已领取。
  const previous = { ...rewardForWin(null, '2026-11-01'), redeemedAt: '2026-11-01T01:00:00Z' };
  // When: 次日通关。
  const next = rewardForWin(previous, '2026-11-02');
  // Then: 当日有效且未核销。
  assert.equal(next.day, '2026-11-02'); assert.equal(next.redeemedAt, null); assert.notEqual(next.code, previous.code);
});
test('本地日期按活动设备日历生成', () => {
  // Given: 本地午夜。
  const midnight = new Date(2026, 10, 1, 0, 1);
  // When/Then: 不按 UTC 偏移到前一天。
  assert.equal(localDay(midnight), '2026-11-01');
});
test('扫码地址拒绝脚本、本机回环与携带密码的网址', () => {
  // Given: 不适合作为手机扫码入口的地址。
  for (const address of ['javascript:alert(1)', 'file:///tmp/a', 'http://localhost:4173', 'http://127.0.0.1', 'https://u:p@example.com']) {
    // When/Then: 验证失败。
    assert.throws(() => parseAddress(address), TypeError);
  }
});
test('扫码接受局域网和正式站点并限制容量', () => {
  // Given: 可访问地址。
  for (const raw of ['http://192.168.1.10:4173/', 'https://example.com/game/']) {
    // When: 编码。
    const matrix = qrMatrix(parseAddress(raw));
    // Then: 固定版本矩阵正确，保留定位图形。
    assert.equal(matrix.length, 37); assert.equal(matrix[0].length, 37); assert.equal(matrix[3][3], true); assert.equal(matrix[1][1], false);
  }
  assert.throws(() => qrMatrix('x'.repeat(107)), RangeError);
});
