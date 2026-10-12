// Tes multiplayer tanpa jaringan: beberapa "pemain" di memori dengan jam perangkat yang sengaja berbeda.
import { MemoryHub } from '../src/net/transport';
import { RoomSession, RoomError } from '../src/net/session';
import { CODE_ALPHABET, makeRoomCode, normalizeCode, type RoomSnapshot } from '../src/net/protocol';

let failed = 0;
function check(name: string, ok: boolean, info = '') {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${name}${info ? '  — ' + info : ''}`);
  if (!ok) failed++;
}
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
async function until(cond: () => boolean, ms = 4000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (cond()) return true;
    await sleep(25);
  }
  return cond();
}

function player(hub: MemoryHub, id: string, name: string, skewMs: number, latency = 40) {
  const s = new RoomSession(hub.create(latency), { id, name }, { now: () => Date.now() + skewMs });
  let snap: RoomSnapshot = s.snapshot();
  s.onUpdate((x) => (snap = x));
  return { s, snap: () => snap, skew: skewMs };
}

async function main() {
  // --- kode room ---
  const codes = new Set<string>();
  let badChar = false;
  for (let i = 0; i < 500; i++) {
    const c = makeRoomCode();
    codes.add(c);
    if ([...c].some((ch) => !CODE_ALPHABET.includes(ch)) || c.length !== 5) badChar = true;
  }
  check('kode room 5 karakter, tanpa karakter membingungkan', !badChar && !/[01OIL]/.test([...codes].join('')));
  check('kode room acak (500 kode, hampir semua unik)', codes.size > 495, `${codes.size} unik`);
  check('normalizeCode merapikan input', normalizeCode(' ab-c d2x9 ') === 'ABCD2');

  // --- satu room, 3 pemain ---
  const hub = new MemoryHub();
  const A = player(hub, 'A', 'Reyy', 0);
  const B = player(hub, 'B', 'Dimas', 5000);
  const C = player(hub, 'C', 'Sari', -3000);

  const code = await A.s.create();
  check('pembuat room mendapat kode 5 karakter', code.length === 5, code);
  await B.s.join(code.toLowerCase());
  await sleep(120);
  await C.s.join(code);
  await until(() => A.snap().players.length === 3 && C.snap().players.length === 3);
  check('3 pemain saling melihat', [A, B, C].every((p) => p.snap().players.length === 3));
  check('host = pembuat room di semua pemain', [A, B, C].every((p) => p.snap().hostId === 'A') && A.snap().isHost && !B.snap().isHost);

  B.s.setProfile({ carId: 'bmw', ready: true });
  C.s.setProfile({ carId: 'mclaren', ready: true });
  await until(() => A.snap().players.find((p) => p.id === 'B')?.carId === 'bmw' && A.snap().players.find((p) => p.id === 'C')?.ready === true);
  const bAtA = A.snap().players.find((p) => p.id === 'B')!;
  check('profil (mobil & siap) tersinkron ke host', bAtA.carId === 'bmw' && bAtA.ready);
  check('pemain yang baru masuk tetap menerima profil pemain lama', C.snap().players.find((p) => p.id === 'B')?.carId === 'bmw');

  B.s.setLaps(5);
  check('hanya host yang bisa mengubah jumlah lap', A.snap().laps === 3);
  A.s.setLaps(2);
  await until(() => B.snap().laps === 2 && C.snap().laps === 2);
  check('jumlah lap dari host sampai ke semua pemain', B.snap().laps === 2 && C.snap().laps === 2);
  check('non-host tidak bisa memulai balapan', B.s.start() === false);

  // --- mulai balapan ---
  A.s.setProfile({ carId: 'infiniti', ready: true });
  check('host memulai balapan', A.s.start() === true);
  await until(() => B.snap().phase === 'loading' && C.snap().phase === 'loading');
  check('semua pemain masuk fase memuat dengan urutan grid yang sama', [A, B, C].every((p) => p.snap().prepare?.order.join() === 'A,B,C'));
  check('pilihan mobil tiap pemain ikut terkirim', C.snap().prepare?.cars['C'] === 'mclaren' && C.snap().prepare?.cars['B'] === 'bmw');

  A.s.markLoaded();
  B.s.markLoaded();
  await sleep(300);
  check('belum mulai selama masih ada pemain yang memuat', A.snap().phase === 'loading' && A.snap().go === null);
  C.s.markLoaded();
  await until(() => [A, B, C].every((p) => p.snap().phase === 'racing' && p.snap().go !== null));
  check('semua pemain masuk fase balapan', [A, B, C].every((p) => p.snap().phase === 'racing'));
  const startsAbs = [A, B, C].map((p) => p.snap().go!.startAtLocal - p.skew);
  const spread = Math.max(...startsAbs) - Math.min(...startsAbs);
  check('hitung mundur serempak walau jam perangkat beda 5 detik', spread < 120, `selisih ${spread.toFixed(0)} ms (jam B +5000 ms, jam C -3000 ms)`);
  const lead = startsAbs[0] - Date.now();
  check('waktu mulai ada di depan (cukup untuk hitung mundur)', lead > 2500 && lead < 4200, `${lead.toFixed(0)} ms lagi`);

  // --- selama balapan ---
  const gotB: unknown[] = [];
  const gotC: unknown[] = [];
  B.s.onRemoteState((s) => gotB.push(s));
  C.s.onRemoteState((s) => gotC.push(s));
  A.s.sendState({ id: 'A', x: 1, z: 2, h: 0.5, vx: 3, vz: 4, al: 0, ag: 0, sl: 0, su: 0, d: 10, f: null, n: 0 });
  await until(() => gotB.length > 0 && gotC.length > 0);
  check('posisi mobil sampai ke pemain lain', gotB.length === 1 && gotC.length === 1);

  A.s.reportFinish({ id: 'A', totalMs: 150000, lapTimes: [75000, 75000], bestLapMs: 75000 });
  await until(() => B.snap().finishes['A'] !== undefined);
  check('waktu finish tersiar ke semua pemain', B.snap().finishes['A']?.totalMs === 150000 && C.snap().finishes['A'] !== undefined);

  // --- host keluar: pemain tertua berikutnya jadi host ---
  A.s.leave();
  await until(() => B.snap().hostId === 'B' && C.snap().hostId === 'B');
  check('host keluar → pemain tertua berikutnya jadi host', B.snap().isHost && C.snap().hostId === 'B' && B.snap().players.length === 2);

  B.s.backToLobby();
  await until(() => C.snap().phase === 'lobby');
  check('host baru bisa mengembalikan semua ke lobby', C.snap().phase === 'lobby' && C.snap().go === null && Object.keys(C.snap().finishes).length === 0);

  // --- error ---
  const D = player(hub, 'D', 'Tamu', 0);
  let kind = '';
  try {
    await D.s.join('ZZZZZ');
  } catch (e) {
    kind = e instanceof RoomError ? e.kind : 'lain';
  }
  check('kode yang salah → "room tidak ditemukan"', kind === 'not_found');

  // room sedang balapan tidak bisa dimasuki
  const hub2 = new MemoryHub();
  const H = player(hub2, 'H', 'Host', 0);
  const P = player(hub2, 'P', 'Pemain', 0);
  const code2 = await H.s.create();
  await P.s.join(code2);
  H.s.start();
  await until(() => P.snap().phase === 'loading');
  H.s.markLoaded();
  P.s.markLoaded();
  await until(() => H.snap().phase === 'racing');
  const L = player(hub2, 'L', 'Telat', 0);
  kind = '';
  try {
    await L.s.join(code2);
  } catch (e) {
    kind = e instanceof RoomError ? e.kind : 'lain';
  }
  check('masuk saat balapan berjalan → ditolak', kind === 'in_race');

  // room penuh
  const hub3 = new MemoryHub();
  const crowd = Array.from({ length: 9 }, (_, i) => player(hub3, 'p' + i, 'P' + i, 0, 5));
  const code3 = await crowd[0].s.create();
  for (let i = 1; i < 8; i++) await crowd[i].s.join(code3);
  await until(() => crowd[0].snap().players.length === 8);
  kind = '';
  try {
    await crowd[8].s.join(code3);
  } catch (e) {
    kind = e instanceof RoomError ? e.kind : 'lain';
  }
  await until(() => crowd[0].snap().players.length === 8);
  check('room maksimal 8 pemain', crowd[0].snap().players.length === 8 && kind === 'full', `pemain ke-9: ${kind}`);

  for (const p of [B, C, D, H, P, L, ...crowd]) p.s.leave();
  console.log(failed === 0 ? '\nSEMUA TES MULTIPLAYER LULUS' : `\n${failed} TES GAGAL`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
