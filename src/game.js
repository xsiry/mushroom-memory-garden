export const mushrooms = Object.freeze([
  { id: 'pink-ear', name: '粉木耳', note: '像一条粉色小裙子', color: 'pink' },
  { id: 'slippery', name: '滑子菇', note: '一群戴着棕帽子的小伙伴', color: 'sand' },
  { id: 'golden-ear', name: '金耳菌', note: '金灿灿的卷卷小云朵', color: 'yellow' },
  { id: 'matsutake', name: '赤松茸', note: '圆圆棕帽，胖胖身体', color: 'sand' },
  { id: 'termite', name: '黑皮鸡枞', note: '戴着尖帽子的高个子', color: 'sage' },
  { id: 'golden-oyster', name: '榆黄菇', note: '撑开一簇金黄色小伞', color: 'yellow' },
  { id: 'lions-mane', name: '猴头菇', note: '毛茸茸的白色小团子', color: 'sage' },
]);
export const ids = mushrooms.map(m => m.id);
export const counts = [3, 4, 5, 6, 7];
export const durations = [3, 5, 8, 10, 15];
export function shuffled(items, random = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export function scrambled(sequence) {
  const result = shuffled(sequence);
  if (sameOrder(result, sequence)) result.push(result.shift());
  return result;
}
export function sameOrder(a, b) { return a.length === b.length && a.every((id, i) => id === b[i]); }
export function newRound(settings) {
  const sequence = shuffled(ids).slice(0, settings.count);
  return { sequence, choices: scrambled(sequence), selected: [], remaining: settings.seconds * 1000, phase: 'memory', paused: false, result: null };
}
export function toggleSelection(selected, id) {
  return selected.includes(id) ? selected.filter(item => item !== id) : [...selected, id];
}
export function localDay(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function rewardForWin(previous, day = localDay()) {
  if (previous?.day === day) return previous;
  const bytes = crypto.getRandomValues(new Uint8Array(5));
  const code = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  return { day, code, redeemedAt: null };
}
export function validRound(r) {
  if (!r || !['memory', 'sort', 'result'].includes(r.phase)) return false;
  const validList = a => Array.isArray(a) && a.every(id => ids.includes(id)) && new Set(a).size === a.length;
  return validList(r.sequence) && r.sequence.length >= 3 && r.sequence.length <= 7 && validList(r.choices)
    && r.choices.length === r.sequence.length && r.choices.every(id => r.sequence.includes(id))
    && validList(r.selected) && r.selected.every(id => r.sequence.includes(id))
    && Number.isFinite(r.remaining) && r.remaining >= 0 && r.remaining <= 15000
    && typeof r.paused === 'boolean' && [null, true, false].includes(r.result)
    && (r.phase !== 'result' || (r.result !== null && r.selected.length === r.sequence.length && r.result === sameOrder(r.sequence, r.selected)));
}
