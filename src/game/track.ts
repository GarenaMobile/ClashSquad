// ====================================================================
// SIRKUIT BUATAN SENDIRI: "GRAND CIRCUIT"
// Garis tengah dibuat dari titik kontrol (spline tertutup), lalu diambil
// sampelnya tiap 2 meter. Semua logika (collision, lap, minimap) memakai
// data sampel yang sama, jadi tidak mungkin tidak sinkron.
//
// Konvensi arah (PENTING, dipakai di seluruh game):
//   heading = sudut; arah maju  f = (sin h, cos h)  di bidang (x, z)
//   sisi kanan pengemudi        r = (-cos h, sin h)
//   menambah heading  => belok KIRI, mengurangi heading => belok KANAN
// ====================================================================

import * as THREE from 'three';

export const TRACK_ID = 'gt_circuit_v1';
export const TRACK_NAME = 'Grand Circuit';

export const ROAD_HALF = 9; // setengah lebar aspal (m)
export const KERB_W = 1.6; // lebar kerb (m)
export const WALL_INNER = 17.5; // jarak dinding dari garis tengah (m)
export const SAMPLE_SPACING = 2; // jarak antar sampel (m)

// Titik kontrol (x, z). Titik pertama ada di lintasan lurus utama; s = 0 (garis start/finish) ada di sana.
// Busur lingkaran sebagai deretan titik kontrol (sudut dalam derajat, 0 = +X, 90 = +Z).
function arc(cx: number, cz: number, r: number, a0: number, a1: number, steps: number): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const a = ((a0 + ((a1 - a0) * i) / steps) * Math.PI) / 180;
    pts.push([cx + r * Math.cos(a), cz + r * Math.sin(a)]);
  }
  return pts;
}

const CONTROL: [number, number][] = [
  // lintasan lurus utama (garis start/finish di sekitar x = 0)
  [40, 0],
  [180, 0],
  [300, 0],
  // tikungan U sisi timur (1), radius 50 m
  ...arc(340, -50, 50, 90, -90, 6),
  // lintasan kembali ke barat, dengan kelokan lembut
  [260, -98],
  [180, -118],
  [100, -100],
  [20, -80],
  [-50, -100],
  // tikungan U sisi barat, radius 50 m
  ...arc(-120, -150, 50, 90, 270, 6),
  // lintasan ke timur dengan kelokan
  [-50, -202],
  [30, -224],
  [110, -198],
  [190, -176],
  [270, -196],
  // tikungan U sisi timur (2), radius 55 m
  ...arc(330, -255, 55, 90, -90, 6),
  // lintasan kembali ke barat
  [250, -312],
  [170, -334],
  [90, -312],
  [10, -290],
  [-70, -312],
  [-150, -334],
  [-230, -316],
  // tikungan barat luar dan naik ke garis start
  [-300, -325],
  [-355, -300],
  [-380, -250],
  [-382, -170],
  [-378, -90],
  [-355, -30],
  [-310, -8],
  [-240, 0],
  [-140, 0],
  [-40, 0],
];

export type Surface = 'asphalt' | 'kerb' | 'gravel';

export interface TrackSample {
  x: number;
  z: number;
  tx: number; // arah maju
  tz: number;
  rx: number; // sisi kanan
  rz: number;
  s: number; // jarak sepanjang lintasan (m)
  kappa: number; // kelengkungan bertanda (+ = belok kanan)
}

export interface TrackLocation {
  i: number;
  s: number;
  d: number; // jarak lateral bertanda dari garis tengah (+ = kanan)
  cx: number;
  cz: number;
  tx: number;
  tz: number;
  rx: number;
  rz: number;
  dist: number; // jarak ke garis tengah (m)
}

export function newLocation(): TrackLocation {
  return { i: -1, s: 0, d: 0, cx: 0, cz: 0, tx: 1, tz: 0, rx: 0, rz: 1, dist: 0 };
}

export class Track {
  samples: TrackSample[] = [];
  length = 0;
  n = 0;

  constructor() {
    const pts = CONTROL.map(([x, z]) => new THREE.Vector3(x, 0, z));
    const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
    const rough = curve.getLength();
    const count = Math.round(rough / SAMPLE_SPACING);
    const sp = curve.getSpacedPoints(count); // count + 1 titik, titik terakhir = titik pertama
    sp.pop();
    this.n = sp.length;

    // arc length
    const s: number[] = [0];
    for (let i = 1; i < this.n; i++) {
      s.push(s[i - 1] + Math.hypot(sp[i].x - sp[i - 1].x, sp[i].z - sp[i - 1].z));
    }
    const last = this.n - 1;
    this.length = s[last] + Math.hypot(sp[0].x - sp[last].x, sp[0].z - sp[last].z);

    for (let i = 0; i < this.n; i++) {
      const a = sp[(i - 1 + this.n) % this.n];
      const b = sp[(i + 1) % this.n];
      let tx = b.x - a.x;
      let tz = b.z - a.z;
      const l = Math.hypot(tx, tz) || 1;
      tx /= l;
      tz /= l;
      this.samples.push({ x: sp[i].x, z: sp[i].z, tx, tz, rx: -tz, rz: tx, s: s[i], kappa: 0 });
    }
    for (let i = 0; i < this.n; i++) {
      const p = this.samples[(i - 1 + this.n) % this.n];
      const q = this.samples[(i + 1) % this.n];
      const cross = p.tx * q.tz - p.tz * q.tx;
      const ds = 2 * (this.length / this.n);
      this.samples[i].kappa = cross / ds;
    }
  }

  /** Cari posisi (px, pz) terhadap lintasan. hint = indeks sampel terakhir (atau -1). */
  locate(px: number, pz: number, hint: number, out: TrackLocation): TrackLocation {
    const n = this.n;
    const S = this.samples;
    let bestI = -1;
    let bestD2 = Infinity;
    let bestU = 0;

    const test = (i: number) => {
      const a = S[i];
      const b = S[(i + 1) % n];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const len2 = dx * dx + dz * dz;
      let u = ((px - a.x) * dx + (pz - a.z) * dz) / len2;
      u = u < 0 ? 0 : u > 1 ? 1 : u;
      const qx = a.x + dx * u;
      const qz = a.z + dz * u;
      const d2 = (px - qx) * (px - qx) + (pz - qz) * (pz - qz);
      if (d2 < bestD2) {
        bestD2 = d2;
        bestI = i;
        bestU = u;
      }
    };

    if (hint >= 0) {
      for (let k = -14; k <= 14; k++) test((((hint + k) % n) + n) % n);
    }
    if (hint < 0 || bestD2 > 35 * 35) {
      for (let i = 0; i < n; i++) test(i);
    }

    const a = S[bestI];
    const b = S[(bestI + 1) % n];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz) || 1;
    const tx = dx / len;
    const tz = dz / len;
    const segLen = bestI === n - 1 ? this.length - a.s : b.s - a.s;
    out.i = bestI;
    out.s = a.s + bestU * segLen;
    out.tx = tx;
    out.tz = tz;
    out.rx = -tz;
    out.rz = tx;
    out.cx = a.x + dx * bestU;
    out.cz = a.z + dz * bestU;
    out.d = (px - out.cx) * out.rx + (pz - out.cz) * out.rz;
    out.dist = Math.sqrt(bestD2);
    return out;
  }

  /** Titik pada lintasan di jarak s (boleh negatif / lebih dari panjang). */
  at(s: number): { x: number; z: number; tx: number; tz: number; heading: number } {
    let t = s % this.length;
    if (t < 0) t += this.length;
    const f = (t / this.length) * this.n;
    const i = Math.floor(f) % this.n;
    const u = f - Math.floor(f);
    const a = this.samples[i];
    const b = this.samples[(i + 1) % this.n];
    const x = a.x + (b.x - a.x) * u;
    const z = a.z + (b.z - a.z) * u;
    let tx = a.tx + (b.tx - a.tx) * u;
    let tz = a.tz + (b.tz - a.tz) * u;
    const l = Math.hypot(tx, tz) || 1;
    tx /= l;
    tz /= l;
    return { x, z, tx, tz, heading: Math.atan2(tx, tz) };
  }

  /**
   * Posisi grid start ke-k (0 = pole position). Grid ada di belakang garis start,
   * dua mobil per baris (kiri/kanan), jarak antar baris 9 m.
   */
  gridSlot(k: number): { x: number; z: number; heading: number; s: number } {
    const row = Math.floor(k / 2);
    const left = k % 2 === 0;
    const s = -(7 + row * 9 + (left ? 0 : 4.5));
    const p = this.at(s);
    const lateral = left ? -3.4 : 3.4; // kiri = negatif (sisi kanan positif)
    return {
      x: p.x + -p.tz * lateral,
      z: p.z + p.tx * lateral,
      heading: p.heading,
      s,
    };
  }

  surface(d: number): Surface {
    const a = Math.abs(d);
    if (a <= ROAD_HALF) return 'asphalt';
    if (a <= ROAD_HALF + KERB_W) return 'kerb';
    return 'gravel';
  }
}

let cached: Track | null = null;
export function getTrack(): Track {
  if (!cached) cached = new Track();
  return cached;
}
