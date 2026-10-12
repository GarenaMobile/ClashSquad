// ====================================================================
// TABRAKAN ANTAR MOBIL (benturan + gesekan + putaran akibat tumbukan)
//
// Setiap mobil didekati 3 lingkaran sepanjang badannya. Dari pasangan lingkaran yang paling
// dalam menembus, dihitung impuls tumbukan (pantulan kecil) dan impuls gesekan (sisi mobil
// saling menggesek), termasuk momen putar sehingga mobil yang tertabrak di ujung akan berputar.
//
// Multiplayer: setiap perangkat hanya menggerakkan mobilnya sendiri (applyA / applyB), tetapi
// besar impuls dihitung dengan rumus yang sama di kedua sisi, sehingga hasilnya saling cocok.
// ====================================================================
import type { CarSpec, CarState } from './physics';

export const RESTITUTION = 0.22; // seberapa memantul (0 = menempel, 1 = lenting sempurna)
export const FRICTION = 0.4; // gesekan antar bodi mobil
const MAX_KICK = 4; // batas putaran tambahan (rad/s)

export interface CollisionHit {
  x: number; // titik kontak
  z: number;
  nx: number; // normal dari A ke B
  nz: number;
  depth: number; // kedalaman tembus (m)
  impulse: number; // besar impuls normal
  relSpeed: number; // kecepatan saling mendekat sebelum tumbukan (m/s), 0 jika sudah menjauh
  scrape: number; // kecepatan saling menggesek (m/s)
}

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

function inertia(spec: CarSpec): number {
  const L = spec.halfLength * 2;
  const W = spec.halfWidth * 2;
  return (spec.mass * (L * L + W * W)) / 12;
}

/**
 * Periksa dan selesaikan tumbukan dua mobil.
 * applyA / applyB: apakah kecepatan & posisi mobil tersebut boleh diubah (false = hanya "penghalang").
 * Mengembalikan null jika tidak bersentuhan.
 */
export function collideCars(
  a: CarState,
  sa: CarSpec,
  b: CarState,
  sb: CarSpec,
  applyA: boolean,
  applyB: boolean,
): CollisionHit | null {
  const reach = sa.halfLength + sb.halfLength + 0.5;
  const ddx = b.x - a.x;
  const ddz = b.z - a.z;
  if (ddx * ddx + ddz * ddz > reach * reach) return null;

  const ra = sa.halfWidth;
  const rb = sb.halfWidth;
  const offA = sa.halfLength - ra;
  const offB = sb.halfLength - rb;
  const fax = Math.sin(a.heading);
  const faz = Math.cos(a.heading);
  const fbx = Math.sin(b.heading);
  const fbz = Math.cos(b.heading);

  let bestPen = 0;
  let bnx = 0;
  let bnz = 0;
  let cx = 0;
  let cz = 0;
  for (let ia = -1; ia <= 1; ia++) {
    const ax = a.x + fax * offA * ia;
    const az = a.z + faz * offA * ia;
    for (let ib = -1; ib <= 1; ib++) {
      const bx = b.x + fbx * offB * ib;
      const bz = b.z + fbz * offB * ib;
      const dx = bx - ax;
      const dz = bz - az;
      const d = Math.hypot(dx, dz);
      const pen = ra + rb - d;
      if (pen > bestPen) {
        bestPen = pen;
        if (d > 1e-6) {
          bnx = dx / d;
          bnz = dz / d;
        } else {
          const l = Math.hypot(ddx, ddz) || 1;
          bnx = ddx / l;
          bnz = ddz / l;
        }
        cx = ax + bnx * (ra - pen / 2);
        cz = az + bnz * (ra - pen / 2);
      }
    }
  }
  if (bestPen <= 0) return null;

  const invMa = 1 / sa.mass;
  const invMb = 1 / sb.mass;
  const invIa = 1 / inertia(sa);
  const invIb = 1 / inertia(sb);

  const rax = cx - a.x;
  const raz = cz - a.z;
  const rbx = cx - b.x;
  const rbz = cz - b.z;
  const wa = a.yawRate + a.yawKick;
  const wb = b.yawRate + b.yawKick;

  // kecepatan titik kontak (termasuk akibat berputar)
  const vax = a.vx + wa * raz;
  const vaz = a.vz - wa * rax;
  const vbx = b.vx + wb * rbz;
  const vbz = b.vz - wb * rbx;
  const rvx = vbx - vax;
  const rvz = vbz - vaz;

  const nx = bnx;
  const nz = bnz;
  const vn = rvx * nx + rvz * nz;

  let impulse = 0;
  let scrape = 0;

  if (vn < 0) {
    const raN = raz * nx - rax * nz;
    const rbN = rbz * nx - rbx * nz;
    const denN = invMa + invMb + raN * raN * invIa + rbN * rbN * invIb;
    impulse = (-(1 + RESTITUTION) * vn) / denN;

    // gesekan: arah singgung
    const tx = -nz;
    const tz = nx;
    const vt = rvx * tx + rvz * tz;
    scrape = Math.abs(vt);
    const raT = raz * tx - rax * tz;
    const rbT = rbz * tx - rbx * tz;
    const denT = invMa + invMb + raT * raT * invIa + rbT * rbT * invIb;
    const jt = clamp(-vt / denT, -FRICTION * impulse, FRICTION * impulse);

    const Jx = impulse * nx + jt * tx;
    const Jz = impulse * nz + jt * tz;

    if (applyA) {
      a.vx -= Jx * invMa;
      a.vz -= Jz * invMa;
      a.yawKick = clamp(a.yawKick - (raz * Jx - rax * Jz) * invIa, -MAX_KICK, MAX_KICK);
    }
    if (applyB) {
      b.vx += Jx * invMb;
      b.vz += Jz * invMb;
      b.yawKick = clamp(b.yawKick + (rbz * Jx - rbx * Jz) * invIb, -MAX_KICK, MAX_KICK);
    }
  }

  // dorong keluar dari tumpang tindih (sesuai pembagian massa)
  const corr = Math.max(bestPen - 0.01, 0) * 0.85;
  if (corr > 0) {
    const share = invMa + invMb;
    if (applyA) {
      a.x -= nx * corr * (invMa / share);
      a.z -= nz * corr * (invMa / share);
    }
    if (applyB) {
      b.x += nx * corr * (invMb / share);
      b.z += nz * corr * (invMb / share);
    }
  }

  return { x: cx, z: cz, nx, nz, depth: bestPen, impulse, relSpeed: vn < 0 ? -vn : 0, scrape };
}
