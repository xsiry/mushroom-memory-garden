import { mushrooms, counts, durations, newRound, scrambled, toggleSelection, sameOrder, rewardForWin, localDay } from './game.js';
import { loadState, saveState } from './storage.js';
import { shell, home, game, result, reward, picture } from './views.js';
import { help, collection, share, confirmLeave, verify } from './dialogs.js';
import { icon } from './icons.js';
const app = document.querySelector('#app');
const fxLayer = document.querySelector('#fx-layer');
const loaded = loadState();
let state = loaded.state;
let persistent = loaded.persistent;
let screen = state.round ? state.round.phase : 'home';
let ready = false;
let lastTick = performance.now();
let lastPersist = performance.now();
let audio;
let loadAttempt = 0;
function persist() { persistent = saveState(state) && persistent; }
function announce(text) { document.querySelector('#announcement').textContent = text; }
function render(focus = false) {
  let content;
  switch (screen) {
    case 'home': content = home(state); break;
    case 'memory': case 'sort': content = game(state); break;
    case 'result': content = result(state); break;
    case 'reward': content = reward(state); break;
    default: throw new Error(`未知页面 ${screen}`);
  }
  app.innerHTML = shell(state, content, persistent);
  if (focus) { document.querySelector('h1')?.focus({ preventScroll: true }); window.scrollTo(0, 0); }
}
function sound(type = 'tap', step = 0) {
  if (!state.sound) return;
  try {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    audio ??= new Audio();
    void audio.resume();
    const now = audio.currentTime;
    const playTone = (freq, endFreq, startOffset, duration, vol = 0.035) => {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + startOffset);
      if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, now + startOffset + duration * 0.7);
      gain.gain.setValueAtTime(vol, now + startOffset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + startOffset + duration);
      osc.connect(gain);
      gain.connect(audio.destination);
      osc.start(now + startOffset);
      osc.stop(now + startOffset + duration + 0.02);
    };
    if (type === true || type === 'win') {
      playTone(523.25, 659.25, 0, 0.14, 0.04);
      playTone(659.25, 783.99, 0.09, 0.14, 0.04);
      playTone(783.99, 1046.5, 0.18, 0.24, 0.045);
    } else if (type === 'lose') {
      playTone(440, 392, 0, 0.15, 0.03);
      playTone(392, 329.63, 0.12, 0.22, 0.03);
    } else if (type === 'unpick') {
      playTone(520, 380, 0, 0.14, 0.03);
    } else {
      const scale = [440, 493.88, 523.25, 587.33, 659.25, 698.46, 783.99];
      const base = scale[step % scale.length];
      playTone(base, base * 1.22, 0, 0.16, 0.035);
    }
  } catch (error) { if (!(error instanceof DOMException)) throw error; }
}
function spawnSparkles(x, y, positive = true) {
  if (!fxLayer || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  if (!x && !y) return;
  const glyphs = positive ? ['✦\uFE0E', '★\uFE0E', '✿\uFE0E', '•'] : ['•', '✦\uFE0E'];
  const colors = positive ? ['#446b47', '#e5a93c', '#e07a5f', '#7ca982'] : ['#b56d47', '#974e3e'];
  for (let i = 0; i < 6; i++) {
    const node = document.createElement('span');
    node.className = 'tap-spark';
    node.textContent = glyphs[i % glyphs.length];
    const angle = (Math.PI * 2 * i) / 6 + (Math.random() - 0.5) * 0.4;
    const dist = 26 + Math.random() * 24;
    node.style.left = `${x}px`;
    node.style.top = `${y}px`;
    node.style.color = colors[i % colors.length];
    node.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
    node.style.setProperty('--dy', `${Math.sin(angle) * dist - 10}px`);
    fxLayer.appendChild(node);
    setTimeout(() => node.remove(), 620);
  }
}
function updateSortUI() {
  const r = state.round;
  if (!r || r.phase !== 'sort') return;
  const countNode = app.querySelector('#selected-num');
  if (countNode) countNode.textContent = String(r.selected.length);
  const slots = app.querySelectorAll('.sequence-slots > span');
  slots.forEach((slot, i) => {
    const id = r.selected[i];
    if (id) {
      const m = mushrooms.find(item => item.id === id);
      if (slot.dataset.filledId !== id) {
        slot.className = 'filled slot-pop';
        slot.dataset.filledId = id;
        slot.innerHTML = `<img src="${picture(id)}" alt="第${i + 1}位${m.name}" decoding="async">`;
      }
    } else {
      slot.className = '';
      delete slot.dataset.filledId;
      slot.textContent = String(i + 1);
    }
  });
  const cards = app.querySelectorAll('button.mushroom-card[data-pick]');
  cards.forEach(btn => {
    const id = btn.dataset.pick;
    const idx = r.selected.indexOf(id);
    const isSelected = idx !== -1;
    btn.classList.toggle('selected', isSelected);
    btn.setAttribute('aria-pressed', String(isSelected));
    const numEl = btn.querySelector('.card-number');
    if (numEl) {
      numEl.textContent = isSelected ? String(idx + 1) : '';
      numEl.classList.toggle('empty-number', !isSelected);
    }
    let checkEl = btn.querySelector('.card-check');
    if (isSelected && !checkEl) {
      btn.insertAdjacentHTML('beforeend', `<span class="card-check">${icon('check')}</span>`);
    } else if (!isSelected && checkEl) {
      checkEl.remove();
    }
  });
  const undoBtn = app.querySelector('[data-action="undo"]');
  if (undoBtn) undoBtn.disabled = r.selected.length === 0;
  const submitBtn = app.querySelector('[data-action="submit"]');
  if (submitBtn) {
    const readySubmit = r.selected.length === r.sequence.length;
    submitBtn.disabled = !readySubmit;
    submitBtn.classList.toggle('ready-pulse', readySubmit);
  }
}
function showMemory(round) {
  state.round = round; screen = 'memory'; lastTick = performance.now(); persist(); render(true);
}
function goHome() {
  const leave = () => { state.round = null; screen = 'home'; persist(); render(true); };
  if (state.round && ['memory', 'sort'].includes(screen)) { pause(); confirmLeave(leave); } else leave();
}
function pause() {
  if (!ready || state.round?.phase !== 'memory' || state.round.paused) return;
  const focusedAction = document.activeElement?.getAttribute('data-action');
  tick();
  if (state.round.phase === 'memory') {
    state.round.paused = true; persist(); render();
    if (focusedAction) app.querySelector(`[data-action="${focusedAction}"]`)?.focus({ preventScroll: true });
  }
}
function tick() {
  const now = performance.now(); const elapsed = now - lastTick; lastTick = now;
  if (!ready || state.round?.phase !== 'memory' || state.round.paused) return;
  const r = state.round; r.remaining = Math.max(0, r.remaining - elapsed);
  const sec = Math.ceil(r.remaining / 1000);
  const urgent = sec <= 3;
  const number = document.querySelector('#seconds');
  if (number && number.textContent !== String(sec)) {
    number.textContent = String(sec);
    number.closest('.countdown')?.classList.toggle('urgent', urgent);
  }
  const progress = Math.max(0, Math.min(1, r.remaining / (state.settings.seconds * 1000)));
  const fill = document.querySelector('#time-fill');
  if (fill) {
    fill.style.transform = `scaleX(${progress})`;
    const track = fill.parentElement;
    if (track) {
      track.style.setProperty('--p', String(progress));
      track.classList.toggle('urgent', urgent);
    }
  }
  if (r.remaining === 0) { r.phase = 'sort'; screen = 'sort'; persist(); render(true); announce('记忆结束，请按顺序点击蘑菇。'); }
}
function submit() {
  const r = state.round;
  if (r?.phase !== 'sort' || r.selected.length !== r.sequence.length) return;
  r.result = sameOrder(r.sequence, r.selected); r.phase = 'result'; screen = 'result';
  if (r.result) {
    state.wins++;
    const current = loadState().state.reward;
    state.reward = rewardForWin(current?.day === localDay() ? current : state.reward);
    sound('win');
  } else {
    sound('lose');
  }
  persist(); render(true); announce(r.result ? '恭喜你，闯关成功！' : '差一点点，再试一次吧。');
}
function closeTimeMenu(focusTrigger = false) {
  const menu = app.querySelector('#time-menu');
  const trigger = app.querySelector('#memory-time-trigger');
  if (!menu || menu.hidden) return;
  menu.hidden = true;
  trigger?.setAttribute('aria-expanded', 'false');
  trigger?.closest('.time-select')?.classList.remove('open');
  if (focusTrigger) trigger?.focus({ preventScroll: true });
}
const actions = {
  start: () => { sound('tap', 2); showMemory(newRound(state.settings)); },
  new: () => showMemory(newRound(state.settings)),
  retry: () => { if (state.round) showMemory({ ...state.round, selected: [], remaining: state.settings.seconds * 1000, choices: scrambled(state.round.sequence), phase: 'memory', paused: false, result: null }); },
  resume: () => { if (state.round?.phase === 'memory') { state.round.paused = false; lastTick = performance.now(); persist(); render(); } },
  settings: goHome,
  undo: () => { if (state.round?.phase === 'sort') { state.round.selected.pop(); sound('unpick'); persist(); updateSortUI(); } },
  submit,
  help: () => { pause(); help(); },
  collection,
  qr: share,
  reward: () => { pause(); screen = 'reward'; render(true); },
  sound: () => { state.sound = !state.sound; persist(); render(); },
  'toggle-time': () => {
    const menu = app.querySelector('#time-menu');
    const trigger = app.querySelector('#memory-time-trigger');
    if (!menu || !trigger) return;
    const opening = menu.hidden;
    menu.hidden = !opening;
    trigger.setAttribute('aria-expanded', String(opening));
    trigger.closest('.time-select')?.classList.toggle('open', opening);
    sound('tap', opening ? 3 : 1);
  },
  verify: () => {
    if (state.reward?.day !== localDay() || state.reward.redeemedAt) { render(); return; }
    verify(state.reward, () => {
      const saved = loadState().state.reward;
      if (saved?.code === state.reward.code && saved.redeemedAt) state.reward = saved;
      if (state.reward.day === localDay() && !state.reward.redeemedAt) state.reward.redeemedAt = new Date().toISOString();
      sound('win'); persist(); render(true);
    });
  },
};
app.addEventListener('click', event => {
  if (!event.target.closest('#time-select')) closeTimeMenu();
  const friend = event.target.closest('.friend[data-greet]');
  if (friend && screen === 'home') {
    friend.classList.remove('friend-bounce');
    void friend.offsetWidth;
    friend.classList.add('friend-bounce');
    friend.addEventListener('animationend', () => {
      friend.classList.remove('friend-bounce');
    }, { once: true });
    const bubble = app.querySelector('#garden-bubble');
    if (bubble) {
      bubble.textContent = friend.dataset.greet;
      bubble.classList.remove('bubble-pop');
      void bubble.offsetWidth;
      bubble.classList.add('bubble-pop');
    }
    sound('tap', 4);
    spawnSparkles(event.clientX, event.clientY, true);
    return;
  }
  const button = event.target.closest('button');
  if (!button || button.disabled || !ready) return;
  if (button.dataset.seconds) {
    const seconds = Number(button.dataset.seconds);
    if (screen === 'home' && durations.includes(seconds)) {
      state.settings.seconds = seconds;
      sound('tap', durations.indexOf(seconds) + 1);
      persist();
      const valNode = app.querySelector('#memory-time-value');
      if (valNode) valNode.textContent = `${seconds} 秒`;
      app.querySelectorAll('.time-option').forEach(opt => {
        const active = Number(opt.dataset.seconds) === seconds;
        opt.classList.toggle('active', active);
        opt.setAttribute('aria-selected', String(active));
        const check = opt.querySelector('svg');
        if (active && !check) opt.insertAdjacentHTML('beforeend', icon('check'));
        else if (!active && check) check.remove();
      });
      closeTimeMenu(true);
      spawnSparkles(event.clientX, event.clientY, true);
    }
    return;
  }
  if (button.dataset.count) {
    const count = Number(button.dataset.count);
    if (screen === 'home' && counts.includes(count)) {
      state.settings.count = count;
      sound('tap', count - 3);
      persist();
      app.querySelectorAll('.number-picker button').forEach(btn => {
        const active = Number(btn.dataset.count) === count;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-pressed', String(active));
      });
      spawnSparkles(event.clientX, event.clientY, true);
    }
    return;
  }
  if (button.dataset.pick && state.round?.phase === 'sort') {
    const id = button.dataset.pick;
    if (!state.round.choices.includes(id)) return;
    const wasSelected = state.round.selected.includes(id);
    state.round.selected = toggleSelection(state.round.selected, id);
    sound(wasSelected ? 'unpick' : 'tap', state.round.selected.length);
    persist();
    updateSortUI();
    spawnSparkles(event.clientX, event.clientY, !wasSelected);
    announce(`已选 ${state.round.selected.length} 位伙伴，共 ${state.round.sequence.length} 位。`); return;
  }
  const action = actions[button.dataset.action];
  if (action) {
    spawnSparkles(event.clientX, event.clientY, true);
    action();
  }
});
document.addEventListener('click', event => { if (!event.target.closest('#time-select')) closeTimeMenu(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeTimeMenu(true); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { pause(); void audio?.suspend(); } });
window.addEventListener('pagehide', () => { pause(); persist(); });
window.addEventListener('storage', event => {
  if (event.key === 'mushroom-garden-v1') { state.reward = loadState().state.reward; if (screen === 'reward') render(); }
});
setInterval(() => {
  if (!ready) return;
  tick();
  const now = performance.now();
  if (state.round?.phase === 'memory' && !state.round.paused && now - lastPersist >= 500) {
    lastPersist = now;
    persist();
  }
}, 100);
async function boot() {
  const attempt = ++loadAttempt; let completed = 0;
  app.innerHTML = `<main class="boot"><div class="boot-friend"><img src="assets/sprout.svg" alt="小蘑菇正在准备" width="112" height="112"></div><span class="little-label">欢迎来到蘑菇的小森林</span><h1>蘑菇家族<span>记忆排序</span></h1><p role="status" id="load-status">正在唤醒小伙伴… 0 / 7</p><div class="load-track" style="--p:0"><div id="load-progress"></div><span class="track-runner" aria-hidden="true"></span></div></main>`;
  try {
    await Promise.all(mushrooms.map(m => new Promise((resolve, reject) => {
      const img = new Image(); const timeout = setTimeout(() => reject(new Error('图片加载超时')), 15000);
      img.onload = () => {
        clearTimeout(timeout); completed++;
        if (attempt === loadAttempt) {
          const p = completed / 7;
          document.querySelector('#load-status').textContent = `正在唤醒小伙伴… ${completed} / 7`;
          const prog = document.querySelector('#load-progress');
          if (prog) { prog.style.transform = `scaleX(${p})`; prog.parentElement?.style.setProperty('--p', String(p)); }
        }
        resolve();
      };
      img.onerror = () => { clearTimeout(timeout); reject(new Error('图片加载失败')); }; img.src = picture(m.id);
    })));
    ready = true; lastTick = performance.now(); render();
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    loadAttempt++;
    app.innerHTML = '<main class="boot"><img src="assets/sprout.svg" width="88" height="88" alt=""><h1>小伙伴还没到齐</h1><p>图片暂时没有加载成功，请检查网络后再试。</p><button class="primary" id="reload-assets">重新加载</button></main>';
    document.querySelector('#reload-assets').addEventListener('click', boot, { once: true });
  }
}
void boot();
