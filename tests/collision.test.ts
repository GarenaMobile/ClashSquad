// Tes tabrakan antar mobil: momentum, gesekan, putaran, pemisahan, dan konsistensi multiplayer.
import { CARS } from '../src/lib/cars';
import { newCarState, specFromConfig, type CarState } from '../src/game/physics';
import { collideCars } from '../src/game/collision';

let failed = 0;
function check(name: string, ok: boolean, info = '') {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${name}${info ? '  — ' + info : ''}`);
  if (!ok) failed++;
}
const sp = specFromConfig(CARS[0]);
const MAX_REASONABLE = 3.5;
const mk = (x: number, z: number, h: number, vx: number, vz: number): CarState => {
  const c = newCarState(x, z, h);
  c.vx = vx;
  c.vz = vz;
  return c;
};
const mom = (a: CarState, b: CarState) => [sp.mass * (a.vx + b.vx), sp.mass * (a.vz + b.vz)];
const ke = (a: CarState, b: CarState) => 0.5 * sp.mass * (a.vx ** 2 + a.vz ** 2 + b.vx ** 2 + b.vz ** 2);

// 1) adu muka, kecepatan sama
{
  const a = mk(0, 0, 0, 0, 20); // menuju +Z
  const b = mk(0, 4.4, Math.PI, 0, -20); // menghadap -Z, hidung kedua mobil tumpang tindih 0,3 m
  const m0 = mom(a, b);
  const e0 = ke(a, b);
  const hit = collideCars(a, sp, b, sp, true, true);
  const m1 = mom(a, b);
  check('adu muka: terjadi tumbukan', hit !== null && hit.relSpeed > 30, hit ? `kecepatan relatif ${hit.relSpeed.toFixed(1)} m/s` : 'tidak ada');
  check('adu muka: momentum terjaga', Math.abs(m1[0] - m0[0]) < 1 && Math.abs(m1[1] - m0[1]) < 1);
  check('adu muka: energi berkurang (tidak lenting sempurna)', ke(a, b) < e0 * 0.2, `${((ke(a, b) / e0) * 100).toFixed(0)}% energi tersisa`);
  check('adu muka: mobil saling menjauh', a.vz <= 0.01 && b.vz >= -0.01);
}

// 2) tabrak dari belakang: mobil depan dipercepat, mobil belakang diperlambat
{
  const a = mk(0, 0, 0, 0, 40); // di belakang, cepat
  const b = mk(0, 4.6, 0, 0, 20); // di depan, lambat (bemper bersentuhan)
  const hit = collideCars(a, sp, b, sp, true, true);
  check('tabrak belakang: mobil depan jadi lebih cepat, belakang melambat, lalu saling menjauh', hit !== null && b.vz > 20 && a.vz < 40 && b.vz >= a.vz - 0.01, `depan ${b.vz.toFixed(1)}, belakang ${a.vz.toFixed(1)}`);
}

// 3) gesekan samping: dua mobil berdampingan saling menggesek, tidak tembus
{
  const a = mk(0, 0, 0, 0, 30);
  const b = mk(-1.9, 0, 0, 0, 22); // bagian kanan A bersentuhan dengan B (kanan = -X)
  let scraped = 0;
  for (let i = 0; i < 40; i++) {
    const hit = collideCars(a, sp, b, sp, true, true);
    if (hit) scraped = Math.max(scraped, hit.scrape);
    a.x += a.vx / 120;
    a.z += a.vz / 120;
    b.x += b.vx / 120;
    b.z += b.vz / 120;
    // dorong mobil saling menempel (seolah pengemudi membelok ke samping)
    a.vx -= 0.4;
    b.vx += 0.4;
  }
  const gap = Math.abs(a.x - b.x);
  check('gesekan samping: ada gesekan', scraped > 3, `kecepatan geser maks ${scraped.toFixed(1)} m/s`);
  check('gesekan samping: tidak saling tembus', gap > 1.9, `jarak ${gap.toFixed(2)} m`);
  check('gesekan samping: mobil cepat melambat, mobil lambat tertarik', a.vz < 30 && b.vz > 22, `A ${a.vz.toFixed(1)}, B ${b.vz.toFixed(1)} m/s`);
}

// 4) menyerempet halangan di sisi depan: hidung mobil terdorong menjauhi halangan
{
  const a = mk(0, 0, 0, 0, 20); // menuju +Z
  const obstacle = mk(1.3, 3.8, 0, 0, 0); // mobil diam di depan-KIRI A (kiri = +X), bemper depannya mengenai hidung A
  const h1 = collideCars(a, sp, obstacle, sp, true, false);
  check('halangan di depan-kiri: hidung terdorong ke kanan (menjauh)', h1 !== null && a.yawKick < -0.05, `yawKick ${a.yawKick.toFixed(2)} rad/s`);
  const a2 = mk(0, 0, 0, 0, 20);
  const obstacle2 = mk(-1.3, 3.8, 0, 0, 0); // di depan-KANAN A
  collideCars(a2, sp, obstacle2, sp, true, false);
  check('halangan di depan-kanan: hidung terdorong ke kiri (menjauh)', a2.yawKick > 0.05, `yawKick ${a2.yawKick.toFixed(2)} rad/s`);
  check('putaran akibat tabrakan masuk akal (tidak berlebihan)', Math.abs(a.yawKick) < MAX_REASONABLE, `${Math.abs(a.yawKick).toFixed(2)} rad/s`);
}

// 5) tumpang tindih diselesaikan
{
  const a = mk(0, 0, 0, 0, 0);
  const b = mk(0.8, 1.5, 0.3, 0, 0);
  let n = 0;
  let depth = 1;
  while (n < 200) {
    const h = collideCars(a, sp, b, sp, true, true);
    depth = h ? h.depth : 0;
    if (depth < 0.02) break;
    n++;
  }
  check('tumpang tindih terpisah', n < 200 && depth < 0.02, `${n} langkah, sisa tembus ${depth.toFixed(3)} m`);
}

// 6) multiplayer: tiap perangkat hanya menggerakkan mobilnya sendiri, hasil gabungannya sama dengan perhitungan penuh
{
  const full = [mk(0, 0, 0, 0, 40), mk(0.6, 4.3, 0.1, 0, 20)];
  const devA = [mk(0, 0, 0, 0, 40), mk(0.6, 4.3, 0.1, 0, 20)];
  const devB = [mk(0, 0, 0, 0, 40), mk(0.6, 4.3, 0.1, 0, 20)];
  const hFull = collideCars(full[0], sp, full[1], sp, true, true);
  collideCars(devA[0], sp, devA[1], sp, true, false); // perangkat A hanya menggerakkan A
  collideCars(devB[0], sp, devB[1], sp, false, true); // perangkat B hanya menggerakkan B
  check('multiplayer: tumbukan terjadi pada kasus uji', hFull !== null && hFull.relSpeed > 15);
  const same =
    Math.abs(devA[0].vz - full[0].vz) < 1e-9 &&
    Math.abs(devB[1].vz - full[1].vz) < 1e-9 &&
    Math.abs(devA[0].x - full[0].x) < 1e-9 &&
    Math.abs(devB[1].x - full[1].x) < 1e-9 &&
    Math.abs(devA[0].yawKick - full[0].yawKick) < 1e-9 &&
    Math.abs(devB[1].yawKick - full[1].yawKick) < 1e-9;
  check('multiplayer: hasil dua perangkat sama dengan perhitungan penuh', same);
}

// 7) tidak ada tabrakan jika berjauhan / berdampingan dengan jarak
{
  const a = mk(0, 0, 0, 0, 20);
  const b = mk(3.5, 0, 0, 0, 20);
  check('mobil berdampingan dengan jarak tidak bertabrakan', collideCars(a, sp, b, sp, true, true) === null);
}

console.log(failed === 0 ? '\nSEMUA TES TABRAKAN LULUS' : `\n${failed} TES GAGAL`);
process.exit(failed === 0 ? 0 : 1);
