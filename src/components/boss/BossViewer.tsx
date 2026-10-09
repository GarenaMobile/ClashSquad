'use client';

// Komponen Three.js untuk menampilkan dan menguji Boss Indominus Rex & 4 Animasi (Tahap 0)
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createBossAnimations, BossAnimationClips } from '@/game/boss/animations';
import { applyBossMaterials } from '@/game/boss/materials';

export default function BossViewer() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [currentAnim, setCurrentAnim] = useState<'idle' | 'walk' | 'lunge' | 'roar'>('idle');
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [showPlayerDummy, setShowPlayerDummy] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  const [fps, setFps] = useState<number>(60);

  // Referensi internal Three.js
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actionsRef = useRef<Record<string, THREE.AnimationAction>>({});
  const dummyMeshRef = useRef<THREE.Group | null>(null);
  const currentActionNameRef = useRef<string>('idle');

  // Mengubah animasi yang sedang aktif dengan transisi mulus (crossFade)
  const playAnimation = (animName: 'idle' | 'walk' | 'lunge' | 'roar') => {
    if (!mixerRef.current || !actionsRef.current[animName]) return;

    const prevAction = actionsRef.current[currentActionNameRef.current];
    const nextAction = actionsRef.current[animName];

    if (prevAction === nextAction) {
      if (animName === 'lunge' || animName === 'roar') {
        nextAction.reset().play();
      }
      return;
    }

    nextAction.reset();
    nextAction.timeScale = playbackSpeed;

    if (animName === 'lunge' || animName === 'roar') {
      nextAction.setLoop(THREE.LoopOnce, 1);
      nextAction.clampWhenFinished = true;
    } else {
      nextAction.setLoop(THREE.LoopRepeat, Infinity);
    }

    if (prevAction) {
      prevAction.crossFadeTo(nextAction, 0.35, true);
    }
    nextAction.play();

    currentActionNameRef.current = animName;
    setCurrentAnim(animName);
  };

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#020617');
    scene.fog = new THREE.FogExp2('#020617', 0.02);

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    camera.position.set(0, 4.5, 14);

    // 3. Renderer (Optimasi: pixel ratio dibatasi untuk laptop sekolah)
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.BasicShadowMap; // Shadow murah untuk performa
    container.appendChild(renderer.domElement);

    // 4. Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 3.5, 0);
    controls.maxPolarAngle = Math.PI / 2 - 0.02; // Tidak tembus tanah
    controls.minDistance = 4;
    controls.maxDistance = 25;

    // 5. Pencahayaan Taktis
    const ambientLight = new THREE.AmbientLight('#94a3b8', 1.2);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight('#ffffff', 2.0);
    dirLight.position.set(8, 16, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 1;
    dirLight.shadow.camera.far = 40;
    const d = 12;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    scene.add(dirLight);

    // Rim light biru (gaya game taktis Valorant)
    const rimLight = new THREE.DirectionalLight('#38bdf8', 1.5);
    rimLight.position.set(-8, 6, -10);
    scene.add(rimLight);

    // 6. Lantai Arena & Grid
    const floorGeo = new THREE.PlaneGeometry(60, 60);
    const floorMat = new THREE.MeshStandardMaterial({
      color: '#0f172a',
      roughness: 0.85,
      metalness: 0.1,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Grid lingkaran taktis arena
    const gridHelper = new THREE.GridHelper(40, 40, '#38bdf8', '#1e293b');
    gridHelper.position.y = 0.01;
    scene.add(gridHelper);

    // Lingkaran zona tengah (Leash Zone Boss)
    const ringGeo = new THREE.RingGeometry(8.9, 9.1, 64);
    const ringMat = new THREE.MeshBasicMaterial({ color: '#ef4444', side: THREE.DoubleSide, transparent: true, opacity: 0.6 });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.y = 0.02;
    scene.add(ringMesh);

    // 7. Mannequin Pembanding Tinggi Pemain (1.8m)
    const dummyGroup = new THREE.Group();
    // Badan (tinggi 1.8m)
    const playerGeo = new THREE.CylinderGeometry(0.3, 0.3, 1.8, 16);
    const playerMat = new THREE.MeshStandardMaterial({ color: '#38bdf8', roughness: 0.5 });
    const playerMesh = new THREE.Mesh(playerGeo, playerMat);
    playerMesh.position.y = 0.9;
    playerMesh.castShadow = true;
    dummyGroup.add(playerMesh);

    // Kepala pemain
    const headGeo = new THREE.SphereGeometry(0.22, 16, 16);
    const headMat = new THREE.MeshStandardMaterial({ color: '#f8fafc' });
    const headMesh = new THREE.Mesh(headGeo, headMat);
    headMesh.position.y = 1.9;
    headMesh.castShadow = true;
    dummyGroup.add(headMesh);

    dummyGroup.position.set(-3.5, 0, 2);
    scene.add(dummyGroup);
    dummyMeshRef.current = dummyGroup;

    // 8. Muat Model GLB Teroptimasi
    const loader = new GLTFLoader();
    loader.load(
      '/models/indominus_rex.glb',
      (gltf) => {
        const model = gltf.scene;

        // Terapkan material Cel-Shading
        applyBossMaterials(model);

        // Skala: model asli tingginya ~9.08m, skala 1.0 = ~5.04x tinggi pemain (1.8m)
        // Kita gunakan skala 1.1x sehingga tingginya ~10m (±5.5 kali tinggi pemain)
        model.scale.set(1.1, 1.1, 1.1);
        model.position.set(0, 0, 0);
        scene.add(model);

        // Buat 4 animasi kustom
        const clips: BossAnimationClips = createBossAnimations(model);

        // Setup AnimationMixer
        const mixer = new THREE.AnimationMixer(model);
        mixerRef.current = mixer;

        const idleAction = mixer.clipAction(clips.idle);
        const walkAction = mixer.clipAction(clips.walk);
        const lungeAction = mixer.clipAction(clips.lunge);
        const roarAction = mixer.clipAction(clips.roar);

        actionsRef.current = {
          idle: idleAction,
          walk: walkAction,
          lunge: lungeAction,
          roar: roarAction,
        };

        // Otomatis putar idle
        idleAction.play();
        currentActionNameRef.current = 'idle';

        // Listener saat animasi one-shot (lunge / roar) selesai, kembali ke idle
        mixer.addEventListener('finished', (e: { action: THREE.AnimationAction }) => {
          if (e.action === lungeAction || e.action === roarAction) {
            e.action.crossFadeTo(idleAction, 0.4, true);
            idleAction.reset().play();
            currentActionNameRef.current = 'idle';
            setCurrentAnim('idle');
          }
        });

        setIsLoading(false);
      },
      (xhr) => {
        if (xhr.total > 0) {
          setLoadingProgress(Math.round((xhr.loaded / xhr.total) * 100));
        }
      },
      (error) => {
        console.error('Gagal memuat model Indominus Rex:', error);
        setIsLoading(false);
      }
    );

    // 9. Render & Animation Loop
    let lastTime = performance.now();
    let frameCounter = 0;
    let lastFpsTime = performance.now();
    let animationId: number;

    const animate = (currentTime: number) => {
      animationId = requestAnimationFrame(animate);

      const delta = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      // Update Animation Mixer
      if (mixerRef.current) {
        mixerRef.current.update(delta);
      }

      controls.update();
      renderer.render(scene, camera);

      // Hitung FPS
      frameCounter++;
      if (currentTime - lastFpsTime >= 1000) {
        setFps(frameCounter);
        frameCounter = 0;
        lastFpsTime = currentTime;
      }
    };

    animationId = requestAnimationFrame(animate);

    // Resize handler
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Sinkronisasi dummy pemain
  useEffect(() => {
    if (dummyMeshRef.current) {
      dummyMeshRef.current.visible = showPlayerDummy;
    }
  }, [showPlayerDummy]);

  // Sinkronisasi playback speed
  useEffect(() => {
    if (mixerRef.current) {
      mixerRef.current.timeScale = playbackSpeed;
    }
  }, [playbackSpeed]);

  return (
    <div style={styles.viewerContainer}>
      {/* Kanvas 3D Three.js */}
      <div ref={containerRef} style={styles.canvasContainer}>
        {isLoading && (
          <div style={styles.loadingOverlay}>
            <div style={styles.loadingSpinner} />
            <p style={styles.loadingText}>Memuat Model Indominus Rex Teroptimasi... {loadingProgress}%</p>
            <span style={styles.loadingSub}>Menginisialisasi 237 sendi tulang & generator 4 animasi...</span>
          </div>
        )}
      </div>

      {/* Panel Kontrol & Informasi */}
      <div style={styles.dashboardPanel}>
        {/* Kontrol Animasi */}
        <div style={styles.controlSection}>
          <div style={styles.sectionHeader}>
            <span style={styles.sectionTitle}>UJI 4 ANIMASI BOSS</span>
            <span style={styles.badgeFps}>{fps} FPS</span>
          </div>

          <div style={styles.buttonGrid}>
            <button
              onClick={() => playAnimation('idle')}
              style={{
                ...styles.animBtn,
                ...(currentAnim === 'idle' ? styles.animBtnActive : {}),
              }}
            >
              🟢 Idle (Diam)
            </button>
            <button
              onClick={() => playAnimation('walk')}
              style={{
                ...styles.animBtn,
                ...(currentAnim === 'walk' ? styles.animBtnActive : {}),
              }}
            >
              🚶 Walk (Jalan)
            </button>
            <button
              onClick={() => playAnimation('lunge')}
              style={{
                ...styles.animBtn,
                ...(currentAnim === 'lunge' ? styles.animBtnActive : {}),
              }}
            >
              ⚡ Lunge (Serang)
            </button>
            <button
              onClick={() => playAnimation('roar')}
              style={{
                ...styles.animBtn,
                ...(currentAnim === 'roar' ? styles.animBtnActive : {}),
              }}
            >
              🔊 Roar (Raung)
            </button>
          </div>

          {/* Pengatur Kecepatan Animasi */}
          <div style={styles.sliderRow}>
            <span style={styles.label}>Kecepatan:</span>
            {[0.5, 1.0, 1.5].map((speed) => (
              <button
                key={speed}
                onClick={() => setPlaybackSpeed(speed)}
                style={{
                  ...styles.speedBtn,
                  ...(playbackSpeed === speed ? styles.speedBtnActive : {}),
                }}
              >
                {speed}x
              </button>
            ))}
          </div>

          {/* Toggle Pembanding Tinggi Pemain */}
          <div style={styles.toggleRow}>
            <label style={styles.toggleLabel}>
              <input
                type="checkbox"
                checked={showPlayerDummy}
                onChange={(e) => setShowPlayerDummy(e.target.checked)}
                style={styles.checkbox}
              />
              Tampilkan Pembanding Pemain (Tinggi 1.8m)
            </label>
          </div>
        </div>

        {/* Spesifikasi Model & Optimasi */}
        <div style={styles.statsSection}>
          <span style={styles.sectionTitle}>HASIL OPTIMASI ASET (TAHAP 0)</span>
          <div style={styles.specsGrid}>
            <div style={styles.specItem}>
              <span style={styles.specLabel}>Ukuran File</span>
              <span style={styles.specValueHighlight}>2.49 MB</span>
              <span style={styles.specNote}>Turun dari 8.62 MB (-71%)</span>
            </div>
            <div style={styles.specItem}>
              <span style={styles.specLabel}>Jumlah Segitiga</span>
              <span style={styles.specValueHighlight}>51,776</span>
              <span style={styles.specNote}>Target: 40k–60k poligon</span>
            </div>
            <div style={styles.specItem}>
              <span style={styles.specLabel}>Perbandingan Skala</span>
              <span style={styles.specValue}>±5.5x Tinggi Pemain</span>
              <span style={styles.specNote}>Boss: ~10m | Pemain: 1.8m</span>
            </div>
            <div style={styles.specItem}>
              <span style={styles.specLabel}>Tulang Rig (Skin)</span>
              <span style={styles.specValue}>237 Tulang</span>
              <span style={styles.specNote}>Animasi 30 FPS baked</span>
            </div>
          </div>

          <div style={styles.helpText}>
            💡 <strong>Panduan Interaksi 3D:</strong> Klik & geser mouse untuk memutar kamera • Scroll roda mouse untuk zoom in/out • Klik kanan & geser untuk menggeser sudut pandang.
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  viewerContainer: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    maxWidth: '1080px',
    backgroundColor: '#0f172a',
    borderRadius: '16px',
    border: '1px solid #334155',
    overflow: 'hidden',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
  },
  canvasContainer: {
    position: 'relative',
    width: '100%',
    height: '540px',
    backgroundColor: '#020617',
    cursor: 'grab',
  },
  loadingOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(2, 6, 23, 0.92)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    zIndex: 10,
  },
  loadingSpinner: {
    width: '42px',
    height: '42px',
    border: '4px solid #1e293b',
    borderTop: '4px solid #38bdf8',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  loadingSub: {
    fontSize: '12px',
    color: '#94a3b8',
  },
  dashboardPanel: {
    display: 'grid',
    gridTemplateColumns: '1.2fr 1.8fr',
    gap: '20px',
    padding: '20px 24px',
    backgroundColor: '#0f172a',
    borderTop: '1px solid #1e293b',
  },
  controlSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  statsSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: '12px',
    fontWeight: '800',
    letterSpacing: '0.08em',
    color: '#38bdf8',
  },
  badgeFps: {
    fontSize: '11px',
    fontWeight: 'bold',
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    color: '#10b981',
    border: '1px solid rgba(16, 185, 129, 0.4)',
    padding: '2px 8px',
    borderRadius: '6px',
  },
  buttonGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '8px',
  },
  animBtn: {
    padding: '10px 12px',
    backgroundColor: '#1e293b',
    color: '#f8fafc',
    border: '1px solid #334155',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  animBtnActive: {
    backgroundColor: '#0284c7',
    borderColor: '#38bdf8',
    boxShadow: '0 0 12px rgba(56, 189, 248, 0.4)',
  },
  sliderRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  label: {
    fontSize: '12px',
    color: '#94a3b8',
  },
  speedBtn: {
    padding: '4px 10px',
    backgroundColor: '#1e293b',
    color: '#94a3b8',
    border: '1px solid #334155',
    borderRadius: '6px',
    fontSize: '11px',
    cursor: 'pointer',
  },
  speedBtnActive: {
    backgroundColor: '#334155',
    color: '#f8fafc',
    borderColor: '#64748b',
    fontWeight: 'bold',
  },
  toggleRow: {
    display: 'flex',
    alignItems: 'center',
  },
  toggleLabel: {
    fontSize: '12px',
    color: '#cbd5e1',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer',
  },
  checkbox: {
    cursor: 'pointer',
  },
  specsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '10px',
  },
  specItem: {
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '8px',
    padding: '8px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  specLabel: {
    fontSize: '11px',
    color: '#94a3b8',
  },
  specValue: {
    fontSize: '13px',
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  specValueHighlight: {
    fontSize: '14px',
    fontWeight: '800',
    color: '#38bdf8',
  },
  specNote: {
    fontSize: '10px',
    color: '#64748b',
  },
  helpText: {
    fontSize: '11px',
    color: '#94a3b8',
    backgroundColor: 'rgba(51, 65, 85, 0.4)',
    padding: '8px 12px',
    borderRadius: '8px',
    border: '1px solid #334155',
    lineHeight: 1.4,
  },
};
