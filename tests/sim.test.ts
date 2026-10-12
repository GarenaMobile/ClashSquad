// Tes logika inti (tanpa browser): arah belok, performa mobil, dan kelayakan sirkuit.
import { CARS } from '../src/lib/cars';
import { getTrack, newLocation, type Track } from '../src/game/track';
import { FIXED_DT, newCarState, newControls, placeCar, specFromConfig, stepCar } from '../src/game/physics';
import { simulateRace } from '../src/game/ai';
import { minBrakeDistance } from './corner_probe';

let failed = 0;
function check(name: string, ok: boolean, info = '') {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${name}${info ? '  — ' + info : ''}`);
  if (!ok) failed++;
}

// Lintasan palsu tanpa dinding, untuk menguji fisika murni.
const flat = {
  n: 10,
  length: 1e6,
  samples: [],
  locate(px: number, pz: number, _h: number, out = newLocation()) {
    out.i = 0; out.s = 0; out.d = 0; out.cx = px; out.cz = pz; out.tx = 0; out.tz = 1; out.rx = -1; out.rz = 0; out.dist = 0;
    return out;
  },
  surface() { return 'asphalt' as const; },
} as unknown as Track;

const track = getTrack();

// 1) ARAH BELOK untuk semua mobil
for (const cfg of CARS) {
  const spec = specFromConfig(cfg);
  for (const dir of [+1, -1]) {
    const c = newCarState(0, 0, 0);
    c.vz = 25; // maju ke +Z
    const ctl = newControls();
    ctl.throttle = 0.3;
    ctl.steer = dir; // +1 kanan, -1 kiri
    for (let i = 0; i < 120 * 1.5; i++) stepCar(c, spec, ctl, FIXED_DT, flat);
    // sisi kanan pengemudi saat menghadap +Z adalah -X
    const rightOffset = c.x * -1;
    const turnedRight = dir > 0 ? rightOffset > 1 && c.heading < 0 : rightOffset < -1 && c.heading > 0;
    check(`belok ${dir > 0 ? 'KANAN' : 'KIRI'} benar (${cfg.id})`, turnedRight, `x=${c.x.toFixed(1)} heading=${c.heading.toFixed(2)}`);
  }
}

// 2) PERFORMA: 0-100 km/h, kecepatan puncak, pengereman
for (const cfg of CARS) {
  const spec = specFromConfig(cfg);
  const c = newCarState(0, 0, 0);
  const ctl = newControls();
  ctl.throttle = 1;
  let t = 0, t100 = -1;
  for (let i = 0; i < 120 * 90; i++) {
    stepCar(c, spec, ctl, FIXED_DT, flat);
    t += FIXED_DT;
    if (t100 < 0 && c.speed * 3.6 >= 100) t100 = t;
  }
  const top = c.speed * 3.6;
  check(`0-100 km/h ${cfg.id}`, Math.abs(t100 - cfg.stats.accel0to100) / cfg.stats.accel0to100 < 0.2, `${t100.toFixed(2)} dtk (target ${cfg.stats.accel0to100})`);
  check(`kecepatan puncak ${cfg.id}`, top > cfg.stats.topSpeedKmH * 0.95 && top <= cfg.stats.topSpeedKmH * 1.01, `${top.toFixed(0)} km/h (target ${cfg.stats.topSpeedKmH})`);

  const b = newCarState(0, 0, 0);
  b.vz = 200 / 3.6;
  b.speed = b.vz;
  const bc = newControls();
  bc.brake = 1;
  let bt = 0, dist = 0;
  while (b.speed > 0.5 && bt < 20) { stepCar(b, spec, bc, FIXED_DT, flat); bt += FIXED_DT; dist += b.speed * FIXED_DT; }
  check(`rem 200→0 km/h ${cfg.id}`, bt > 2.0 && bt < 5.0, `${bt.toFixed(1)} dtk, ${dist.toFixed(0)} m`);
}

// 2b) RESPONS BELOK: kemudi harus cepat dan tidak perlu melepas gas
for (const cfg of CARS) {
  const spec = specFromConfig(cfg);
  const run = (kmh: number, throttle: number, steps: number) => {
    const c = newCarState(0, 0, 0);
    c.vz = kmh / 3.6;
    c.speed = c.vz;
    const ctl = newControls();
    ctl.throttle = throttle;
    ctl.steer = 1;
    const yaw: number[] = [];
    let peakLat = 0;
    for (let i = 0; i < steps; i++) {
      stepCar(c, spec, ctl, FIXED_DT, flat);
      yaw.push(Math.abs(c.yawRate));
      peakLat = Math.max(peakLat, Math.abs(c.aLat));
    }
    return { yaw, peakLat };
  };
  for (const kmh of [60, 120, 200]) {
    const a = run(kmh, 1, 120 * 0.8);
    const steady = a.yaw[a.yaw.length - 1];
    let t80 = -1;
    for (let i = 0; i < a.yaw.length; i++) if (a.yaw[i] >= 0.8 * steady) { t80 = i / 120; break; }
    check(`respons belok ${kmh} km/h (${cfg.id})`, t80 >= 0 && t80 < 0.2, `capai 80% laju belok dalam ${t80.toFixed(2)} dtk`);
  }
  const lift = run(150, 0, 120 * 1.5).peakLat;
  const full = run(150, 1, 120 * 1.5).peakLat;
  check(`belok dengan gas penuh tetap kuat (${cfg.id})`, full >= 0.85 * lift, `gas penuh ${full.toFixed(1)} vs lepas gas ${lift.toFixed(1)} m/s²`);
}

// 2c) KELAYAKAN TIKUNGAN TAJAM: seberapa dini pemain harus mulai mengerem sebelum tikungan U pertama
{
  const idx = CARS.findIndex((c) => c.id === 'infiniti');
  const easy = minBrakeDistance(idx, 240, 110, 'easy');
  const normal = minBrakeDistance(idx, 240, 110, 'normal');
  const normal200 = minBrakeDistance(idx, 200, 100, 'normal');
  check('Mudah: dari 240 km/h cukup mulai mengerem ≤ 90 m sebelum tikungan U', easy > 0 && easy <= 90, `${easy} m`);
  check('Normal: dari 240 km/h cukup mulai mengerem ≤ 130 m sebelum tikungan U', normal > 0 && normal <= 130, `${normal} m (sebelumnya ±315 m)`);
  check('Normal: dari 200 km/h cukup mulai mengerem ≤ 70 m sebelum tikungan U', normal200 > 0 && normal200 <= 70, `${normal200} m`);
}

// 3) SIRKUIT layak dikendarai: bot menyelesaikan 2 lap tanpa menabrak dinding
console.log(`\nSirkuit: panjang ${track.length.toFixed(0)} m, ${track.n} sampel`);
for (const cfg of CARS) {
  const r = simulateRace(track, cfg, 2, 1.0);
  const laps = r.lapMs.map((m) => (m / 1000).toFixed(1)).join(' / ');
  check(`bot selesai 2 lap (${cfg.id})`, r.finished, `lap: ${laps} dtk, total ${(r.totalMs / 1000).toFixed(1)}, tabrak dinding ${r.wallHits}, puncak ${r.maxSpeedKmH.toFixed(0)} km/h`);
  check(`bot tidak menabrak dinding (${cfg.id})`, r.wallHits === 0);
}

// 4) Grid start berada di belakang garis, menghadap arah balapan, di dalam aspal
for (let k = 0; k < 8; k++) {
  const g = track.gridSlot(k);
  const loc = track.locate(g.x, g.z, -1, newLocation());
  const fwd = Math.sin(g.heading) * loc.tx + Math.cos(g.heading) * loc.tz;
  check(`grid ${k} di aspal & menghadap benar`, Math.abs(loc.d) < 5 && fwd > 0.99, `d=${loc.d.toFixed(1)} fwd=${fwd.toFixed(3)}`);
}

console.log(failed === 0 ? '\nSEMUA TES LULUS' : `\n${failed} TES GAGAL`);
process.exit(failed === 0 ? 0 : 1);
