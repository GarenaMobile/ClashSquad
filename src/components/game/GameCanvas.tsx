'use client';

// Komponen GameCanvas utama untuk menjalankan loop permainan, menerima input, dan merender kanvas
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GAME_CONFIG } from '@/game/constants';
import { PlayerState, DummyTarget, ShootEffect, PlayerInput } from '@/game/types';
import { moveWithCollision, calculateHitscan } from '@/game/collision';
import { ARENA_WALLS, DEFAULT_PLAYER_SPAWN, INITIAL_DUMMIES } from '@/game/map';
import { renderGame } from '@/game/renderer';
import HUD from './HUD';

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Status pemain lokal
  const playerRef = useRef<PlayerState>({
    id: 'local-player',
    x: DEFAULT_PLAYER_SPAWN.x,
    y: DEFAULT_PLAYER_SPAWN.y,
    size: GAME_CONFIG.PLAYER_SIZE,
    angle: 0,
    hp: GAME_CONFIG.PLAYER_MAX_HP,
    maxHp: GAME_CONFIG.PLAYER_MAX_HP,
    isAlive: true,
    lastShootTime: 0,
  });

  // Target dummy latihan
  const dummiesRef = useRef<DummyTarget[]>(
    JSON.parse(JSON.stringify(INITIAL_DUMMIES))
  );

  // Efek visual tembakan
  const shootEffectsRef = useRef<ShootEffect[]>([]);

  // Status input (keyboard dan mouse)
  const inputRef = useRef<PlayerInput>({
    moveUp: false,
    moveDown: false,
    moveLeft: false,
    moveRight: false,
    mouseX: 0,
    mouseY: 0,
    isShooting: false,
  });

  // Skor target dummy yang dihancurkan
  const [score, setScore] = useState(0);
  const [playerHp, setPlayerHp] = useState(GAME_CONFIG.PLAYER_MAX_HP);
  const [canShoot, setCanShoot] = useState(true);

  // Fungsi menembak (Hitscan)
  const handleShoot = useCallback(() => {
    const player = playerRef.current;
    if (!player.isAlive) return;

    const now = Date.now();
    // Periksa apakah jeda tembakan sudah selesai (cooldown)
    if (now - player.lastShootTime < GAME_CONFIG.SHOOT_COOLDOWN_MS) {
      return;
    }

    player.lastShootTime = now;
    setCanShoot(false);

    // Titik awal tembakan (tengah badan pemain)
    const startX = player.x + player.size / 2;
    const startY = player.y + player.size / 2;

    // Hitung perpotongan garis tembak dengan dinding dan dummy
    const hitResult = calculateHitscan(
      startX,
      startY,
      player.angle,
      ARENA_WALLS,
      dummiesRef.current
    );

    // Tambahkan visual garis tembakan (tracer)
    shootEffectsRef.current.push({
      id: Math.random().toString(),
      fromX: startX,
      fromY: startY,
      toX: hitResult.hitX,
      toY: hitResult.hitY,
      createdAt: now,
      hitType: hitResult.hitType,
    });

    // Jika mengenai dummy target
    if (hitResult.hit && hitResult.hitDummyId) {
      const target = dummiesRef.current.find(
        (d) => d.id === hitResult.hitDummyId
      );
      if (target && target.isAlive) {
        target.hp -= GAME_CONFIG.BULLET_DAMAGE;
        if (target.hp <= 0) {
          target.hp = 0;
          target.isAlive = false;
          target.respawnTimer = GAME_CONFIG.DUMMY_RESPAWN_DELAY_MS;
          setScore((prev) => prev + 1);
        }
      }
    }
  }, []);

  // Event listener input keyboard dan mouse
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === 'w' || key === 'arrowup') inputRef.current.moveUp = true;
      if (key === 's' || key === 'arrowdown') inputRef.current.moveDown = true;
      if (key === 'a' || key === 'arrowleft') inputRef.current.moveLeft = true;
      if (key === 'd' || key === 'arrowright') inputRef.current.moveRight = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === 'w' || key === 'arrowup') inputRef.current.moveUp = false;
      if (key === 's' || key === 'arrowdown') inputRef.current.moveDown = false;
      if (key === 'a' || key === 'arrowleft') inputRef.current.moveLeft = false;
      if (key === 'd' || key === 'arrowright') inputRef.current.moveRight = false;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const scaleX = GAME_CONFIG.MAP_WIDTH / rect.width;
      const scaleY = GAME_CONFIG.MAP_HEIGHT / rect.height;

      // Konversi koordinat mouse layar ke koordinat canvas game
      inputRef.current.mouseX = (e.clientX - rect.left) * scaleX;
      inputRef.current.mouseY = (e.clientY - rect.top) * scaleY;
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        inputRef.current.isShooting = true;
        handleShoot();
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        inputRef.current.isShooting = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    const canvasElement = canvasRef.current;
    if (canvasElement) {
      canvasElement.addEventListener('mousedown', handleMouseDown);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      if (canvasElement) {
        canvasElement.removeEventListener('mousedown', handleMouseDown);
      }
    };
  }, [handleShoot]);

  // Game Loop utama (Animasi & Logika)
  useEffect(() => {
    let animationFrameId: number;
    let lastTime = performance.now();

    const loop = (currentTime: number) => {
      const dt = Math.min((currentTime - lastTime) / 1000, 0.1); // Detik, dibatasi max 100ms
      lastTime = currentTime;

      const player = playerRef.current;
      const input = inputRef.current;
      const now = Date.now();

      // 1. Hitung arah hadap bidikan pemain
      const pCenterX = player.x + player.size / 2;
      const pCenterY = player.y + player.size / 2;
      player.angle = Math.atan2(input.mouseY - pCenterY, input.mouseX - pCenterX);

      // 2. Hitung vektor pergerakan
      let moveDirX = 0;
      let moveDirY = 0;
      if (input.moveUp) moveDirY -= 1;
      if (input.moveDown) moveDirY += 1;
      if (input.moveLeft) moveDirX -= 1;
      if (input.moveRight) moveDirX += 1;

      // Normalisasi jika bergerak diagonal agar kecepatannya seimbang
      if (moveDirX !== 0 && moveDirY !== 0) {
        moveDirX *= Math.SQRT1_2;
        moveDirY *= Math.SQRT1_2;
      }

      const velocityX = moveDirX * GAME_CONFIG.PLAYER_SPEED * dt;
      const velocityY = moveDirY * GAME_CONFIG.PLAYER_SPEED * dt;

      // Terapkan pergerakan dengan tabrakan dinding
      if (velocityX !== 0 || velocityY !== 0) {
        const newPos = moveWithCollision(
          player.x,
          player.y,
          player.size,
          velocityX,
          velocityY,
          ARENA_WALLS
        );
        player.x = newPos.x;
        player.y = newPos.y;
      }

      // 3. Tembak otomatis jika tombol mouse ditahan terus
      if (input.isShooting) {
        handleShoot();
      }

      // Perbarui status kesiapan tembak untuk HUD
      if (now - player.lastShootTime >= GAME_CONFIG.SHOOT_COOLDOWN_MS) {
        setCanShoot(true);
      }

      // 4. Update respawn timer untuk dummy target
      for (const dummy of dummiesRef.current) {
        if (!dummy.isAlive) {
          dummy.respawnTimer -= dt * 1000;
          if (dummy.respawnTimer <= 0) {
            dummy.isAlive = true;
            dummy.hp = dummy.maxHp;
            dummy.respawnTimer = 0;
          }
        }
      }

      // 5. Bersihkan efek tembakan yang sudah kedaluwarsa (> 150ms)
      shootEffectsRef.current = shootEffectsRef.current.filter(
        (eff) => now - eff.createdAt < 150
      );

      // 6. Gambar ke Canvas
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          renderGame(
            ctx,
            player,
            dummiesRef.current,
            ARENA_WALLS,
            shootEffectsRef.current
          );
        }
      }

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [handleShoot]);

  return (
    <div style={styles.container}>
      <HUD
        playerHp={playerHp}
        maxHp={GAME_CONFIG.PLAYER_MAX_HP}
        canShoot={canShoot}
        score={score}
      />

      <div style={styles.canvasWrapper}>
        <canvas
          ref={canvasRef}
          width={GAME_CONFIG.MAP_WIDTH}
          height={GAME_CONFIG.MAP_HEIGHT}
          style={styles.canvas}
        />
      </div>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
    width: '100%',
    maxWidth: '960px',
  },
  canvasWrapper: {
    position: 'relative',
    width: '100%',
    aspectRatio: `${GAME_CONFIG.MAP_WIDTH} / ${GAME_CONFIG.MAP_HEIGHT}`,
    borderRadius: '12px',
    overflow: 'hidden',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.4)',
    border: '2px solid #334155',
    backgroundColor: '#0f172a',
    cursor: 'crosshair',
  },
  canvas: {
    width: '100%',
    height: '100%',
    display: 'block',
  },
};
