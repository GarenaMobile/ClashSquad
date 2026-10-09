// Konstanta konfigurasi permainan Clash Squad
// Semua nilai penting disimpan di sini agar mudah diubah dan disesuaikan.

export const GAME_CONFIG = {
  // Ukuran kanvas peta dalam piksel
  MAP_WIDTH: 960,
  MAP_HEIGHT: 640,

  // Karakter pemain
  PLAYER_SIZE: 32, // Ukuran kotak pemain (lebar & tinggi dalam px)
  PLAYER_SPEED: 240, // Kecepatan bergerak (piksel per detik)
  PLAYER_MAX_HP: 100, // Darah maksimal pemain

  // Senjata & Tembakan
  BULLET_DAMAGE: 25, // 4 tembakan = 100 damage (mati)
  SHOOT_COOLDOWN_MS: 250, // Jeda antar tembakan (milidetik)
  MAX_RANGE: 1200, // Jarak jangkauan tembakan hitscan

  // Target dummy latihan
  DUMMY_SIZE: 32,
  DUMMY_MAX_HP: 100,
  DUMMY_RESPAWN_DELAY_MS: 2000, // Waktu respawn dummy setelah hancur
};
