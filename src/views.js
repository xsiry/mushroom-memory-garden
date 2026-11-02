import { mushrooms, counts, durations, localDay } from './game.js';
import { icon } from './icons.js';
export const picture = id => `assets/mushrooms/${id}.webp`;
export function card(id, options = {}) {
  const m = mushrooms.find(item => item.id === id);
  const tag = options.clickable ? 'button' : 'div';
  const index = Number.isInteger(options.index) ? options.index : 0;
  return `<${tag} class="mushroom-card ${m.color} ${options.selected ? 'selected' : ''}" style="--idx:${index}" ${options.clickable ? `data-pick="${id}" aria-pressed="${Boolean(options.selected)}"` : ''}>
    <span class="card-number ${options.number ? '' : 'empty-number'}">${options.number || ''}</span>
    <span class="card-art"><img src="${picture(id)}" alt="" width="160" height="160" decoding="async" draggable="false"></span><span class="card-name">${m.name}</span>
    ${options.clickable && options.selected ? `<span class="card-check">${icon('check')}</span>` : ''}
  </${tag}>`;
}
export function heading(title, text) { return `<div class="page-heading"><h1 tabindex="-1">${title}</h1>${text ? `<p>${text}</p>` : ''}</div>`; }
export function home(state) {
  return `<section class="home-screen">
    <div class="welcome-title"><span class="little-label">✦ 森林里的小小挑战 ✦</span><h1 tabindex="-1">蘑菇家族<span>记忆排序</span></h1></div>
    <div class="garden-stage" role="img" aria-label="三位蘑菇伙伴在森林里等你"><div class="garden-sun"></div><span class="garden-note" id="garden-bubble">一起玩一局吧！</span><div class="garden-ground"></div><img class="friend friend-left" data-friend="pink-ear" data-greet="呼呼～粉色小裙子转圈圈！" src="${picture('pink-ear')}" width="125" height="160" decoding="async" alt="粉木耳"><img class="friend friend-center" data-friend="matsutake" data-greet="嘿咻！记住我们的排队顺序哟～" src="${picture('matsutake')}" width="130" height="168" fetchpriority="high" decoding="async" alt="赤松茸"><img class="friend friend-right" data-friend="lions-mane" data-greet="软乎乎的猴头菇给你加油！" src="${picture('lions-mane')}" width="125" height="140" decoding="async" alt="猴头菇"><span class="flower flower-one" aria-hidden="true">${icon('asterisk')}</span><span class="flower flower-two" aria-hidden="true">${icon('floret')}</span><span class="flower flower-three" aria-hidden="true">${icon('sparkle')}</span></div>
    <div class="setup"><div class="setup-line"><label id="count-label">记几位小伙伴？</label><span class="setup-badge">卡片数量</span></div>
    <div class="number-picker" role="group" aria-labelledby="count-label">${counts.map(count => `<button data-count="${count}" aria-pressed="${state.settings.count === count}" class="${state.settings.count === count ? 'active' : ''}">${count}<small>张</small></button>`).join('')}</div>
    <div class="time-row"><label id="time-label" for="memory-time-trigger">${icon('clock')} 给自己一点记忆时间</label><div class="time-select" id="time-select"><button type="button" id="memory-time-trigger" class="time-trigger" data-action="toggle-time" aria-labelledby="time-label memory-time-value" aria-haspopup="listbox" aria-expanded="false"><span id="memory-time-value">${state.settings.seconds} 秒</span>${icon('chevron')}</button><div class="time-menu" id="time-menu" role="listbox" aria-labelledby="time-label" hidden>${durations.map(seconds => `<button type="button" role="option" data-seconds="${seconds}" aria-selected="${seconds === state.settings.seconds}" class="time-option ${seconds === state.settings.seconds ? 'active' : ''}"><span>${seconds} 秒</span>${seconds === state.settings.seconds ? icon('check') : ''}</button>`).join('')}</div></div></div>
    <button class="primary start-button" data-action="start">开始游戏 ${icon('arrow')}</button>
    <p class="setup-tip">记住顺序 · 点击还原 · 通关领小礼物</p></div>
    <nav class="home-links" aria-label="游戏工具"><button data-action="collection">${icon('book')}蘑菇图鉴</button><button data-action="reward">${icon('gift')}我的礼物${state.reward?.day === localDay() && !state.reward.redeemedAt ? '<i class="notification-dot"></i>' : ''}</button><button data-action="qr">${icon('qr')}扫码入口</button></nav>
    <p class="footer-note">小小记忆力，藏着大大的惊喜</p>
  </section>`;
}
export function game(state) {
  const r = state.round;
  const memory = r.phase === 'memory';
  const remainingSec = Math.ceil(r.remaining / 1000);
  const progress = Math.max(0, Math.min(1, r.remaining / (state.settings.seconds * 1000)));
  const urgent = memory && remainingSec <= 3;
  const readySubmit = !memory && r.selected.length === r.sequence.length;
  return `<section class="game-screen ${memory ? 'memory-screen' : 'sort-screen'} is-count-${r.sequence.length}">
    <div class="game-top">
      <div class="page-heading"><h1 tabindex="-1">${memory ? '记住小伙伴的顺序' : '把小伙伴排回来吧'}</h1><p>${memory ? '从左到右、从上到下，悄悄记在心里。' : '按刚才的顺序点击，再次点击已选卡可撤回。'}</p></div>
      <div class="round-status"><span class="phase-label">${memory ? '01 / 记一记' : '02 / 排一排'}</span>${memory ? `<span class="countdown ${urgent ? 'urgent' : ''}" role="timer" aria-label="剩余记忆时间"><strong id="seconds">${remainingSec}</strong> 秒</span>` : `<span class="selected-count">已选 <strong id="selected-num">${r.selected.length}</strong> / ${r.sequence.length}</span>`}</div>
      ${memory ? `<div class="time-track ${urgent ? 'urgent' : ''}" style="--p:${progress}"><div id="time-fill" style="transform:scaleX(${progress})"></div><span class="track-runner" aria-hidden="true"></span></div>` : `<div class="sequence-slots" role="group" aria-label="已选顺序">${r.sequence.map((_, i) => `<span class="${r.selected[i] ? 'filled' : ''}">${r.selected[i] ? `<img src="${picture(r.selected[i])}" alt="第${i + 1}位${mushrooms.find(m => m.id === r.selected[i]).name}" decoding="async">` : i + 1}</span>`).join('')}</div>`}
    </div>
    <div class="board-wrap"><div class="card-grid count-${r.sequence.length} ${r.paused && memory ? 'concealed' : ''}">${(memory ? r.sequence : r.choices).map((id, i) => card(id, { index: i, clickable: !memory, number: memory ? i + 1 : r.selected.includes(id) ? r.selected.indexOf(id) + 1 : null, selected: !memory && r.selected.includes(id) })).join('')}</div>${r.paused && memory ? `<div class="pause-cover"><img src="assets/sprout.svg" alt="" width="56" height="56"><h2>小蘑菇等你回来</h2><p>计时暂停啦，准备好再继续。</p><button class="primary" data-action="resume">继续记忆</button></div>` : ''}</div>
    <div class="game-bottom">
      ${memory ? `<p class="board-hint">${icon('leaf')} 小提示：把它们想成一个小故事</p>` : `<div class="sort-actions"><button class="text-button" data-action="undo" ${r.selected.length ? '' : 'disabled'}>${icon('undo')}撤销上一步</button><button class="primary ${readySubmit ? 'ready-pulse' : ''}" data-action="submit" ${readySubmit ? '' : 'disabled'}>确认顺序 ${icon('check')}</button></div>`}
      <div class="quiet-actions"><button data-action="retry">${icon('undo')}重试本局</button><button data-action="settings">${icon('back')}返回设置</button></div>
    </div>
  </section>`;
}
function orderRow(sequence, reference) {
  return `<div class="review-row">${sequence.map((id, i) => `<div class="review-item ${reference && reference[i] !== id ? 'mismatch' : ''}" style="--idx:${i}"><span>${i + 1}</span><img src="${picture(id)}" alt="" width="64" height="64" decoding="async"><small>${mushrooms.find(m => m.id === id).name}</small></div>`).join('')}</div>`;
}
export function result(state) {
  const r = state.round;
  const success = r.result;
  const confetti = success ? `<div class="confetti-stage" aria-hidden="true">${Array.from({ length: 14 }, (_, i) => `<i class="confetti-piece c${(i % 5) + 1}" style="--i:${i}"></i>`).join('')}</div>` : '';
  return `<section class="result-screen ${success ? 'success' : 'failure'}"><div class="result-illustration">${confetti}<span class="result-orbit"></span><img src="${picture(success ? 'lions-mane' : 'pink-ear')}" width="150" height="160" decoding="async" alt="${success ? '猴头菇为你庆祝' : '粉木耳陪你再试一次'}">${success ? `<span class="spark spark-one">${icon('sparkle')}</span><span class="spark spark-two">${icon('asterisk')}</span><span class="spark spark-three">${icon('floret')}</span><span class="spark spark-four">${icon('sparkle')}</span>` : '<span class="comfort-bubble">摸摸头，再来一次～</span>'}</div>
    ${heading(success ? '耶！一个都没记错' : '差一点点，再试一次', success ? '恭喜你，闯关成功！小伙伴为你准备了礼物。' : '没关系，看看小伙伴原来站在哪里。')}
    <div class="result-actions"><button class="primary" data-action="${success ? 'reward' : 'retry'}">${success ? `查看领取凭证 ${icon('gift')}` : '再试本局'}</button><button class="secondary" data-action="${success ? 'new' : 'settings'}">${success ? '再玩一局' : '返回设置'}</button></div>
    <div class="result-review"><h2>${success ? '你记住的顺序' : '正确顺序'}</h2>${orderRow(r.sequence)}${success ? '' : `<h2>你刚才的顺序</h2>${orderRow(r.selected, r.sequence)}`}</div>
    <p class="footer-note">${success ? '每天一份小礼物，快乐可以有好多次' : '下一次，说不定就记住啦'}</p></section>`;
}
export function reward(state) {
  const r = state.reward;
  const valid = r?.day === localDay();
  if (!valid) return `<section class="reward-screen">${heading('礼物在等你', '完成一次记忆挑战，就能解锁今日领取凭证。')}<div class="empty-gift">${icon('gift')}<p>${r ? '上次的凭证已过期，今天再来玩一局吧。' : '把小伙伴的顺序找回来吧。'}</p></div><button class="primary" data-action="settings">去玩一局</button></section>`;
  return `<section class="reward-screen">${heading(r.redeemedAt ? '礼物已经到手啦' : '送你一份森林心意', r.redeemedAt ? '愿这份小小礼物，陪你好心情一整天。' : '请在今天前往活动现场礼品领取处。')}
    <div class="gift-ticket ${r.redeemedAt ? 'redeemed' : ''}"><div class="ticket-top"><img src="${picture('matsutake')}" width="86" height="108" decoding="async" alt="赤松茸"><span>蘑菇家族 · 森林礼遇<br><strong>通关领取凭证</strong></span></div><div class="ticket-body"><span class="ticket-status">${r.redeemedAt ? `${icon('check')} 已领取` : '<i class="live-dot"></i> 待现场领取'}</span><p class="ticket-code">${r.code.slice(0, 5)} ${r.code.slice(5)}</p><p>有效日期 ${r.day.replaceAll('-', '.')}</p><div class="ticket-rule"></div><ol><li>向工作人员出示本页实时凭证</li><li>工作人员核验并发放一份小礼品</li><li>由工作人员确认，完成领取</li></ol>${r.redeemedAt ? `<p class="redeemed-time">领取时间 ${new Date(r.redeemedAt).toLocaleTimeString('zh-CN')}</p>` : '<p class="ticket-note">请保留当前浏览器记录，截图不作为领取凭证。</p>'}</div></div>
    <div class="reward-actions ${r.redeemedAt ? 'single' : ''}">${r.redeemedAt ? '' : `<button class="primary" data-action="verify">交给工作人员核验 ${icon('arrow')}</button>`}<button class="secondary" data-action="settings">回到森林</button></div><p class="footer-note">礼品以活动现场实际提供为准 · 每台设备每天一份</p></section>`;
}
export function shell(state, content, persistent) {
  return `<div class="app-shell"><header class="app-header"><button class="brand" data-action="settings" aria-label="蘑菇家族，返回首页"><img src="assets/sprout.svg" width="32" height="32" alt=""><span>蘑菇家族</span></button><div class="header-tools"><button class="icon-button" data-action="help" aria-label="游戏玩法说明">${icon('help')}</button></div></header><main id="main">${content}</main>${persistent ? '' : '<p class="storage-warning" role="alert">浏览器未能保存记录，请保持本页打开；领奖前向工作人员说明。</p>'}<footer class="app-bottom">一场属于蘑菇的记忆小冒险</footer></div>`;
}
