// ====================================================================
// FISIKA MOBIL (semi-realistis, buatan sendiri, tanpa physics engine)
//
// Konvensi arah (lihat track.ts):
//   maju  f = (sin h, cos h)      kanan  r = (-cos h, sin h)
//   steer +1 = belok KANAN        => yawRate NEGATIF => heading berkurang
//
// Langkah waktu tetap (FIXED_DT) supaya hasilnya sama di semua laptop.
// ====================================================================

import { KERB_W, ROAD_HALF, WALL_INNER, newLocation, type Surface, type Track, type TrackLocation } from './track';
import type { CarConfig } from '../lib/cars';

export const FIXED_DT = 1 / 120;
const G = 9.81;

/**
 * Konstanta rasa berkendara (ubah di sini jika ingin lebih tajam / lebih santai).
 * Satuan "per detik" = seberapa cepat nilai bergerak menuju nilai tujuan.
 */
export const FEEL = {
  steerRise: 11, // kemudi: dari lurus ke belok (1 = penuh dalam 1 detik)
  steerReturn: 11, // kemudi: kembali lurus
  steerFlip: 18, // kemudi: pindah dari kanan ke kiri
  yawLag: 28, // seberapa cepat badan mobil mengikuti laju belok yang diminta
  throttleRise: 7, // gas naik bertahap (tombol keyboard bersifat langsung 0 -> penuh)
  throttleFall: 12,
  brakeRise: 8, // rem naik bertahap: ±0,12 detik dari 0 ke penuh (cukup halus, tetap tanggap)
  brakeFall: 10,
  brakeG: 1.2, // kekuatan rem maksimum (dalam G) sebelum pengali mobil dan downforce
  gripBase: 1.7, // koefisien cengkeraman dasar ban (mobil balap + downforce)
  downforce: 0.00016, // tambahan grip seiring kecepatan (dikali kecepatan kuadrat)
  downforceMax: 1.3, // batas tambahan grip dari downforce
  cornerDrag: 0.08, // kecepatan berkurang saat menikung keras (gesekan ban)
  yawKickDecay: 3.2, // seberapa cepat putaran akibat tabrakan mereda
};

/** Tingkat bantuan berkendara: memengaruhi grip, rem, dan seberapa parah kerikil menghukum. */
export type AssistLevel = 'easy' | 'normal' | 'pro';
export const ASSIST: Record<AssistLevel, { grip: number; brake: number; gravelMu: number }> = {
  easy: { grip: 1.2, brake: 1.2, gravelMu: 0.75 },
  normal: { grip: 1.0, brake: 1.0, gravelMu: 0.6 },
  pro: { grip: 0.85, brake: 0.9, gravelMu: 0.45 },
};

export interface Controls {
  throttle: number; // 0..1
  brake: number; // 0..1 (setelah berhenti = mundur)
  steer: number; // -1 (kiri) .. +1 (kanan)
  handbrake: boolean;
}

export function newControls(): Controls {
  return { throttle: 0, brake: 0, steer: 0, handbrake: false };
}

export interface CarSpec {
  vmax: number; // m/s
  accel: number; // percepatan dasar (m/s^2)
  mu: number; // koefisien cengkeraman dasar
  gravelMu: number; // cengkeraman di kerikil / rumput
  brakeDecel: number; // pengereman maksimum (m/s^2)
  steerMult: number;
  wheelbase: number;
  agility: number; // respons yaw
  halfLength: number;
  halfWidth: number;
  mass: number;
}

export function specFromConfig(cfg: CarConfig, assist: AssistLevel = 'normal'): CarSpec {
  const as = ASSIST[assist];
  const vmax = cfg.stats.topSpeedKmH / 3.6;
  const v100 = 100 / 3.6;
  // dari a(v) = A * (1 - (v/vmax)^2) dan waktu 0-100 km/h:
  // t = (vmax / (2A)) * ln((vmax + v) / (vmax - v))
  const accel = (vmax / (2 * cfg.stats.accel0to100)) * Math.log((vmax + v100) / (vmax - v100));
  return {
    vmax,
    accel,
    mu: FEEL.gripBase * cfg.tuning.gripMult * as.grip,
    gravelMu: as.gravelMu,
    brakeDecel: FEEL.brakeG * G * cfg.tuning.brakeMult * as.brake,
    steerMult: cfg.tuning.steerMult,
    wheelbase: 2.8,
    agility: Math.min(1.4, Math.max(0.9, 1380 / cfg.stats.weightKg)),
    halfLength: cfg.length / 2,
    halfWidth: 1.05,
    mass: cfg.stats.weightKg,
  };
}

export interface CarState {
  x: number;
  z: number;
  heading: number;
  vx: number;
  vz: number;
  yawRate: number;
  steer: number; // kemudi yang sudah dihaluskan (-1..1)
  thr: number; // gas yang sudah dihaluskan (0..1)
  brk: number; // rem yang sudah dihaluskan (0..1)
  yawKick: number; // putaran tambahan akibat tabrakan (rad/s), mereda sendiri
  // keluaran untuk tampilan / suara
  speed: number; // m/s
  vlong: number;
  vlat: number;
  aLong: number;
  aLat: number;
  slip: number; // 0..1 seberapa besar mobil tergelincir
  surface: Surface;
  wallImpact: number; // benturan dinding pada langkah terakhir (m/s), 0 jika tidak ada
  loc: TrackLocation;
}

export function newCarState(x = 0, z = 0, heading = 0): CarState {
  return {
    x,
    z,
    heading,
    vx: 0,
    vz: 0,
    yawRate: 0,
    steer: 0,
    thr: 0,
    brk: 0,
    yawKick: 0,
    speed: 0,
    vlong: 0,
    vlat: 0,
    aLong: 0,
    aLat: 0,
    slip: 0,
    surface: 'asphalt',
    wallImpact: 0,
    loc: newLocation(),
  };
}

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

/**
 * Laju belok maksimum (rad/s) yang bisa dicapai saat kemudi penuh:
 * dibatasi oleh sudut roda (rendah saat kecepatan tinggi) dan oleh grip samping.
 */
export function yawAuthority(spec: CarSpec, vlong: number, capLat: number): number {
  const sp = Math.abs(vlong);
  const deltaMax = (0.55 * spec.steerMult) / (1 + (sp / 45) * (sp / 45));
  const wKin = (sp / spec.wheelbase) * Math.tan(deltaMax);
  const wGrip = capLat / Math.max(sp, 3);
  return Math.min(wKin, wGrip * 1.02);
}

const tmpLoc = newLocation();

export function stepCar(c: CarState, spec: CarSpec, ctl: Controls, dt: number, track: Track): void {
  const sinH = Math.sin(c.heading);
  const cosH = Math.cos(c.heading);
  const fx = sinH;
  const fz = cosH;
  const rx = -cosH;
  const rz = sinH;

  const vlong = c.vx * fx + c.vz * fz;
  const vlat = c.vx * rx + c.vz * rz;

  // --- permukaan di bawah mobil ---
  track.locate(c.x, c.z, c.loc.i, c.loc);
  const surf = track.surface(c.loc.d);
  c.surface = surf;
  const surfMu = surf === 'asphalt' ? 1 : surf === 'kerb' ? 0.92 : spec.gravelMu / Math.max(0.3, ASSIST.normal.gravelMu) * 0.6;

  // downforce menambah cengkeraman di kecepatan tinggi
  const df = Math.min(FEEL.downforceMax, FEEL.downforce * vlong * vlong);
  const mu = spec.mu * surfMu * (1 + df);
  const aTrac = mu * G;

  // --- kemudi (dihaluskan, respons cepat) ---
  const target = clamp(ctl.steer, -1, 1);
  const diff = target - c.steer;
  const opposite = c.steer !== 0 && Math.sign(target) !== Math.sign(c.steer);
  const rate = target === 0 ? FEEL.steerReturn : opposite ? FEEL.steerFlip : FEEL.steerRise;
  c.steer += clamp(diff, -rate * dt, rate * dt);

  // gas & rem naik bertahap (tombol keyboard langsung 0 -> penuh, ini membuatnya lebih halus)
  const tIn = clamp(ctl.throttle, 0, 1);
  const bIn = clamp(ctl.brake, 0, 1);
  c.thr += clamp(tIn - c.thr, -FEEL.throttleFall * dt, FEEL.throttleRise * dt);
  c.brk += clamp(bIn - c.brk, -FEEL.brakeFall * dt, FEEL.brakeRise * dt);
  const thr = c.thr;
  const brk = c.brk;

  // --- gaya memanjang ---
  let aLong = 0;
  if (thr > 0) {
    if (vlong > -0.5) aLong += thr * spec.accel * Math.max(0, 1 - (vlong / spec.vmax) ** 2);
    else aLong += thr * 12;
  }
  if (brk > 0) {
    if (vlong > 0.8) {
      aLong -= brk * spec.brakeDecel * (1 + df * 0.6);
    } else {
      // sudah berhenti: mundur pelan
      const revMax = 7;
      if (vlong > -revMax) aLong -= brk * 6;
    }
  }
  if (thr < 0.02 && brk < 0.02) {
    const aero = 0.00026 * vlong * Math.abs(vlong);
    const rolling = 0.2 * Math.sign(vlong) * Math.min(1, Math.abs(vlong));
    const engineBrake = 1.4 * Math.sign(vlong) * Math.min(1, Math.abs(vlong) / 3);
    aLong -= aero + rolling + engineBrake;
  }
  if (surf === 'gravel') {
    aLong -= (2.2 + 0.025 * Math.abs(vlong)) * Math.sign(vlong) * Math.min(1, Math.abs(vlong) / 4);
  }
  if (ctl.handbrake) {
    aLong -= 4.5 * Math.sign(vlong) * Math.min(1, Math.abs(vlong) / 3);
  }
  // gesekan ban saat menikung keras ikut memperlambat mobil (membantu mengurangi melebar)
  aLong -= FEEL.cornerDrag * Math.abs(c.aLat) * Math.sign(vlong) * Math.min(1, Math.abs(vlong) / 3);
  aLong = clamp(aLong, -aTrac * 1.05, aTrac);

  // --- elips gesek: sisa cengkeraman untuk belok (gas/rem hanya mengurangi sedikit) ---
  const lf = Math.min(1, Math.abs(aLong) / aTrac);
  let capLat = aTrac * Math.sqrt(Math.max(0.45, 1 - 0.3 * lf * lf));

  let yawGain = 1;
  if (ctl.handbrake) {
    capLat *= 0.3;
    yawGain = 1.3;
  } else if (thr > 0.9 && Math.abs(c.steer) > 0.6 && vlong > 14) {
    capLat *= 0.92; // sedikit oversteer saat gas penuh di tikungan
  }

  // Kemudi memakai grip maksimum yang tersedia: kemudi penuh = belok sekuat mungkin
  // tanpa tergelincir, kemudi separuh = separuh dari itu. Tidak perlu melepas gas.
  const wAuth = yawAuthority(spec, vlong, capLat);
  const dirSign = vlong >= 0 ? 1 : -1;
  // belok kanan (steer > 0) => yaw negatif
  let wTarget = -dirSign * c.steer * wAuth * yawGain;
  if (ctl.handbrake) wTarget = clamp(wTarget, -wAuth * 1.6, wAuth * 1.6);

  const k = FEEL.yawLag * spec.agility;
  c.yawRate += (wTarget - c.yawRate) * Math.min(1, k * dt);

  // --- koreksi kecepatan samping (gaya ban) ---
  const aLatReq = -vlat / dt;
  const aLat = clamp(aLatReq, -capLat, capLat);

  const ax = fx * aLong + rx * aLat;
  const az = fz * aLong + rz * aLat;
  c.vx += ax * dt;
  c.vz += az * dt;
  c.heading += (c.yawRate + c.yawKick) * dt;
  c.yawKick *= Math.exp(-FEEL.yawKickDecay * dt);
  c.x += c.vx * dt;
  c.z += c.vz * dt;

  // berhenti total jika hampir diam & tanpa input
  if (ctl.throttle === 0 && ctl.brake === 0 && Math.hypot(c.vx, c.vz) < 0.15) {
    c.vx = 0;
    c.vz = 0;
    c.yawRate *= 0.5;
  }

  // --- tabrakan dengan dinding (3 lingkaran sepanjang badan mobil) ---
  c.wallImpact = 0;
  const r = spec.halfWidth;
  const off = spec.halfLength - r;
  const nf = Math.sin(c.heading);
  const nfz = Math.cos(c.heading);
  for (let k2 = -1; k2 <= 1; k2++) {
    const px = c.x + nf * off * k2;
    const pz = c.z + nfz * off * k2;
    track.locate(px, pz, c.loc.i, tmpLoc);
    const pen = Math.abs(tmpLoc.d) + r - WALL_INNER;
    if (pen > 0) {
      const sgn = tmpLoc.d >= 0 ? 1 : -1;
      const ox = tmpLoc.rx * sgn; // arah keluar (menuju dinding)
      const oz = tmpLoc.rz * sgn;
      c.x -= ox * pen;
      c.z -= oz * pen;
      const vn = c.vx * ox + c.vz * oz;
      if (vn > 0) {
        c.vx -= 1.15 * vn * ox;
        c.vz -= 1.15 * vn * oz;
        const keep = 1 - Math.min(0.25, 0.012 * vn);
        c.vx *= keep;
        c.vz *= keep;
        c.yawRate *= 0.8;
        c.wallImpact = Math.max(c.wallImpact, vn);
      }
    }
  }

  // --- keluaran ---
  const vlong2 = c.vx * Math.sin(c.heading) + c.vz * Math.cos(c.heading);
  const vlat2 = c.vx * -Math.cos(c.heading) + c.vz * Math.sin(c.heading);
  c.vlong = vlong2;
  c.vlat = vlat2;
  c.speed = Math.hypot(c.vx, c.vz);
  c.aLong = aLong;
  c.aLat = aLat;
  c.slip = clamp(Math.abs(vlat2) / Math.max(4, Math.abs(vlong2)) * 2.2, 0, 1);
}

/** Letakkan mobil di titik tertentu, diam. */
export function placeCar(c: CarState, x: number, z: number, heading: number): void {
  c.x = x;
  c.z = z;
  c.heading = heading;
  c.vx = 0;
  c.vz = 0;
  c.yawRate = 0;
  c.steer = 0;
  c.thr = 0;
  c.brk = 0;
  c.yawKick = 0;
  c.speed = 0;
  c.vlong = 0;
  c.vlat = 0;
  c.aLong = 0;
  c.aLat = 0;
  c.slip = 0;
  c.wallImpact = 0;
  c.loc.i = -1;
}

export { ROAD_HALF, KERB_W, WALL_INNER };
