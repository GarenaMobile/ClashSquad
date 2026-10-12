import type { QualityLevel } from '../../lib/storage';

export interface QualitySettings {
  maxPixelRatio: number;
  shadowMap: number; // 0 = mati
  trees: number;
  poles: boolean;
  particles: boolean;
}

export function qualitySettings(level: QualityLevel): QualitySettings {
  switch (level) {
    case 'low':
      return { maxPixelRatio: 1, shadowMap: 0, trees: 120, poles: false, particles: true };
    case 'high':
      return { maxPixelRatio: 2, shadowMap: 2048, trees: 520, poles: true, particles: true };
    default:
      return { maxPixelRatio: 1.5, shadowMap: 1024, trees: 300, poles: true, particles: true };
  }
}
