// Logika tabrakan (Collision) & Tembakan Hitscan murni tanpa React
import { Rectangle, HitscanResult, DummyTarget } from './types';
import { GAME_CONFIG } from './constants';

/**
 * Memeriksa apakah dua kotak AABB saling bertabrakan
 */
export function isColliding(rectA: Rectangle, rectB: Rectangle): boolean {
  return (
    rectA.x < rectB.x + rectB.width &&
    rectA.x + rectA.width > rectB.x &&
    rectA.y < rectB.y + rectB.height &&
    rectA.y + rectA.height > rectB.y
  );
}

/**
 * Menggerakkan pemain dengan resolusi tabrakan dinding (sliding collision).
 * Pergerakan sumbu X dan Y dipisah agar pemain bisa menyusuri dinding dengan mulus.
 */
export function moveWithCollision(
  currentX: number,
  currentY: number,
  size: number,
  velocityX: number,
  velocityY: number,
  walls: Rectangle[]
): { x: number; y: number } {
  // 1. Coba gerakan di sumbu X terlebih dahulu
  let newX = currentX + velocityX;
  const playerBoxX: Rectangle = {
    x: newX,
    y: currentY,
    width: size,
    height: size,
  };

  for (const wall of walls) {
    if (isColliding(playerBoxX, wall)) {
      // Jika bertabrakan, batalkan gerakan di sumbu X
      newX = currentX;
      break;
    }
  }

  // 2. Coba gerakan di sumbu Y
  let newY = currentY + velocityY;
  const playerBoxY: Rectangle = {
    x: newX, // Gunakan posisi X baru yang sudah valid
    y: newY,
    width: size,
    height: size,
  };

  for (const wall of walls) {
    if (isColliding(playerBoxY, wall)) {
      // Jika bertabrakan, batalkan gerakan di sumbu Y
      newY = currentY;
      break;
    }
  }

  return { x: newX, y: newY };
}

/**
 * Menghitung perpotongan garis sinar (Ray) dengan kotak AABB menggunakan Slab Method.
 * Mengembalikan jarak t (jarak dari titik awal sinar) jika kena, atau null jika meleset.
 */
function rayIntersectsBox(
  originX: number,
  originY: number,
  dirX: number,
  dirY: number,
  box: Rectangle
): number | null {
  // Hindari pembagian dengan nol
  const invDirX = dirX !== 0 ? 1 / dirX : 1e9;
  const invDirY = dirY !== 0 ? 1 / dirY : 1e9;

  let tMinX = (box.x - originX) * invDirX;
  let tMaxX = (box.x + box.width - originX) * invDirX;

  if (tMinX > tMaxX) {
    const temp = tMinX;
    tMinX = tMaxX;
    tMaxX = temp;
  }

  let tMinY = (box.y - originY) * invDirY;
  let tMaxY = (box.y + box.height - originY) * invDirY;

  if (tMinY > tMaxY) {
    const temp = tMinY;
    tMinY = tMaxY;
    tMaxY = temp;
  }

  // Cari rentang t yang overlap
  const tEnter = Math.max(tMinX, tMinY);
  const tExit = Math.min(tMaxX, tMaxY);

  // Jika rentang masuk lebih besar dari rentang keluar, tidak ada tabrakan
  if (tEnter > tExit || tExit < 0) {
    return null;
  }

  // Kembalikan jarak benturan pertama di depan sinar
  return tEnter >= 0 ? tEnter : 0;
}

/**
 * Menghitung tembakan lurus (Hitscan).
 * Mencari objek terdekat (dinding atau dummy target) yang terkena sinar tembakan.
 */
export function calculateHitscan(
  startX: number,
  startY: number,
  targetAngle: number,
  walls: Rectangle[],
  dummies: DummyTarget[]
): HitscanResult {
  const dirX = Math.cos(targetAngle);
  const dirY = Math.sin(targetAngle);
  const maxRange = GAME_CONFIG.MAX_RANGE;

  let closestDistance = maxRange;
  let hitType: 'wall' | 'dummy' | 'none' = 'none';
  let hitDummyId: string | undefined = undefined;

  // 1. Periksa tabrakan sinar dengan semua dinding
  for (const wall of walls) {
    const t = rayIntersectsBox(startX, startY, dirX, dirY, wall);
    if (t !== null && t < closestDistance) {
      closestDistance = t;
      hitType = 'wall';
    }
  }

  // 2. Periksa tabrakan sinar dengan target dummy (hanya yang masih hidup)
  for (const dummy of dummies) {
    if (!dummy.isAlive) continue;

    const dummyBox: Rectangle = {
      x: dummy.x,
      y: dummy.y,
      width: dummy.size,
      height: dummy.size,
    };

    const t = rayIntersectsBox(startX, startY, dirX, dirY, dummyBox);
    if (t !== null && t < closestDistance) {
      closestDistance = t;
      hitType = 'dummy';
      hitDummyId = dummy.id;
    }
  }

  // Titik akhir sinar tembakan
  const hitX = startX + dirX * closestDistance;
  const hitY = startY + dirY * closestDistance;

  return {
    hit: hitType !== 'none',
    hitX,
    hitY,
    distance: closestDistance,
    hitType,
    hitDummyId,
  };
}
