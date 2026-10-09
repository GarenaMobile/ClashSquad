// Modul perenderan Canvas 2D untuk Clash Squad
import { Wall, DummyTarget, PlayerState, ShootEffect } from './types';
import { GAME_CONFIG } from './constants';

/**
 * Menggambar seluruh isi permainan pada elemen Canvas HTML5
 */
export function renderGame(
  ctx: CanvasRenderingContext2D,
  player: PlayerState,
  dummies: DummyTarget[],
  walls: Wall[],
  shootEffects: ShootEffect[]
) {
  const { MAP_WIDTH, MAP_HEIGHT } = GAME_CONFIG;

  // 1. Bersihkan latar belakang (Arena Floor)
  ctx.fillStyle = '#0f172a'; // Slate dark blue
  ctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);

  // 2. Gambar garis grid lantai agar nuansa arena taktis terlihat jelas
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1;
  const gridSize = 40;
  for (let x = 0; x < MAP_WIDTH; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, MAP_HEIGHT);
    ctx.stroke();
  }
  for (let y = 0; y < MAP_HEIGHT; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(MAP_WIDTH, y);
    ctx.stroke();
  }

  // Garis tengah pemisah arena (simetris)
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.15)';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.moveTo(MAP_WIDTH / 2, 0);
  ctx.lineTo(MAP_WIDTH / 2, MAP_HEIGHT);
  ctx.stroke();
  ctx.setLineDash([]); // Reset line dash

  // 3. Gambar semua dinding arena
  for (const wall of walls) {
    // Badan dinding
    ctx.fillStyle = '#334155';
    ctx.fillRect(wall.x, wall.y, wall.width, wall.height);

    // Garis tepi dinding
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2;
    ctx.strokeRect(wall.x, wall.y, wall.width, wall.height);
  }

  // 4. Gambar Target Dummy (untuk latihan)
  const now = Date.now();
  for (const dummy of dummies) {
    if (dummy.isAlive) {
      // Badan dummy (Merah Target)
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(dummy.x, dummy.y, dummy.size, dummy.size);

      ctx.strokeStyle = '#b91c1c';
      ctx.lineWidth = 2;
      ctx.strokeRect(dummy.x, dummy.y, dummy.size, dummy.size);

      // Simbol silang bidik di badan dummy
      ctx.strokeStyle = '#fecaca';
      ctx.lineWidth = 1.5;
      const centerX = dummy.x + dummy.size / 2;
      const centerY = dummy.y + dummy.size / 2;
      ctx.beginPath();
      ctx.moveTo(centerX - 6, centerY);
      ctx.lineTo(centerX + 6, centerY);
      ctx.moveTo(centerX, centerY - 6);
      ctx.lineTo(centerX, centerY + 6);
      ctx.stroke();

      // HP bar di atas kepala dummy
      const barWidth = dummy.size + 10;
      const barHeight = 4;
      const barX = dummy.x - 5;
      const barY = dummy.y - 10;

      ctx.fillStyle = '#1e293b';
      ctx.fillRect(barX, barY, barWidth, barHeight);

      const healthPercent = Math.max(0, dummy.hp / dummy.maxHp);
      ctx.fillStyle = healthPercent > 0.5 ? '#22c55e' : '#eab308';
      ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);
    } else {
      // Indikator dummy sedang respawn
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(dummy.x, dummy.y, dummy.size, dummy.size);
      ctx.setLineDash([]);
    }
  }

  // 5. Gambar Efek Tembakan (Hitscan Tracer)
  for (const effect of shootEffects) {
    const age = now - effect.createdAt;
    const duration = 120; // Durasi efek tampak (ms)
    if (age < duration) {
      const alpha = 1 - age / duration;
      ctx.save();
      ctx.strokeStyle = effect.hitType === 'dummy'
        ? `rgba(251, 191, 36, ${alpha})` // Percikan emas jika kena target
        : `rgba(56, 189, 248, ${alpha})`; // Garis biru cerah jika kena dinding/udara
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(effect.fromX, effect.fromY);
      ctx.lineTo(effect.toX, effect.toY);
      ctx.stroke();

      // Titik benturan (Impact flash)
      ctx.fillStyle = effect.hitType === 'dummy'
        ? `rgba(252, 211, 77, ${alpha})`
        : `rgba(186, 230, 253, ${alpha})`;
      ctx.beginPath();
      ctx.arc(effect.toX, effect.toY, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // 6. Gambar Pemain (Kotak dengan moncong arah bidik)
  if (player.isAlive) {
    const pCenterX = player.x + player.size / 2;
    const pCenterY = player.y + player.size / 2;

    ctx.save();
    // Putar canvas sesuai arah hadap bidikan pemain
    ctx.translate(pCenterX, pCenterY);
    ctx.rotate(player.angle);

    // Moncong senjata (garis kecil mengarah ke depan)
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(player.size / 4, -3, player.size / 2 + 6, 6);

    // Badan kotak pemain (Warna Biru / Tim A)
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(-player.size / 2, -player.size / 2, player.size, player.size);

    // Garis tepi pemain
    ctx.strokeStyle = '#0369a1';
    ctx.lineWidth = 2;
    ctx.strokeRect(-player.size / 2, -player.size / 2, player.size, player.size);

    ctx.restore();

    // HP Bar di atas kepala pemain
    const pBarWidth = player.size + 12;
    const pBarHeight = 5;
    const pBarX = player.x - 6;
    const pBarY = player.y - 12;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(pBarX, pBarY, pBarWidth, pBarHeight);

    const pHealthPercent = Math.max(0, player.hp / player.maxHp);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(pBarX, pBarY, pBarWidth * pHealthPercent, pBarHeight);
  }
}
