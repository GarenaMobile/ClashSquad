// Definisi tipe data permainan Clash Squad

// Bentuk kotak dasar untuk deteksi tabrakan (AABB)
export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Data dinding / rintangan di arena
export interface Wall extends Rectangle {
  id: string;
  color?: string;
}

// Status pemain
export interface PlayerState {
  id: string;
  x: number;
  y: number;
  size: number;
  angle: number; // Sudut hadap dalam radian
  hp: number;
  maxHp: number;
  isAlive: boolean;
  lastShootTime: number; // Timestamp tembakan terakhir
}

// Status target dummy (untuk latihan single player)
export interface DummyTarget {
  id: string;
  x: number;
  y: number;
  size: number;
  hp: number;
  maxHp: number;
  isAlive: boolean;
  respawnTimer: number; // Sisa waktu sebelum muncul kembali (ms)
}

// Efek garis tembakan (visual tracer)
export interface ShootEffect {
  id: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  createdAt: number;
  hitType: 'wall' | 'dummy' | 'none';
}

// Hasil perhitungan tembakan hitscan
export interface HitscanResult {
  hit: boolean;
  hitX: number;
  hitY: number;
  distance: number;
  hitType: 'wall' | 'dummy' | 'none';
  hitDummyId?: string;
}

// Input pemain yang sedang aktif
export interface PlayerInput {
  moveUp: boolean;
  moveDown: boolean;
  moveLeft: boolean;
  moveRight: boolean;
  mouseX: number;
  mouseY: number;
  isShooting: boolean;
}
