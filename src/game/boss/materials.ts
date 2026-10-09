// Konfigurasi Material Stylized Toon/Cel-Shading untuk Boss Indominus Rex
import * as THREE from 'three';

/**
 * Membuat gradient map 3-tingkat untuk efek pencahayaan Cel-Shading (Toon Shading)
 */
function createToonGradientMap(): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 1;
  const ctx = canvas.getContext('2d')!;

  // 4 tingkatan warna bayangan ke terang
  const colors = ['#334155', '#64748b', '#cbd5e1', '#ffffff'];
  colors.forEach((col, idx) => {
    ctx.fillStyle = col;
    ctx.fillRect(idx, 0, 1, 1);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  return texture;
}

/**
 * Menerapkan material Toon/Cel-Shading ke seluruh bagian model Indominus Rex
 */
export function applyBossMaterials(root: THREE.Object3D) {
  // Hanya buat tekstur gradient jika di browser (window ada)
  const gradientMap = typeof window !== 'undefined' ? createToonGradientMap() : null;

  root.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      // Berikan warna kulit albino taktis (putih keabuan khas Indominus Rex)
      const matName = (mesh.material as THREE.Material)?.name?.toLowerCase() || '';

      let baseColor = new THREE.Color('#dbe4ec'); // Kulit dominan albino
      let emissive = new THREE.Color('#000000');
      let emissiveIntensity = 0;

      // Jika bagian mata (berikan aksen merah oranye predator yang menyala)
      if (matName.includes('eye') || mesh.name.toLowerCase().includes('eye')) {
        baseColor = new THREE.Color('#dc2626');
        emissive = new THREE.Color('#ef4444');
        emissiveIntensity = 0.8;
      }
      // Jika bagian gigi atau cakar
      else if (matName.includes('teeth') || matName.includes('tooth') || matName.includes('claw')) {
        baseColor = new THREE.Color('#fef3c7');
      }
      // Bagian duri/bulu leher
      else if (matName.includes('feather') || matName.includes('spike')) {
        baseColor = new THREE.Color('#475569');
      }

      mesh.material = new THREE.MeshToonMaterial({
        color: baseColor,
        gradientMap: gradientMap || undefined,
        emissive,
        emissiveIntensity,
      });
    }
  });
}
