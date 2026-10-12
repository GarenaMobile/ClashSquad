// Pemuat model mobil: menormalkan skala, posisi (titik pusat di tanah), dan arah depan (+Z).
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import type { CarConfig } from '../../lib/cars';

let loader: GLTFLoader | null = null;
function getLoader(): GLTFLoader {
  if (!loader) {
    const draco = new DRACOLoader();
    draco.setDecoderPath('/draco/');
    loader = new GLTFLoader();
    loader.setDRACOLoader(draco);
    loader.setMeshoptDecoder(MeshoptDecoder);
  }
  return loader;
}

const rawCache = new Map<string, Promise<THREE.Object3D>>();

function loadRaw(file: string, onProgress?: (p: number) => void): Promise<THREE.Object3D> {
  let p = rawCache.get(file);
  if (!p) {
    p = new Promise<THREE.Object3D>((resolve, reject) => {
      getLoader().load(
        file,
        (gltf) => resolve(gltf.scene),
        (e) => {
          if (onProgress && e.total) onProgress(e.loaded / e.total);
        },
        (err) => {
          rawCache.delete(file);
          reject(err);
        },
      );
    });
    rawCache.set(file, p);
  }
  return p;
}

export interface CarVisual {
  /** Posisi + arah (heading) mobil. Titik pusat ada di tanah. */
  root: THREE.Group;
  /** Badan mobil; diputar untuk efek roll/pitch. */
  body: THREE.Group;
  /** Menghapus objek ini dari scene (geometri/material model bersama tidak dibuang). */
  dispose(): void;
}

function normalize(model: THREE.Object3D, cfg: CarConfig, flip: boolean): THREE.Group {
  // Sembunyikan mesh pengganggu (misalnya "Plane" 35 m pada model Mercedes)
  model.updateMatrixWorld(true);
  const tmp = new THREE.Box3();
  const size = new THREE.Vector3();
  model.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    tmp.setFromObject(m);
    tmp.getSize(size);
    if (size.x > 9 || size.z > 9) m.visible = false;
  });

  const box = new THREE.Box3();
  model.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.visible) box.expandByObject(m);
  });
  box.getSize(size);

  const wrapper = new THREE.Group();
  wrapper.add(model);
  // jika sumbu panjang ternyata X, putar 90 derajat
  if (size.x > size.z * 1.2) {
    model.rotation.y = Math.PI / 2;
    wrapper.updateMatrixWorld(true);
    box.makeEmpty();
    model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.visible) box.expandByObject(m);
    });
    box.getSize(size);
  }

  const scale = cfg.length / Math.max(size.z, 0.001);
  const center = box.getCenter(new THREE.Vector3());
  model.scale.setScalar(scale);
  model.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);

  const body = new THREE.Group();
  body.add(wrapper);
  body.rotation.y = 0;
  wrapper.rotation.y = cfg.frontRotationY + (flip ? Math.PI : 0);
  return body;
}

export async function loadCarVisual(
  cfg: CarConfig,
  flip: boolean,
  opts?: { castShadow?: boolean; onProgress?: (p: number) => void },
): Promise<CarVisual> {
  const raw = await loadRaw(cfg.file, opts?.onProgress);
  const model = raw.clone(true);
  const body = normalize(model, cfg, flip);
  const root = new THREE.Group();
  root.add(body);
  body.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = !!opts?.castShadow;
      m.receiveShadow = false;
      m.frustumCulled = true;
    }
  });
  return {
    root,
    body,
    dispose() {
      root.removeFromParent();
    },
  };
}

/** Salinan transparan dari visual mobil (untuk ghost). Material di-clone supaya tidak memengaruhi mobil asli. */
export function makeGhostVisual(src: CarVisual): CarVisual {
  const root = src.root.clone(true);
  const mats: THREE.Material[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = false;
    const clone = (mat: THREE.Material) => {
      const c = mat.clone();
      c.transparent = true;
      c.opacity = 0.35;
      c.depthWrite = false;
      mats.push(c);
      return c;
    };
    m.material = Array.isArray(m.material) ? m.material.map(clone) : clone(m.material);
  });
  const body = root.children[0] as THREE.Group;
  return {
    root,
    body,
    dispose() {
      root.removeFromParent();
      mats.forEach((m) => m.dispose());
    },
  };
}
