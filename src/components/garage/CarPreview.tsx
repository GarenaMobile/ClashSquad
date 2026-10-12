'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { loadCarVisual, type CarVisual } from '@/game/render/carModel';
import type { CarConfig } from '@/lib/cars';

interface Api {
  setCar(c: CarConfig, flip: boolean): void;
}

export default function CarPreview({ car, flip, onLoading }: { car: CarConfig; flip: boolean; onLoading?: (l: boolean) => void }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<Api | null>(null);
  const loadingCb = useRef(onLoading);
  loadingCb.current = onLoading;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let disposed = false;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = false;
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.touchAction = 'none';

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envRT.texture;
    scene.environmentIntensity = 1.0;
    pmrem.dispose();

    const key = new THREE.DirectionalLight(0xfff1dd, 2.2);
    key.position.set(4, 6, 5);
    const rim = new THREE.DirectionalLight(0x6fb8ff, 1.6);
    rim.position.set(-5, 3, -4);
    scene.add(key, rim);

    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(4.4, 4.6, 0.12, 64),
      new THREE.MeshStandardMaterial({ color: '#171a24', roughness: 0.5, metalness: 0.6 }),
    );
    disc.position.y = -0.06;
    scene.add(disc);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(4.45, 0.04, 8, 96),
      new THREE.MeshBasicMaterial({ color: '#ff9f1c' }),
    );
    ring.rotation.x = Math.PI / 2;
    scene.add(ring);

    const pivot = new THREE.Group();
    scene.add(pivot);

    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
    camera.position.set(0, 1.9, 9.2);
    camera.lookAt(0, 0.75, 0);

    const resize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      if (w < 2 || h < 2) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    let visual: CarVisual | null = null;
    let token = 0;
    const api: Api = {
      setCar(c, f) {
        const my = ++token;
        loadingCb.current?.(true);
        loadCarVisual(c, f)
          .then((v) => {
            if (disposed || my !== token) {
              v.dispose();
              return;
            }
            if (visual) visual.dispose();
            visual = v;
            pivot.add(v.root);
            loadingCb.current?.(false);
          })
          .catch((e) => {
            console.error(e);
            if (my === token) loadingCb.current?.(false);
          });
      },
    };
    apiRef.current = api;

    // putar dengan drag
    let dragging = false;
    let lastX = 0;
    let idle = 0;
    const down = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      renderer.domElement.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      pivot.rotation.y += (e.clientX - lastX) * 0.01;
      lastX = e.clientX;
      idle = 0;
    };
    const up = () => {
      dragging = false;
    };
    renderer.domElement.addEventListener('pointerdown', down);
    renderer.domElement.addEventListener('pointermove', move);
    renderer.domElement.addEventListener('pointerup', up);
    renderer.domElement.addEventListener('pointercancel', up);

    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      idle += dt;
      if (!dragging && idle > 0.4) pivot.rotation.y += dt * 0.5;
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener('pointerdown', down);
      renderer.domElement.removeEventListener('pointermove', move);
      renderer.domElement.removeEventListener('pointerup', up);
      renderer.domElement.removeEventListener('pointercancel', up);
      visual?.dispose();
      envRT.dispose();
      disc.geometry.dispose();
      (disc.material as THREE.Material).dispose();
      ring.geometry.dispose();
      (ring.material as THREE.Material).dispose();
      renderer.dispose();
      renderer.domElement.remove();
      apiRef.current = null;
    };
  }, []);

  useEffect(() => {
    apiRef.current?.setCar(car, flip);
  }, [car, flip]);

  return <div ref={mountRef} className="preview-canvas" />;
}
