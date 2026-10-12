// ====================================================================
// SUPABASE: leaderboard waktu balap (tabel lap_times) + Anonymous Auth.
// Jika Supabase belum diatur, game tetap jalan dan menyimpan di browser.
// ====================================================================
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { TRACK_ID } from '../game/track';

// Dua nama variabel kunci diterima: "ANON_KEY" (lama) dan "PUBLISHABLE_KEY" (baru di dashboard Supabase).
// Tiap variabel harus ditulis lengkap seperti ini agar Next.js menyisipkannya ke kode browser.
const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const anon = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '').trim();

/** Mengembalikan alasan jika pengaturan Supabase belum benar, atau null jika terlihat benar. */
export function supabaseConfigProblem(): string | null {
  if (!url && !anon) return 'File .env.local belum diisi (atau server belum dijalankan ulang setelah mengisinya).';
  if (!url) return 'NEXT_PUBLIC_SUPABASE_URL belum diisi.';
  if (!anon) return 'Kunci Supabase belum diisi (NEXT_PUBLIC_SUPABASE_ANON_KEY atau NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).';
  if (/x{6,}/i.test(url) || !/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)\/?$/i.test(url)) {
    return 'NEXT_PUBLIC_SUPABASE_URL masih berisi contoh atau bentuknya salah (seharusnya https://xxxx.supabase.co dengan kode proyekmu).';
  }
  if (anon === 'eyJ...' || anon.length < 20) return 'Kunci Supabase masih berisi contoh atau terlalu pendek.';
  return null;
}

let client: SupabaseClient | null = null;
export function getSupabase(): SupabaseClient | null {
  if (supabaseConfigProblem() !== null) return null;
  if (!client) {
    try {
      client = createClient(url, anon, { realtime: { params: { eventsPerSecond: 30 } } });
    } catch (e) {
      console.warn('Gagal membuat klien Supabase:', e);
    }
  }
  return client;
}

export interface LapTimeEntry {
  id?: string;
  player_id?: string | null;
  player_name: string;
  car_id: string;
  track_id: string;
  total_time_ms: number;
  best_lap_ms: number;
  created_at?: string;
}

const LOCAL_KEY = 'gt2_leaderboard_' + TRACK_ID;
const PLAYER_KEY = 'gt2_player_id';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readLocal(): LapTimeEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeLocal(list: LapTimeEntry[]) {
  try {
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(list.slice(0, 30)));
  } catch {
    /* abaikan */
  }
}

/** ID pemain: dari Anonymous Auth Supabase jika aktif, kalau tidak ID acak di browser. */
export async function getPlayerId(): Promise<string> {
  if (typeof window === 'undefined') return 'server';
  const saved = window.localStorage.getItem(PLAYER_KEY);
  if (saved) return saved;
  const c = getSupabase();
  if (c) {
    try {
      const { data, error } = await c.auth.signInAnonymously();
      if (!error && data?.user?.id) {
        window.localStorage.setItem(PLAYER_KEY, data.user.id);
        return data.user.id;
      }
    } catch {
      /* lanjut ke ID lokal */
    }
  }
  const id = 'local_' + Math.random().toString(36).slice(2, 10);
  window.localStorage.setItem(PLAYER_KEY, id);
  return id;
}

export async function fetchTopLapTimes(): Promise<{ rows: LapTimeEntry[]; online: boolean }> {
  const c = getSupabase();
  if (c) {
    try {
      const { data, error } = await c
        .from('lap_times')
        .select('*')
        .eq('track_id', TRACK_ID)
        .order('total_time_ms', { ascending: true })
        .limit(10);
      if (!error && data) return { rows: data as LapTimeEntry[], online: true };
    } catch {
      /* pakai data lokal */
    }
  }
  const local = readLocal().sort((a, b) => a.total_time_ms - b.total_time_ms).slice(0, 10);
  return { rows: local, online: false };
}

export async function saveLapTime(entry: {
  player_name: string;
  car_id: string;
  total_time_ms: number;
  best_lap_ms: number;
}): Promise<{ online: boolean }> {
  const playerId = await getPlayerId();
  const row: LapTimeEntry = {
    player_id: UUID.test(playerId) ? playerId : null,
    player_name: entry.player_name.slice(0, 24) || 'Pemain',
    car_id: entry.car_id,
    track_id: TRACK_ID,
    total_time_ms: Math.round(entry.total_time_ms),
    best_lap_ms: Math.round(entry.best_lap_ms),
  };
  writeLocal([{ ...row, id: 'local_' + Date.now(), created_at: new Date().toISOString() }, ...readLocal()]);

  const c = getSupabase();
  if (c) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (c.from('lap_times') as any).insert([row]);
      if (!error) return { online: true };
      console.warn('Supabase insert:', error.message);
    } catch (e) {
      console.warn('Gagal mengirim ke Supabase:', e);
    }
  }
  return { online: false };
}

export function subscribeLapTimes(onChange: () => void): () => void {
  const c = getSupabase();
  if (!c) return () => {};
  const ch = c
    .channel('lap_times_live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'lap_times' }, () => onChange())
    .subscribe();
  return () => {
    void c.removeChannel(ch);
  };
}
