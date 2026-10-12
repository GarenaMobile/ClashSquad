// Semua tekstur dibuat lewat canvas (tanpa file gambar), jadi ringan dan tidak perlu aset tambahan.
import * as THREE from 'three';

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function finish(c: HTMLCanvasElement, repeat: boolean, srgb = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
  }
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

function noiseFill(ctx: CanvasRenderingContext2D, w: number, h: number, amp: number, seed: number) {
  const img = ctx.getImageData(0, 0, w, h);
  const r = rng(seed);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (r() - 0.5) * amp;
    img.data[i] = Math.max(0, Math.min(255, img.data[i] + n));
    img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n));
    img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);
}

/** Aspal: u melintang jalan (0..1), v sepanjang jalan. Garis tepi putih di kiri/kanan. */
export function asphaltTexture(): THREE.CanvasTexture {
  const S = 512;
  const [c, g] = makeCanvas(S, S);
  g.fillStyle = '#3a3c42';
  g.fillRect(0, 0, S, S);
  noiseFill(g, S, S, 26, 11);
  const r = rng(5);
  for (let i = 0; i < 1800; i++) {
    g.fillStyle = `rgba(${r() > 0.5 ? 255 : 0},${r() > 0.5 ? 255 : 0},${r() > 0.5 ? 255 : 0},0.06)`;
    g.fillRect(r() * S, r() * S, 1 + r() * 2, 1 + r() * 2);
  }
  // jalur karet (racing line) yang lebih gelap
  const grad = g.createLinearGradient(0, 0, S, 0);
  grad.addColorStop(0.0, 'rgba(0,0,0,0)');
  grad.addColorStop(0.3, 'rgba(0,0,0,0.0)');
  grad.addColorStop(0.42, 'rgba(0,0,0,0.22)');
  grad.addColorStop(0.5, 'rgba(0,0,0,0.12)');
  grad.addColorStop(0.58, 'rgba(0,0,0,0.22)');
  grad.addColorStop(0.7, 'rgba(0,0,0,0.0)');
  grad.addColorStop(1.0, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
  // garis tepi
  g.fillStyle = 'rgba(245,245,245,0.92)';
  g.fillRect(10, 0, 12, S);
  g.fillRect(S - 22, 0, 12, S);
  return finish(c, true);
}

/** Kerb merah-putih. v berulang tiap 2 garis (merah + putih). */
export function kerbTexture(): THREE.CanvasTexture {
  const [c, g] = makeCanvas(64, 128);
  g.fillStyle = '#d4202a';
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#f4f4f4';
  g.fillRect(0, 64, 64, 64);
  noiseFill(g, 64, 128, 14, 3);
  return finish(c, true);
}

export function gravelTexture(): THREE.CanvasTexture {
  const S = 256;
  const [c, g] = makeCanvas(S, S);
  g.fillStyle = '#b7a07c';
  g.fillRect(0, 0, S, S);
  noiseFill(g, S, S, 50, 21);
  const r = rng(9);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = r() > 0.5 ? 'rgba(90,70,50,0.35)' : 'rgba(240,225,195,0.35)';
    g.fillRect(r() * S, r() * S, 1 + r() * 2, 1 + r() * 2);
  }
  return finish(c, true);
}

export function grassTexture(): THREE.CanvasTexture {
  const S = 512;
  const [c, g] = makeCanvas(S, S);
  g.fillStyle = '#4c7a34';
  g.fillRect(0, 0, S, S);
  const r = rng(77);
  for (let i = 0; i < 260; i++) {
    g.fillStyle = `rgba(${30 + r() * 40},${70 + r() * 70},${20 + r() * 30},0.22)`;
    g.beginPath();
    g.arc(r() * S, r() * S, 10 + r() * 38, 0, Math.PI * 2);
    g.fill();
  }
  noiseFill(g, S, S, 38, 31);
  return finish(c, true);
}

/** Dinding pembatas: sumbu y kanvas = sepanjang lintasan, sumbu x = tinggi dinding. */
export function wallTexture(): THREE.CanvasTexture {
  const W = 128;
  const H = 512;
  const [c, g] = makeCanvas(W, H);
  g.fillStyle = '#e8e9ee';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#7d818c'; // bagian bawah
  g.fillRect(0, 0, 26, H);
  g.fillStyle = '#1c3f8e'; // pita biru
  g.fillRect(34, 0, 62, H);
  g.fillStyle = '#d4202a'; // garis merah
  g.fillRect(98, 0, 8, H);
  g.save();
  g.translate(66, H / 2);
  g.rotate(Math.PI / 2);
  g.fillStyle = '#ffffff';
  g.font = 'italic 800 40px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('GRAND TURISMO', 0, 0);
  g.restore();
  noiseFill(g, W, H, 10, 8);
  return finish(c, true);
}

export function checkerTexture(cols: number, rows: number): THREE.CanvasTexture {
  const s = 16;
  const [c, g] = makeCanvas(cols * s, rows * s);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      g.fillStyle = (x + y) % 2 === 0 ? '#f5f5f5' : '#15151a';
      g.fillRect(x * s, y * s, s, s);
    }
  }
  return finish(c, false);
}

export function bannerTexture(text: string): THREE.CanvasTexture {
  const [c, g] = makeCanvas(1024, 128);
  const grad = g.createLinearGradient(0, 0, 1024, 0);
  grad.addColorStop(0, '#10131c');
  grad.addColorStop(0.5, '#1b2440');
  grad.addColorStop(1, '#10131c');
  g.fillStyle = grad;
  g.fillRect(0, 0, 1024, 128);
  const s = 16;
  for (let y = 0; y < 128 / s; y++) {
    for (let x = 0; x < 6; x++) {
      g.fillStyle = (x + y) % 2 === 0 ? '#f5f5f5' : '#15151a';
      g.fillRect(x * s, y * s, s, s);
      g.fillRect(1024 - (x + 1) * s, y * s, s, s);
    }
  }
  g.fillStyle = '#ffffff';
  g.font = 'italic 800 64px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 512, 68);
  g.fillStyle = '#ffb02e';
  g.fillRect(150, 112, 724, 6);
  return finish(c, false);
}

export function gridSlotTexture(): THREE.CanvasTexture {
  const [c, g] = makeCanvas(128, 256);
  g.clearRect(0, 0, 128, 256);
  g.strokeStyle = 'rgba(255,255,255,0.95)';
  g.lineWidth = 8;
  g.strokeRect(10, 10, 108, 236);
  return finish(c, false);
}

export function crowdTexture(): THREE.CanvasTexture {
  const [c, g] = makeCanvas(256, 64);
  g.fillStyle = '#23262e';
  g.fillRect(0, 0, 256, 64);
  const r = rng(101);
  const cols = ['#d4202a', '#f4f4f4', '#2f6fd8', '#f2b705', '#2fa86b', '#c24ad8', '#ff7a2f'];
  for (let i = 0; i < 700; i++) {
    g.fillStyle = cols[Math.floor(r() * cols.length)];
    g.fillRect(r() * 256, r() * 64, 2, 3);
  }
  return finish(c, true);
}

export function softParticleTexture(): THREE.CanvasTexture {
  const [c, g] = makeCanvas(64, 64);
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return finish(c, false, false);
}

export { rng };
