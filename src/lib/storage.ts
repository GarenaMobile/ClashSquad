// Penyimpanan preferensi pemain di browser (localStorage), aman dipakai saat SSR.

export type QualityLevel = 'low' | 'medium' | 'high';
export type RaceMode = 'race' | 'trial';
export type AssistLevelSetting = 'easy' | 'normal' | 'pro';

function get(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function set(key: string, value: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* abaikan */
  }
}

export const getPlayerName = () => get('gt2_name') || '';
export const setPlayerName = (v: string) => set('gt2_name', v.slice(0, 20));

export const getCarId = () => get('gt2_car') || 'infiniti';
export const setCarId = (v: string) => set('gt2_car', v);

export const getFlip = (carId: string) => get('gt2_flip_' + carId) === '1';
export const setFlip = (carId: string, v: boolean) => set('gt2_flip_' + carId, v ? '1' : '0');

export function getQuality(): QualityLevel {
  const v = get('gt2_quality');
  if (v === 'low' || v === 'medium' || v === 'high') return v;
  if (typeof navigator !== 'undefined' && (navigator.hardwareConcurrency || 8) <= 4) return 'low';
  return 'medium';
}
export const setQuality = (v: QualityLevel) => set('gt2_quality', v);

export function getMode(): RaceMode {
  return get('gt2_mode') === 'trial' ? 'trial' : 'race';
}
export const setMode = (v: RaceMode) => set('gt2_mode', v);

export function getAssist(): AssistLevelSetting {
  const v = get('gt2_assist');
  return v === 'normal' || v === 'pro' || v === 'easy' ? v : 'easy';
}
export const setAssist = (v: AssistLevelSetting) => set('gt2_assist', v);

export function getLaps(): number {
  const n = parseInt(get('gt2_laps') || '3', 10);
  return n >= 1 && n <= 10 ? n : 3;
}
export const setLaps = (n: number) => set('gt2_laps', String(n));

export function getBestLap(carId: string): number | null {
  const v = get('gt2_best_' + carId);
  return v ? parseInt(v, 10) : null;
}
export const setBestLap = (carId: string, ms: number) => set('gt2_best_' + carId, String(Math.round(ms)));

export type GhostFrames = number[]; // [t(ms), x, z, heading, ...] berulang

export function getGhost(carId: string): { lapMs: number; frames: GhostFrames } | null {
  const raw = get('gt2_ghost_' + carId);
  if (!raw) return null;
  try {
    const o = JSON.parse(raw);
    if (o && typeof o.lapMs === 'number' && Array.isArray(o.frames)) return o;
  } catch {
    /* abaikan */
  }
  return null;
}
export function setGhost(carId: string, lapMs: number, frames: GhostFrames) {
  set('gt2_ghost_' + carId, JSON.stringify({ lapMs, frames }));
}
