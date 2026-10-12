// ====================================================================
// PEMBALAP OTOMATIS (bot lawan, penentu waktu acuan medali, autopilot
// setelah finish). Mengikuti garis tengah dengan "pure pursuit" dan
// kecepatan yang dihitung dari kelengkungan lintasan di depan.
// ====================================================================

import type { Controls, CarState, CarSpec } from './physics';
import { newCarState, placeCar, specFromConfig, stepCar, yawAuthority, FEEL, FIXED_DT, newControls } from './physics';
import { newLocation, type Track, type TrackLocation } from './track';
import type { CarConfig } from '../lib/cars';

export interface AiParams {
  pace: number; // 0.5 .. 1.0 (1 = batas kemampuan)
  lineOffset: number; // geser garis balap ke samping (m), + = kanan
}

const tmp = newLocation();

export function aiControl(
  car: CarState,
  spec: CarSpec,
  track: Track,
  p: AiParams,
  out: Controls,
): void {
  const loc: TrackLocation = car.loc;
  const speed = Math.max(car.speed, 1);

  // titik tujuan di depan
  const look = 9 + 0.42 * speed;
  const tp = track.at(loc.s + look);
  const tx = tp.x + -tp.tz * p.lineOffset;
  const tz = tp.z + tp.tx * p.lineOffset;
  const rxv = -Math.cos(car.heading);
  const rzv = Math.sin(car.heading);
  const dx = tx - car.x;
  const dz = tz - car.z;
  const dist = Math.hypot(dx, dz) || 1;
  const lat = (dx * rxv + dz * rzv) / dist; // + = tujuan di kanan (sin sudut)
  // kelengkungan pure pursuit => laju belok yang dibutuhkan; kemudi = pecahan dari wewenang belok
  const wDes = (2 * lat * Math.max(car.vlong, 2)) / dist;
  const aTracEst = spec.mu * 9.81 * (1 + Math.min(FEEL.downforceMax, FEEL.downforce * car.vlong * car.vlong));
  const auth = Math.max(yawAuthority(spec, car.vlong, aTracEst * 0.85), 0.05);
  out.steer = Math.max(-1, Math.min(1, wDes / auth));

  // kecepatan aman dari kelengkungan di depan
  const aSafe = 0.84 * spec.mu * 9.81 * 1.12 * p.pace;
  let allowed = spec.vmax * 0.985 * Math.min(1, 0.55 + p.pace * 0.45);
  const brakeB = 0.75 * spec.brakeDecel;
  const n = track.n;
  const step = Math.max(1, Math.floor(8 / (track.length / n)));
  const maxAhead = Math.min(n, Math.floor(300 / (track.length / n)));
  for (let k = 0; k < maxAhead; k += step) {
    const idx = (loc.i + k + 1) % n;
    const kappa = Math.abs(track.samples[idx].kappa);
    if (kappa < 1e-4) continue;
    const dAhead = k * (track.length / n);
    const vt = Math.sqrt(aSafe / kappa);
    const vNow = Math.sqrt(vt * vt + 2 * brakeB * dAhead);
    if (vNow < allowed) allowed = vNow;
  }
  allowed = Math.max(allowed, 9);

  const err = car.vlong - allowed;
  if (err < -1) {
    out.throttle = 1;
    out.brake = 0;
  } else if (err < 1.5) {
    out.throttle = Math.max(0, 0.45 - err * 0.3);
    out.brake = 0;
  } else {
    out.throttle = 0;
    out.brake = Math.min(1, (err - 1.5) / 6);
  }
  out.handbrake = false;
}

export interface SimResult {
  totalMs: number;
  lapMs: number[];
  wallHits: number;
  maxSpeedKmH: number;
  finished: boolean;
}

/** Simulasi balapan tanpa tampilan untuk satu mobil + pace tertentu. */
export function simulateRace(track: Track, cfg: CarConfig, laps: number, pace: number): SimResult {
  const spec = specFromConfig(cfg);
  const car = newCarState();
  const g = track.gridSlot(0);
  placeCar(car, g.x, g.z, g.heading);
  const ctl = newControls();
  const params: AiParams = { pace, lineOffset: 0 };

  let dist = g.s; // negatif (di belakang garis start)
  let lastS = -1;
  let t = 0;
  let lapStart = -1;
  const lapMs: number[] = [];
  let wallHits = 0;
  let maxV = 0;
  let nextLapAt = 0;
  let lapCount = 0;
  const maxT = laps * 200 + 60;

  // inisialisasi lokasi
  track.locate(car.x, car.z, -1, car.loc);
  lastS = car.loc.s;

  while (t < maxT) {
    aiControl(car, spec, track, params, ctl);
    stepCar(car, spec, ctl, FIXED_DT, track);
    t += FIXED_DT;
    if (car.wallImpact > 0.5) wallHits++;
    maxV = Math.max(maxV, car.speed);

    let ds = car.loc.s - lastS;
    if (ds < -track.length / 2) ds += track.length;
    if (ds > track.length / 2) ds -= track.length;
    lastS = car.loc.s;
    const prev = dist;
    dist += ds;

    if (prev < nextLapAt && dist >= nextLapAt) {
      const now = t * 1000;
      if (lapStart >= 0) lapMs.push(now - lapStart);
      lapStart = now;
      lapCount++;
      nextLapAt = lapCount * track.length;
      if (lapCount > laps) {
        // lap ke-`laps` sudah selesai saat melewati garis (laps * L)
      }
    }
    if (dist >= laps * track.length) {
      return {
        totalMs: t * 1000,
        lapMs,
        wallHits,
        maxSpeedKmH: maxV * 3.6,
        finished: true,
      };
    }
  }
  return { totalMs: t * 1000, lapMs, wallHits, maxSpeedKmH: maxV * 3.6, finished: false };
}
