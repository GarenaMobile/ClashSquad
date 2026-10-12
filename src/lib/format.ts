export function formatTime(ms: number | null | undefined): string {
  if (ms == null || !isFinite(ms) || ms < 0) return '--:--.---';
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const r = Math.floor(ms % 1000);
  return `${m}:${String(s).padStart(2, '0')}.${String(r).padStart(3, '0')}`;
}

export function formatDelta(ms: number): string {
  const sign = ms >= 0 ? '+' : '-';
  const a = Math.abs(ms) / 1000;
  return `${sign}${a.toFixed(3)}`;
}
