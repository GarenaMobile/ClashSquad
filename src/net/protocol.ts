// ====================================================================
// PROTOKOL MULTIPLAYER (tanpa dependensi, bisa diuji di Node)
//
// Room = satu channel Supabase Realtime bernama "gt-room-KODE".
// Tidak ada tabel database untuk room: room hidup selama ada pemain di dalamnya.
// - Presence : hanya untuk tahu siapa yang masuk/keluar (dipakai jarang)
// - Broadcast: semua pesan lain (profil, mulai balapan, posisi mobil, finish)
// ====================================================================

export const MAX_PLAYERS = 8;
export const CODE_LENGTH = 5;
// tanpa karakter yang mudah tertukar (0/O, 1/I/L)
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export type RoomPhase = 'lobby' | 'loading' | 'racing';

export interface PeerInfo {
  id: string;
  name: string;
  joinedAt: number;
}

export interface PlayerInfo extends PeerInfo {
  carId: string;
  ready: boolean;
}

/** Keadaan mobil yang dikirim ~10x per detik. Kunci dipendekkan untuk menghemat data. */
export interface NetState {
  id: string;
  x: number;
  z: number;
  h: number; // heading
  vx: number;
  vz: number;
  al: number; // aLat
  ag: number; // aLong
  sl: number; // slip 0..1
  su: number; // permukaan: 0 aspal, 1 kerb, 2 kerikil
  d: number; // jarak total yang sudah ditempuh (m)
  f: number | null; // waktu finish (ms sejak start) atau null
  n: number; // jumlah garis start/finish yang sudah dilewati
}

export interface FinishInfo {
  id: string;
  totalMs: number;
  lapTimes: number[];
  bestLapMs: number;
}

export interface PrepareInfo {
  laps: number;
  order: string[]; // urutan grid: indeks 0 = pole
  cars: Record<string, string>;
  names: Record<string, string>;
}

export interface GoInfo extends PrepareInfo {
  /** Waktu mulai (ms, jam lokal perangkat ini, Date.now()). */
  startAtLocal: number;
}

export interface RoomSnapshot {
  code: string;
  meId: string;
  hostId: string;
  isHost: boolean;
  phase: RoomPhase;
  laps: number;
  players: PlayerInfo[]; // terurut berdasarkan waktu masuk
  loaded: string[];
  prepare: PrepareInfo | null;
  go: GoInfo | null;
  finishes: Record<string, FinishInfo>;
  clockOffsetMs: number | null;
}

export function makeRoomCode(rand: () => number = Math.random): string {
  let s = '';
  for (let i = 0; i < CODE_LENGTH; i++) s += CODE_ALPHABET[Math.floor(rand() * CODE_ALPHABET.length) % CODE_ALPHABET.length];
  return s;
}

export function normalizeCode(raw: string): string {
  return raw
    .toUpperCase()
    .split('')
    .filter((c) => CODE_ALPHABET.includes(c))
    .join('')
    .slice(0, CODE_LENGTH);
}

export function stateSurfaceCode(s: 'asphalt' | 'kerb' | 'gravel'): number {
  return s === 'asphalt' ? 0 : s === 'kerb' ? 1 : 2;
}
export function surfaceFromCode(n: number): 'asphalt' | 'kerb' | 'gravel' {
  return n === 0 ? 'asphalt' : n === 1 ? 'kerb' : 'gravel';
}
