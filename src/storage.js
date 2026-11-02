import { counts, durations, validRound } from './game.js';
const key = 'mushroom-garden-v1';
export function emptyState() { return { settings: { count: 3, seconds: 8 }, round: null, reward: null, wins: 0, sound: true }; }
export function loadState(storage) {
  try {
    const target = storage ?? globalThis.localStorage;
    const value = target.getItem(key);
    if (!value) return { state: emptyState(), persistent: true };
    const data = JSON.parse(value);
    if (!data || !counts.includes(data.settings?.count) || !durations.includes(data.settings?.seconds)) return { state: emptyState(), persistent: true };
    const reward = data.reward;
    const validReward = reward && /^\d{4}-\d{2}-\d{2}$/.test(reward.day) && /^[A-F0-9]{10}$/.test(reward.code)
      && (reward.redeemedAt === null || (typeof reward.redeemedAt === 'string' && Number.isFinite(Date.parse(reward.redeemedAt))));
    const state = {
      settings: data.settings,
      round: validRound(data.round) ? data.round : null,
      reward: validReward ? reward : null,
      wins: Number.isSafeInteger(data.wins) && data.wins >= 0 ? data.wins : 0,
      sound: typeof data.sound === 'boolean' ? data.sound : true,
    };
    if (state.round?.phase === 'memory') state.round.paused = true;
    return { state, persistent: true };
  } catch (error) {
    if (error instanceof SyntaxError) return { state: emptyState(), persistent: true };
    if (error instanceof DOMException) return { state: emptyState(), persistent: false };
    throw error;
  }
}
export function saveState(state, storage) {
  try { const target = storage ?? globalThis.localStorage; target.setItem(key, JSON.stringify(state)); return true; }
  catch (error) { if (error instanceof DOMException) return false; throw error; }
}
