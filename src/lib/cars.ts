// ====================================================================
// DAFTAR 9 MOBIL: GRAND TURISMO RACING
// Semua angka performa ada di sini supaya mudah disetel.
// Angka (HP, bobot, kecepatan, dll.) adalah angka PERMAINAN untuk keseimbangan, bukan data resmi pabrikan.
// ====================================================================

export interface CarStats {
  topSpeedKmH: number; // kecepatan puncak
  accel0to100: number; // detik 0-100 km/h
  horsePower: number;
  weightKg: number;
}

export interface CarTuning {
  gripMult: number;  // pengali cengkeraman ban
  brakeMult: number; // pengali kekuatan rem
  steerMult: number; // pengali sudut kemudi
}

export interface CarConfig {
  id: string;
  name: string;
  shortName: string;
  brand: string;
  tagline: string;
  file: string;
  /** Rotasi koreksi supaya bagian depan model menghadap +Z (0 atau Math.PI). */
  frontRotationY: number;
  /** Panjang mobil setelah dinormalisasi (meter). */
  length: number;
  stats: CarStats;
  tuning: CarTuning;
}

export const CARS: CarConfig[] = [
  {
    id: 'infiniti',
    name: 'Infiniti Concept Vision GT',
    shortName: 'Infiniti VGT',
    brand: 'INFINITI',
    tagline: 'Seimbang & mudah dikendalikan',
    file: '/models/car_infiniti.glb',
    frontRotationY: 0,
    length: 4.7,
    stats: { topSpeedKmH: 335, accel0to100: 2.8, horsePower: 680, weightKg: 1380 },
    tuning: { gripMult: 1.05, brakeMult: 1.02, steerMult: 1.06 },
  },
  {
    id: 'bmw',
    name: 'BMW Vision Gran Turismo 2014',
    shortName: 'BMW VGT',
    brand: 'BMW M',
    tagline: 'Paling lincah di tikungan',
    file: '/models/car_bmw.glb',
    frontRotationY: Math.PI,
    length: 4.7,
    stats: { topSpeedKmH: 320, accel0to100: 3.1, horsePower: 549, weightKg: 1300 },
    tuning: { gripMult: 1.1, brakeMult: 1.08, steerMult: 1.1 },
  },
  {
    id: 'mercedes',
    name: 'Mercedes-AMG Vision Gran Turismo',
    shortName: 'AMG VGT',
    brand: 'MERCEDES-AMG',
    tagline: 'Raja kecepatan di lintasan lurus',
    file: '/models/car_mercedes.glb',
    frontRotationY: 0,
    length: 4.7,
    stats: { topSpeedKmH: 345, accel0to100: 2.9, horsePower: 585, weightKg: 1385 },
    tuning: { gripMult: 0.98, brakeMult: 1.0, steerMult: 1.0 },
  },
  {
    id: 'mclaren',
    name: 'McLaren Ultimate Vision GT',
    shortName: 'McLaren VGT',
    brand: 'MCLAREN',
    tagline: 'Tenaga ekstrem, butuh tangan terampil',
    file: '/models/car_mclaren.glb',
    frontRotationY: 0,
    length: 4.7,
    stats: { topSpeedKmH: 370, accel0to100: 2.4, horsePower: 1150, weightKg: 1000 },
    tuning: { gripMult: 1.0, brakeMult: 1.0, steerMult: 0.96 },
  },
  {
    id: 'supra',
    name: 'Toyota GR Supra GT300',
    shortName: 'GR Supra GT300',
    brand: 'TOYOTA GAZOO',
    tagline: 'Mobil balap Super GT: stabil dan kuat mengerem',
    file: '/models/car_supra.glb',
    frontRotationY: 0,
    length: 4.7,
    stats: { topSpeedKmH: 305, accel0to100: 3.1, horsePower: 550, weightKg: 1250 },
    tuning: { gripMult: 1.1, brakeMult: 1.1, steerMult: 1.04 },
  },
  {
    id: 'ft1',
    name: 'Toyota FT-1 Vision Gran Turismo',
    shortName: 'Toyota FT-1',
    brand: 'TOYOTA',
    tagline: 'Konsep futuristik: cepat dan tajam',
    file: '/models/car_ft1.glb',
    frontRotationY: 0,
    length: 4.7,
    stats: { topSpeedKmH: 350, accel0to100: 2.7, horsePower: 1000, weightKg: 1150 },
    tuning: { gripMult: 1.02, brakeMult: 1.0, steerMult: 1.0 },
  },
  {
    id: 'gtr_gt3',
    name: 'Nissan GT-R NISMO GT3 (2018)',
    shortName: 'GT-R NISMO GT3',
    brand: 'NISSAN NISMO',
    tagline: 'Cengkeraman tinggi, paling mudah ditaklukkan',
    file: '/models/car_gtr_gt3.glb',
    frontRotationY: 0,
    length: 4.7,
    stats: { topSpeedKmH: 290, accel0to100: 3.3, horsePower: 560, weightKg: 1290 },
    tuning: { gripMult: 1.12, brakeMult: 1.08, steerMult: 1.05 },
  },
  {
    id: 'r35_gt3',
    name: 'Nissan R35 GT3',
    shortName: 'Nissan R35 GT3',
    brand: 'NISSAN',
    tagline: 'Tangguh dan seimbang di semua tikungan',
    file: '/models/car_r35_gt3.glb',
    frontRotationY: 0,
    length: 4.7,
    stats: { topSpeedKmH: 285, accel0to100: 3.4, horsePower: 540, weightKg: 1300 },
    tuning: { gripMult: 1.08, brakeMult: 1.05, steerMult: 1.0 },
  },
  {
    id: 'lambo',
    name: 'Lamborghini V12 Vision Gran Turismo',
    shortName: 'Lambo V12 VGT',
    brand: 'LAMBORGHINI',
    tagline: 'Kecepatan puncak tinggi, butuh tangan terampil',
    file: '/models/car_lambo.glb',
    frontRotationY: 0,
    length: 4.7,
    stats: { topSpeedKmH: 358, accel0to100: 2.6, horsePower: 780, weightKg: 1180 },
    tuning: { gripMult: 0.98, brakeMult: 0.98, steerMult: 0.98 },
  },
];

export function getCar(id: string | null | undefined): CarConfig {
  return CARS.find((c) => c.id === id) ?? CARS[0];
}
