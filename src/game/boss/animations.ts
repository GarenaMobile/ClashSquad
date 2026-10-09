// Generator Animasi Kustom untuk Boss Indominus Rex (Tahap 0)
// Menghasilkan 4 animasi: Idle, Walk/Run, Lunge (Serangan), dan Roar (Raungan)
// Menggunakan pemanggangan keyframe quaternion 30 FPS untuk interpolasi halus di AnimationMixer.

import * as THREE from 'three';

export interface BossAnimationClips {
  idle: THREE.AnimationClip;
  walk: THREE.AnimationClip;
  lunge: THREE.AnimationClip;
  roar: THREE.AnimationClip;
}

/**
 * Mengambil referensi tulang-tulang penting dari model Indominus Rex
 */
function findBones(root: THREE.Object3D) {
  const bones: Record<string, THREE.Bone> = {};
  root.traverse((child) => {
    if ((child as THREE.Bone).isBone || child.type === 'Bone') {
      bones[child.name] = child as THREE.Bone;
    }
  });
  return bones;
}

/**
 * Membuat track rotasi quaternion untuk satu tulang dengan sampling 30 FPS
 */
function createBoneTrack(
  bone: THREE.Bone,
  duration: number,
  fps: number,
  rotationSampler: (time: number, progress: number) => { x: number; y: number; z: number }
): THREE.QuaternionKeyframeTrack {
  const frameCount = Math.floor(duration * fps) + 1;
  const times = new Float32Array(frameCount);
  const values = new Float32Array(frameCount * 4);

  const restQ = bone.quaternion.clone();
  const deltaEuler = new THREE.Euler(0, 0, 0, 'XYZ');
  const deltaQ = new THREE.Quaternion();
  const frameQ = new THREE.Quaternion();

  for (let i = 0; i < frameCount; i++) {
    const t = Math.min(i / fps, duration);
    const progress = t / duration;
    times[i] = t;

    const { x, y, z } = rotationSampler(t, progress);
    deltaEuler.set(x, y, z, 'XYZ');
    deltaQ.setFromEuler(deltaEuler);

    // Kalikan rotasi dasar dengan rotasi animasi lokal
    frameQ.copy(restQ).multiply(deltaQ);

    const valIdx = i * 4;
    values[valIdx] = frameQ.x;
    values[valIdx + 1] = frameQ.y;
    values[valIdx + 2] = frameQ.z;
    values[valIdx + 3] = frameQ.w;
  }

  return new THREE.QuaternionKeyframeTrack(`${bone.name}.quaternion`, Array.from(times), Array.from(values));
}

/**
 * Membuat track posisi untuk tulang utama (posisi naik-turun atau meluncur)
 */
function createPositionTrack(
  bone: THREE.Bone,
  duration: number,
  fps: number,
  positionSampler: (time: number, progress: number) => { x: number; y: number; z: number }
): THREE.VectorKeyframeTrack {
  const frameCount = Math.floor(duration * fps) + 1;
  const times = new Float32Array(frameCount);
  const values = new Float32Array(frameCount * 3);

  const restPos = bone.position.clone();

  for (let i = 0; i < frameCount; i++) {
    const t = Math.min(i / fps, duration);
    const progress = t / duration;
    times[i] = t;

    const offset = positionSampler(t, progress);
    const valIdx = i * 3;
    values[valIdx] = restPos.x + offset.x;
    values[valIdx + 1] = restPos.y + offset.y;
    values[valIdx + 2] = restPos.z + offset.z;
  }

  return new THREE.VectorKeyframeTrack(`${bone.name}.position`, Array.from(times), Array.from(values));
}

/**
 * Menghasilkan kumpulan 4 AnimationClip untuk Boss Indominus Rex
 */
export function createBossAnimations(root: THREE.Object3D): BossAnimationClips {
  const bones = findBones(root);
  const fps = 30;

  // -------------------------------------------------------------
  // 1. ANIMASI IDLE (Diam Bernapas & Ekor Berayun) - Durasi 3.0 detik
  // -------------------------------------------------------------
  const idleTracks: THREE.KeyframeTrack[] = [];
  const idleDuration = 3.0;

  // Gerak napas tubuh / tulang belakang
  if (bones['DEF_back_01']) {
    idleTracks.push(
      createBoneTrack(bones['DEF_back_01'], idleDuration, fps, (t) => {
        const breath = Math.sin((t / idleDuration) * Math.PI * 2) * 0.04;
        return { x: breath, y: 0, z: 0 };
      })
    );
  }

  // Leher sedikit bergerak mengamati
  if (bones['DEF_neck_01']) {
    idleTracks.push(
      createBoneTrack(bones['DEF_neck_01'], idleDuration, fps, (t) => {
        const neckPitch = Math.sin((t / idleDuration) * Math.PI * 2) * 0.03;
        const neckYaw = Math.cos((t / idleDuration) * Math.PI * 2) * 0.05;
        return { x: neckPitch, y: neckYaw, z: 0 };
      })
    );
  }

  // Ayunan ekor (gelombang halus berantai dari pangkal ke ujung)
  const tailBones = [
    'DEF_tail_01', 'DEF_tail_02', 'DEF_tail_03', 'DEF_tail_04',
    'DEF_tail_05', 'DEF_tail_06', 'DEF_tail_07', 'DEF_tail_08',
  ];
  tailBones.forEach((name, index) => {
    if (bones[name]) {
      const phaseOffset = index * 0.35;
      const amplitude = 0.04 + index * 0.015;
      idleTracks.push(
        createBoneTrack(bones[name], idleDuration, fps, (t) => {
          const sway = Math.sin((t / idleDuration) * Math.PI * 2 + phaseOffset) * amplitude;
          return { x: 0, y: sway, z: 0 };
        })
      );
    }
  });

  // Sedikit gerak lengan depan
  if (bones['DEF_armupper.L']) {
    idleTracks.push(
      createBoneTrack(bones['DEF_armupper.L'], idleDuration, fps, (t) => {
        return { x: Math.sin(t * 2) * 0.02, y: 0, z: 0 };
      })
    );
  }
  if (bones['DEF_armupper.R']) {
    idleTracks.push(
      createBoneTrack(bones['DEF_armupper.R'], idleDuration, fps, (t) => {
        return { x: Math.sin(t * 2 + Math.PI) * 0.02, y: 0, z: 0 };
      })
    );
  }

  const idleClip = new THREE.AnimationClip('idle', idleDuration, idleTracks);

  // -------------------------------------------------------------
  // 2. ANIMASI WALK (Langkah Kaki Berantai & Menjejak) - Durasi 1.2 detik
  // -------------------------------------------------------------
  const walkTracks: THREE.KeyframeTrack[] = [];
  const walkDuration = 1.2;

  // Pantulan badan naik-turun dan sedikit goyang menyamping
  if (bones['CTRL_main']) {
    walkTracks.push(
      createPositionTrack(bones['CTRL_main'], walkDuration, fps, (t) => {
        // Naik turun 2 kali dalam 1 siklus langkah (kiri dan kanan)
        const bounceY = Math.abs(Math.sin((t / walkDuration) * Math.PI * 2)) * 0.12 - 0.06;
        const swayX = Math.sin((t / walkDuration) * Math.PI * 2) * 0.08;
        return { x: swayX, y: bounceY, z: 0 };
      })
    );
  }

  // Kaki Kiri: Ayunan paha, lekukan lutut, dan pergelangan kaki
  if (bones['DEF_legfemur.L']) {
    walkTracks.push(
      createBoneTrack(bones['DEF_legfemur.L'], walkDuration, fps, (t) => {
        const phase = (t / walkDuration) * Math.PI * 2;
        const swing = Math.sin(phase) * 0.42;
        return { x: swing, y: 0, z: 0 };
      })
    );
  }
  if (bones['DEF_legtibia.L']) {
    walkTracks.push(
      createBoneTrack(bones['DEF_legtibia.L'], walkDuration, fps, (t) => {
        const phase = (t / walkDuration) * Math.PI * 2;
        // Tekuk lutut saat mengangkat kaki (fase positif)
        const kneeBend = Math.max(0, Math.sin(phase)) * 0.55;
        return { x: -kneeBend, y: 0, z: 0 };
      })
    );
  }
  if (bones['DEF_footmetatarsus.L']) {
    walkTracks.push(
      createBoneTrack(bones['DEF_footmetatarsus.L'], walkDuration, fps, (t) => {
        const phase = (t / walkDuration) * Math.PI * 2;
        const footFlex = Math.sin(phase - 0.5) * 0.25;
        return { x: footFlex, y: 0, z: 0 };
      })
    );
  }

  // Kaki Kanan: Beda fase 180 derajat (Math.PI) dari kaki kiri
  if (bones['DEF_legfemur.R']) {
    walkTracks.push(
      createBoneTrack(bones['DEF_legfemur.R'], walkDuration, fps, (t) => {
        const phase = (t / walkDuration) * Math.PI * 2 + Math.PI;
        const swing = Math.sin(phase) * 0.42;
        return { x: swing, y: 0, z: 0 };
      })
    );
  }
  if (bones['DEF_legtibia.R']) {
    walkTracks.push(
      createBoneTrack(bones['DEF_legtibia.R'], walkDuration, fps, (t) => {
        const phase = (t / walkDuration) * Math.PI * 2 + Math.PI;
        const kneeBend = Math.max(0, Math.sin(phase)) * 0.55;
        return { x: -kneeBend, y: 0, z: 0 };
      })
    );
  }
  if (bones['DEF_footmetatarsus.R']) {
    walkTracks.push(
      createBoneTrack(bones['DEF_footmetatarsus.R'], walkDuration, fps, (t) => {
        const phase = (t / walkDuration) * Math.PI * 2 + Math.PI;
        const footFlex = Math.sin(phase - 0.5) * 0.25;
        return { x: footFlex, y: 0, z: 0 };
      })
    );
  }

  // Ayunan lengan mengimbangi langkah kaki
  if (bones['DEF_armupper.L']) {
    walkTracks.push(
      createBoneTrack(bones['DEF_armupper.L'], walkDuration, fps, (t) => {
        const phase = (t / walkDuration) * Math.PI * 2 + Math.PI;
        return { x: Math.sin(phase) * 0.25, y: 0, z: 0 };
      })
    );
  }
  if (bones['DEF_armupper.R']) {
    walkTracks.push(
      createBoneTrack(bones['DEF_armupper.R'], walkDuration, fps, (t) => {
        const phase = (t / walkDuration) * Math.PI * 2;
        return { x: Math.sin(phase) * 0.25, y: 0, z: 0 };
      })
    );
  }

  // Ekor mengimbangi langkah dengan dinamis
  tailBones.forEach((name, index) => {
    if (bones[name]) {
      const phaseOffset = index * 0.45;
      const amplitude = 0.08 + index * 0.02;
      walkTracks.push(
        createBoneTrack(bones[name], walkDuration, fps, (t) => {
          const sway = Math.sin((t / walkDuration) * Math.PI * 2 - phaseOffset) * amplitude;
          return { x: 0, y: sway, z: 0 };
        })
      );
    }
  });

  const walkClip = new THREE.AnimationClip('walk', walkDuration, walkTracks);

  // -------------------------------------------------------------
  // 3. ANIMASI LUNGE (Serangan Terkaman & Gigitan Kilat) - Durasi 1.1 detik
  // -------------------------------------------------------------
  const lungeTracks: THREE.KeyframeTrack[] = [];
  const lungeDuration = 1.1;

  // Gerak meluncur badan utama: mundur ancang-ancang -> meluncur maju menyergap -> kembali
  if (bones['CTRL_main']) {
    lungeTracks.push(
      createPositionTrack(bones['CTRL_main'], lungeDuration, fps, (_t, p) => {
        let dz = 0;
        let dy = 0;
        if (p < 0.25) {
          // Ancang-ancang mundur ke belakang
          const sub = p / 0.25;
          dz = -0.5 * Math.sin(sub * Math.PI * 0.5);
          dy = 0.1 * sub;
        } else if (p < 0.55) {
          // Meluncur maju kencang ke depan
          const sub = (p - 0.25) / 0.3;
          dz = -0.5 + 2.2 * Math.sin(sub * Math.PI * 0.5);
          dy = 0.1 - 0.35 * Math.sin(sub * Math.PI);
        } else {
          // Kembali ke posisi normal
          const sub = (p - 0.55) / 0.45;
          dz = 1.7 * (1 - sub);
          dy = -0.1 * (1 - sub);
        }
        return { x: 0, y: dy, z: dz };
      })
    );
  }

  // Leher merunduk lalu menyergap ke bawah
  if (bones['DEF_neck_01']) {
    lungeTracks.push(
      createBoneTrack(bones['DEF_neck_01'], lungeDuration, fps, (_t, p) => {
        let pitch = 0;
        if (p < 0.25) {
          // Menarik kepala ke belakang
          pitch = 0.15 * (p / 0.25);
        } else if (p < 0.55) {
          // Menyentak ke depan dan ke bawah (snap strike)
          const sub = (p - 0.25) / 0.3;
          pitch = 0.15 - 0.55 * Math.sin(sub * Math.PI * 0.5);
        } else {
          // Pemulihan kembali
          const sub = (p - 0.55) / 0.45;
          pitch = -0.4 * (1 - sub);
        }
        return { x: pitch, y: 0, z: 0 };
      })
    );
  }

  // Rahang Bawah (DEF_jawdw): Terbuka lebar saat menyergap lalu mengatup keras (snap bite!)
  if (bones['DEF_jawdw']) {
    lungeTracks.push(
      createBoneTrack(bones['DEF_jawdw'], lungeDuration, fps, (_t, p) => {
        let openJaw = 0;
        if (p >= 0.2 && p < 0.45) {
          // Rahang membuka lebar
          const sub = (p - 0.2) / 0.25;
          openJaw = 0.58 * Math.sin(sub * Math.PI * 0.5);
        } else if (p >= 0.45 && p < 0.55) {
          // Mengatup cepat dan keras (snap bite)
          const sub = (p - 0.45) / 0.1;
          openJaw = 0.58 * (1 - sub);
        }
        return { x: openJaw, y: 0, z: 0 };
      })
    );
  }

  const lungeClip = new THREE.AnimationClip('lunge', lungeDuration, lungeTracks);

  // -------------------------------------------------------------
  // 4. ANIMASI ROAR (Raungan Keras Mengguncang Saat Dijinakkan) - Durasi 2.2 detik
  // -------------------------------------------------------------
  const roarTracks: THREE.KeyframeTrack[] = [];
  const roarDuration = 2.2;

  // Badan tegak mendongak
  if (bones['DEF_back_01']) {
    roarTracks.push(
      createBoneTrack(bones['DEF_back_01'], roarDuration, fps, (_t, p) => {
        let arch = 0;
        if (p < 0.3) {
          arch = -0.25 * (p / 0.3);
        } else if (p < 0.8) {
          // Sedikit getaran dada saat mengaum
          const tremor = Math.sin(p * 50) * 0.02;
          arch = -0.25 + tremor;
        } else {
          arch = -0.25 * (1 - (p - 0.8) / 0.2);
        }
        return { x: arch, y: 0, z: 0 };
      })
    );
  }

  // Leher mendongak tinggi ke langit
  if (bones['DEF_neck_01']) {
    roarTracks.push(
      createBoneTrack(bones['DEF_neck_01'], roarDuration, fps, (_t, p) => {
        let pitch = 0;
        if (p < 0.35) {
          pitch = 0.45 * (p / 0.35);
        } else if (p < 0.8) {
          // Getaran kepala saat auman memuncak
          const tremor = Math.sin(p * 45) * 0.035;
          pitch = 0.45 + tremor;
        } else {
          pitch = 0.45 * (1 - (p - 0.8) / 0.2);
        }
        return { x: pitch, y: 0, z: 0 };
      })
    );
  }

  // Mulut membuka maksimal selama raungan
  if (bones['DEF_jawdw']) {
    roarTracks.push(
      createBoneTrack(bones['DEF_jawdw'], roarDuration, fps, (_t, p) => {
        let openJaw = 0;
        if (p < 0.35) {
          openJaw = 0.72 * (p / 0.35);
        } else if (p < 0.8) {
          const tremor = Math.sin(p * 40) * 0.03;
          openJaw = 0.72 + tremor;
        } else {
          openJaw = 0.72 * (1 - (p - 0.8) / 0.2);
        }
        return { x: openJaw, y: 0, z: 0 };
      })
    );
  }

  const roarClip = new THREE.AnimationClip('roar', roarDuration, roarTracks);

  return {
    idle: idleClip,
    walk: walkClip,
    lunge: lungeClip,
    roar: roarClip,
  };
}
