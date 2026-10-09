// Definisi peta simetris dan objek arena Clash Squad
import { Wall, DummyTarget } from './types';
import { GAME_CONFIG } from './constants';

const { MAP_WIDTH, MAP_HEIGHT, DUMMY_SIZE, DUMMY_MAX_HP } = GAME_CONFIG;
const WALL_THICKNESS = 16;

/**
 * Daftar dinding arena simetris
 */
export const ARENA_WALLS: Wall[] = [
  // 1. Dinding batas luar arena (Outer Boundaries)
  { id: 'wall-top', x: 0, y: 0, width: MAP_WIDTH, height: WALL_THICKNESS },
  { id: 'wall-bottom', x: 0, y: MAP_HEIGHT - WALL_THICKNESS, width: MAP_WIDTH, height: WALL_THICKNESS },
  { id: 'wall-left', x: 0, y: 0, width: WALL_THICKNESS, height: MAP_HEIGHT },
  { id: 'wall-right', x: MAP_WIDTH - WALL_THICKNESS, y: 0, width: WALL_THICKNESS, height: MAP_HEIGHT },

  // 2. Kotak pelindung utama di bagian tengah arena
  { id: 'wall-center', x: MAP_WIDTH / 2 - 40, y: MAP_HEIGHT / 2 - 40, width: 80, height: 80 },

  // 3. Rintangan simetris sisi Kiri (Area Spawn Tim A)
  { id: 'wall-left-top', x: 220, y: 120, width: 36, height: 140 },
  { id: 'wall-left-bottom', x: 220, y: MAP_HEIGHT - 260, width: 36, height: 140 },

  // 4. Rintangan simetris sisi Kanan (Area Spawn Tim B)
  { id: 'wall-right-top', x: MAP_WIDTH - 220 - 36, y: 120, width: 36, height: 140 },
  { id: 'wall-right-bottom', x: MAP_WIDTH - 220 - 36, y: MAP_HEIGHT - 260, width: 36, height: 140 },

  // 5. Rintangan koridor atas dan bawah (Center Lane Flanks)
  { id: 'wall-mid-top', x: MAP_WIDTH / 2 - 80, y: 80, width: 160, height: 30 },
  { id: 'wall-mid-bottom', x: MAP_WIDTH / 2 - 80, y: MAP_HEIGHT - 110, width: 160, height: 30 },
];

/**
 * Titik awal spawn pemain default (Sisi kiri / Tim A)
 */
export const DEFAULT_PLAYER_SPAWN = {
  x: 90,
  y: MAP_HEIGHT / 2 - GAME_CONFIG.PLAYER_SIZE / 2,
};

/**
 * Daftar dummy target awal untuk mode latihan single-player
 */
export const INITIAL_DUMMIES: DummyTarget[] = [
  {
    id: 'dummy-1',
    x: MAP_WIDTH - 120,
    y: MAP_HEIGHT / 2 - DUMMY_SIZE / 2,
    size: DUMMY_SIZE,
    hp: DUMMY_MAX_HP,
    maxHp: DUMMY_MAX_HP,
    isAlive: true,
    respawnTimer: 0,
  },
  {
    id: 'dummy-2',
    x: MAP_WIDTH - 220 + 70,
    y: 150,
    size: DUMMY_SIZE,
    hp: DUMMY_MAX_HP,
    maxHp: DUMMY_MAX_HP,
    isAlive: true,
    respawnTimer: 0,
  },
  {
    id: 'dummy-3',
    x: MAP_WIDTH - 220 + 70,
    y: MAP_HEIGHT - 190,
    size: DUMMY_SIZE,
    hp: DUMMY_MAX_HP,
    maxHp: DUMMY_MAX_HP,
    isAlive: true,
    respawnTimer: 0,
  },
];
