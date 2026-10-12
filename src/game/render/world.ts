// ====================================================================
// DUNIA 3D: langit senja, cahaya, tanah, sirkuit (aspal, kerb, dinding),
// gerbang start/finish, tribun, pepohonan, tiang lampu.
// ====================================================================
import * as THREE from 'three';
import { KERB_W, ROAD_HALF, WALL_INNER, type Track } from '../track';
import type { QualitySettings } from './quality';
import * as TX from './textures';

const WALL_H = 1.15;

export interface World {
  scene: THREE.Scene;
  sun: THREE.DirectionalLight;
  sunDir: THREE.Vector3;
  update(camPos: THREE.Vector3, focus: THREE.Vector3): void;
  dispose(): void;
}

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const SKY_FRAG = /* glsl */ `
uniform vec3 uSunDir;
varying vec3 vDir;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p *= 2.02;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 zenith = vec3(0.10, 0.20, 0.48);
  vec3 mid = vec3(0.42, 0.52, 0.80);
  vec3 horizon = vec3(0.96, 0.69, 0.50);
  vec3 ground = vec3(0.34, 0.27, 0.22);
  vec3 col;
  if (h >= 0.0) {
    float t1 = smoothstep(0.0, 0.2, h);
    float t2 = smoothstep(0.1, 0.75, h);
    col = mix(horizon, mid, t1);
    col = mix(col, zenith, t2);
  } else {
    col = mix(horizon * 0.85, ground, smoothstep(0.0, -0.25, h));
  }
  vec3 sd3 = normalize(uSunDir);
  float sd = max(dot(d, sd3), 0.0);
  col += vec3(1.0, 0.72, 0.42) * pow(sd, 6.0) * 0.5;
  col += vec3(1.0, 0.85, 0.6) * pow(sd, 64.0) * 0.8;
  col += vec3(1.0, 0.95, 0.85) * smoothstep(0.9993, 0.9998, sd) * 1.4;
  if (h > 0.02) {
    vec2 uv = d.xz / (h + 0.25) * 1.4 + vec2(3.0, 1.0);
    float c = fbm(uv * 1.2);
    float cl = smoothstep(0.52, 0.78, c) * smoothstep(0.02, 0.25, h);
    vec3 cc = mix(vec3(0.95, 0.55, 0.40), vec3(1.0, 0.85, 0.70), pow(sd, 2.0));
    col = mix(col, cc, cl * 0.55);
  }
  gl_FragColor = vec4(col, 1.0);
}
`;

function skyMaterial(sunDir: THREE.Vector3): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uSunDir: { value: sunDir.clone() } },
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
}

class Mesher {
  pos: number[] = [];
  uv: number[] = [];
  idx: number[] = [];
  private vc = 0;

  quad(
    a: [number, number, number],
    b: [number, number, number],
    c: [number, number, number],
    d: [number, number, number],
    uva: [number, number],
    uvb: [number, number],
    uvc: [number, number],
    uvd: [number, number],
  ) {
    this.pos.push(...a, ...b, ...c, ...d);
    this.uv.push(...uva, ...uvb, ...uvc, ...uvd);
    this.idx.push(this.vc, this.vc + 1, this.vc + 2, this.vc, this.vc + 2, this.vc + 3);
    this.vc += 4;
  }

  build(flatUp = false): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.idx);
    if (flatUp) {
      const n: number[] = [];
      for (let i = 0; i < this.pos.length / 3; i++) n.push(0, 1, 0);
      g.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
    } else {
      g.computeVertexNormals();
    }
    return g;
  }
}

export function buildWorld(renderer: THREE.WebGLRenderer, track: Track, q: QualitySettings): World {
  const scene = new THREE.Scene();
  const disposables: { dispose(): void }[] = [];
  const own = <T extends { dispose(): void }>(o: T): T => {
    disposables.push(o);
    return o;
  };

  const sunDir = new THREE.Vector3(0.55, 0.3, 0.42).normalize();
  const horizonFog = new THREE.Color('#efb48c');
  scene.fog = new THREE.Fog(horizonFog, 180, 2600);

  // ---- langit ----
  const skyMat = own(skyMaterial(sunDir));
  const sky = new THREE.Mesh(own(new THREE.SphereGeometry(4500, 32, 16)), skyMat);
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  scene.add(sky);

  // ---- peta lingkungan untuk pantulan di bodi mobil ----
  const envScene = new THREE.Scene();
  const envMat = skyMaterial(sunDir);
  const envSky = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), envMat);
  envScene.add(envSky);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(envScene, 0, 0.1, 1000);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.75;
  pmrem.dispose();
  envSky.geometry.dispose();
  envMat.dispose();
  own(envRT);

  // ---- cahaya ----
  const hemi = new THREE.HemisphereLight(0xbfd0ff, 0x4a3a2c, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffd7a6, 2.8);
  if (q.shadowMap > 0) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(q.shadowMap, q.shadowMap);
    const cam = sun.shadow.camera;
    cam.left = -55;
    cam.right = 55;
    cam.top = 55;
    cam.bottom = -55;
    cam.near = 1;
    cam.far = 400;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.05;
  }
  scene.add(sun, sun.target);

  // ---- tanah ----
  const grassTex = own(TX.grassTexture());
  grassTex.repeat.set(600, 600);
  const ground = new THREE.Mesh(
    own(new THREE.PlaneGeometry(7000, 7000)),
    own(new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1, metalness: 0 })),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // ---- pegunungan di kejauhan ----
  const makeRing = (radius: number, hBase: number, seed: number, color: string) => {
    const seg = 180;
    const pos: number[] = [];
    const idx: number[] = [];
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const h =
        hBase * (0.55 + 0.25 * Math.sin(a * 3 + seed) + 0.15 * Math.sin(a * 7 + seed * 2.1) + 0.1 * Math.sin(a * 17 + seed * 3.3));
      const x = Math.cos(a) * radius;
      const z = Math.sin(a) * radius;
      pos.push(x, -20, z, x, h, z);
      if (i < seg) {
        const k = i * 2;
        idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
      }
    }
    const g = own(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    const m = own(new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    return new THREE.Mesh(g, m);
  };
  scene.add(makeRing(1900, 260, 1.3, '#7a7fa3'));
  scene.add(makeRing(1400, 150, 4.1, '#68704f'));

  // ---- sirkuit ----
  const S = track.samples;
  const n = track.n;
  const P = (i: number, lat: number, y: number): [number, number, number] => {
    const a = S[i % n];
    return [a.x + a.rx * lat, y, a.z + a.rz * lat];
  };
  const sOf = (i: number) => (i >= n ? track.length + S[i - n].s : S[i].s);

  const add = (
    m: Mesher,
    i: number,
    lat0: number,
    y0: number,
    lat1: number,
    y1: number,
    u0: number,
    u1: number,
    vScale: number,
  ) => {
    const s0 = sOf(i) / vScale;
    const s1 = sOf(i + 1) / vScale;
    m.quad(P(i, lat0, y0), P(i, lat1, y1), P(i + 1, lat1, y1), P(i + 1, lat0, y0), [u0, s0], [u1, s0], [u1, s1], [u0, s1]);
  };

  const asphalt = new Mesher();
  const kerbs = new Mesher();
  const gravel = new Mesher();
  const walls = new Mesher();
  const wallTops = new Mesher();

  // tandai bagian tikungan untuk kerb (diperhalus)
  const act = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let mx = 0;
    for (let k = -8; k <= 8; k++) mx = Math.max(mx, Math.abs(S[(i + k + n) % n].kappa));
    act[i] = mx;
  }

  for (let i = 0; i < n; i++) {
    add(asphalt, i, -ROAD_HALF, 0.04, ROAD_HALF, 0.04, 0, 1, ROAD_HALF * 2);
    for (const side of [-1, 1]) {
      const g0 = side * (ROAD_HALF + KERB_W);
      const g1 = side * WALL_INNER;
      add(gravel, i, g0, 0.02, g1, 0.02, 0, 1, 8);
      // dinding: sisi dalam + bagian atas
      add(walls, i, side * WALL_INNER, 0, side * WALL_INNER, WALL_H, 0, 1, 16);
      add(wallTops, i, side * WALL_INNER, WALL_H, side * (WALL_INNER + 0.7), WALL_H, 0, 1, 16);
    }
    // kerb
    const kap = act[i];
    if (kap > 1 / 140) {
      const inside = S[i].kappa >= 0 ? 1 : -1; // + = belok kanan => sisi kanan adalah sisi dalam
      const sides = kap > 1 / 60 ? [-1, 1] : [inside];
      for (const side of sides) {
        add(kerbs, i, side * ROAD_HALF, 0.07, side * (ROAD_HALF + KERB_W), 0.07, 0, 1, 2.4);
      }
    }
  }

  const asphaltTex = own(TX.asphaltTexture());
  const kerbTex = own(TX.kerbTexture());
  const gravelTex = own(TX.gravelTexture());
  const wallTex = own(TX.wallTexture());
  const po = (f: number) => ({ polygonOffset: true, polygonOffsetFactor: -f, polygonOffsetUnits: -f });

  const roadMesh = new THREE.Mesh(
    own(asphalt.build(true)),
    own(new THREE.MeshStandardMaterial({ map: asphaltTex, roughness: 0.9, metalness: 0, side: THREE.DoubleSide, ...po(2) })),
  );
  roadMesh.receiveShadow = true;
  scene.add(roadMesh);

  const kerbMesh = new THREE.Mesh(
    own(kerbs.build(true)),
    own(new THREE.MeshStandardMaterial({ map: kerbTex, roughness: 0.7, side: THREE.DoubleSide, ...po(3) })),
  );
  kerbMesh.receiveShadow = true;
  scene.add(kerbMesh);

  const gravelMesh = new THREE.Mesh(
    own(gravel.build(true)),
    own(new THREE.MeshStandardMaterial({ map: gravelTex, roughness: 1, side: THREE.DoubleSide, ...po(1) })),
  );
  gravelMesh.receiveShadow = true;
  scene.add(gravelMesh);

  const wallMesh = new THREE.Mesh(
    own(walls.build()),
    own(new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.8, side: THREE.DoubleSide })),
  );
  wallMesh.castShadow = q.shadowMap > 0;
  wallMesh.receiveShadow = true;
  scene.add(wallMesh);
  const wallTopMesh = new THREE.Mesh(
    own(wallTops.build()),
    own(new THREE.MeshStandardMaterial({ color: '#d7dae0', roughness: 0.85, side: THREE.DoubleSide })),
  );
  scene.add(wallTopMesh);

  // ---- garis start/finish & kotak grid ----
  const quadAtS = (sCenter: number, len: number, lat0: number, lat1: number, y: number): THREE.BufferGeometry => {
    const m = new Mesher();
    const p0 = track.at(sCenter - len / 2);
    const p1 = track.at(sCenter + len / 2);
    const pt = (p: typeof p0, lat: number): [number, number, number] => [p.x + -p.tz * lat, y, p.z + p.tx * lat];
    m.quad(pt(p0, lat0), pt(p0, lat1), pt(p1, lat1), pt(p1, lat0), [0, 0], [1, 0], [1, 1], [0, 1]);
    return m.build(true);
  };

  const startLine = new THREE.Mesh(
    own(quadAtS(0, 3, -ROAD_HALF, ROAD_HALF, 0.06)),
    own(new THREE.MeshStandardMaterial({ map: own(TX.checkerTexture(28, 6)), roughness: 0.8, side: THREE.DoubleSide, ...po(4) })),
  );
  startLine.receiveShadow = true;
  scene.add(startLine);

  const slotTex = own(TX.gridSlotTexture());
  const slotMat = own(
    new THREE.MeshBasicMaterial({ map: slotTex, transparent: true, depthWrite: false, side: THREE.DoubleSide, ...po(4) }),
  );
  for (let k = 0; k < 8; k++) {
    const g = track.gridSlot(k);
    const left = k % 2 === 0;
    const lat = left ? -3.4 : 3.4;
    // gridSlot() memakai s negatif; quadAtS memakai s yang sama
    const sCenter = g.s;
    const m = new THREE.Mesh(own(quadAtS(sCenter, 5.6, lat - 1.5, lat + 1.5, 0.055)), slotMat);
    scene.add(m);
  }

  // ---- gerbang start/finish ----
  {
    const at0 = track.at(0);
    const gantry = new THREE.Group();
    const dark = own(new THREE.MeshStandardMaterial({ color: '#1d2230', roughness: 0.6, metalness: 0.3 }));
    const span = WALL_INNER + 2.6;
    const pillarGeo = own(new THREE.BoxGeometry(1.1, 8, 1.1));
    for (const side of [-1, 1]) {
      const p = new THREE.Mesh(pillarGeo, dark);
      p.position.set(side * span, 4, 0);
      p.castShadow = q.shadowMap > 0;
      gantry.add(p);
    }
    const beam = new THREE.Mesh(own(new THREE.BoxGeometry(span * 2 + 1.1, 1.6, 1)), dark);
    beam.position.set(0, 7.6, 0);
    beam.castShadow = q.shadowMap > 0;
    gantry.add(beam);
    const bannerTex = own(TX.bannerTexture('GRAND TURISMO  •  START / FINISH'));
    const bannerMat = own(new THREE.MeshBasicMaterial({ map: bannerTex }));
    const bannerGeo = own(new THREE.PlaneGeometry(span * 2 - 2, 1.3));
    const front = new THREE.Mesh(bannerGeo, bannerMat);
    front.position.set(0, 7.6, 0.52);
    const back = new THREE.Mesh(bannerGeo, bannerMat);
    back.position.set(0, 7.6, -0.52);
    back.rotation.y = Math.PI;
    gantry.add(front, back);
    gantry.position.set(at0.x, 0, at0.z);
    gantry.rotation.y = at0.heading;
    scene.add(gantry);
  }

  // ---- tribun di sisi kanan dan kiri lintasan lurus utama ----
  {
    const crowd = own(TX.crowdTexture());
    crowd.repeat.set(24, 1);
    const stepMat = own(new THREE.MeshStandardMaterial({ map: crowd, roughness: 0.9 }));
    const roofMat = own(new THREE.MeshStandardMaterial({ color: '#d4202a', roughness: 0.6 }));
    const frameMat = own(new THREE.MeshStandardMaterial({ color: '#3a3f4b', roughness: 0.8 }));
    const at0 = track.at(0);
    const build = (side: number, lenS: number, offsetS: number) => {
      const grp = new THREE.Group();
      const baseLat = WALL_INNER + 9;
      for (let k = 0; k < 5; k++) {
        const box = new THREE.Mesh(own(new THREE.BoxGeometry(3.2, 1.3, lenS)), stepMat);
        box.position.set(side * (baseLat + k * 3.2), 0.65 + k * 1.3, offsetS);
        box.receiveShadow = true;
        grp.add(box);
      }
      const roof = new THREE.Mesh(own(new THREE.BoxGeometry(18, 0.4, lenS + 4)), roofMat);
      roof.position.set(side * (baseLat + 8), 10, offsetS);
      roof.castShadow = q.shadowMap > 0;
      grp.add(roof);
      for (const dz of [-lenS / 2, 0, lenS / 2]) {
        const post = new THREE.Mesh(own(new THREE.BoxGeometry(0.5, 9.8, 0.5)), frameMat);
        post.position.set(side * (baseLat + 15), 4.9, offsetS + dz);
        grp.add(post);
      }
      grp.position.set(at0.x, 0, at0.z);
      grp.rotation.y = at0.heading;
      scene.add(grp);
    };
    build(1, 150, 30);
    build(-1, 90, -10);
  }

  // ---- pohon (instancing) ----
  {
    const rand = TX.rng(1234);
    const coarse = S.filter((_, i) => i % 3 === 0);
    const spots: { x: number; z: number; sc: number; ry: number; tone: number }[] = [];
    let attempts = 0;
    while (spots.length < q.trees && attempts < q.trees * 60) {
      attempts++;
      const base = S[Math.floor(rand() * n)];
      const side = rand() < 0.5 ? -1 : 1;
      const lat = side * (WALL_INNER + 10 + rand() * 90);
      const x = base.x + base.rx * lat;
      const z = base.z + base.rz * lat;
      let md = Infinity;
      for (const c of coarse) {
        const d = Math.hypot(c.x - x, c.z - z);
        if (d < md) {
          md = d;
          if (md < WALL_INNER + 10) break;
        }
      }
      if (md < WALL_INNER + 10) continue;
      spots.push({ x, z, sc: 0.8 + rand() * 1.0, ry: rand() * 6.28, tone: rand() });
    }
    const N = spots.length;
    if (N > 0) {
      const trunkGeo = own(new THREE.CylinderGeometry(0.28, 0.4, 2.6, 6));
      trunkGeo.translate(0, 1.3, 0);
      const crown1 = own(new THREE.ConeGeometry(2.6, 5.2, 7));
      crown1.translate(0, 4.6, 0);
      const crown2 = own(new THREE.ConeGeometry(1.9, 4.2, 7));
      crown2.translate(0, 7.2, 0);
      const trunk = new THREE.InstancedMesh(trunkGeo, own(new THREE.MeshStandardMaterial({ color: '#5a4030', roughness: 1 })), N);
      const c1 = new THREE.InstancedMesh(crown1, own(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1 })), N);
      const c2 = new THREE.InstancedMesh(crown2, own(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1 })), N);
      const greens = ['#2f5d2a', '#3b6e2c', '#2a4f2a', '#4a7a30', '#365f33'].map((c) => new THREE.Color(c));
      const dummy = new THREE.Object3D();
      spots.forEach((t, i) => {
        dummy.position.set(t.x, 0, t.z);
        dummy.rotation.set(0, t.ry, 0);
        dummy.scale.setScalar(t.sc);
        dummy.updateMatrix();
        trunk.setMatrixAt(i, dummy.matrix);
        c1.setMatrixAt(i, dummy.matrix);
        c2.setMatrixAt(i, dummy.matrix);
        const col = greens[Math.floor(t.tone * greens.length) % greens.length];
        c1.setColorAt(i, col);
        c2.setColorAt(i, col);
      });
      for (const m of [trunk, c1, c2]) {
        m.castShadow = q.shadowMap >= 2048;
        m.frustumCulled = false;
        scene.add(m);
      }
    }
  }

  // ---- tiang lampu (instancing) ----
  if (q.poles) {
    const spacing = 60;
    const list: { x: number; z: number; side: number; heading: number }[] = [];
    for (let s = 20; s < track.length; s += spacing) {
      const side = Math.floor(s / spacing) % 2 === 0 ? 1 : -1;
      const p = track.at(s);
      const lat = side * (WALL_INNER + 2.4);
      const x = p.x + -p.tz * lat;
      const z = p.z + p.tx * lat;
      let tooClose = false;
      for (const c of S) {
        let da = Math.abs(c.s - s);
        da = Math.min(da, track.length - da);
        if (da < 130) continue;
        if (Math.hypot(c.x - x, c.z - z) < WALL_INNER + 6) {
          tooClose = true;
          break;
        }
      }
      if (!tooClose) list.push({ x, z, side, heading: p.heading });
    }
    const N = list.length;
    if (N > 0) {
      const poleGeo = own(new THREE.CylinderGeometry(0.12, 0.17, 9, 6));
      poleGeo.translate(0, 4.5, 0);
      const headGeo = own(new THREE.BoxGeometry(1.8, 0.25, 0.6));
      const poles = new THREE.InstancedMesh(poleGeo, own(new THREE.MeshStandardMaterial({ color: '#8d93a0', roughness: 0.6, metalness: 0.4 })), N);
      const heads = new THREE.InstancedMesh(headGeo, own(new THREE.MeshBasicMaterial({ color: '#ffd9a0' })), N);
      const dummy = new THREE.Object3D();
      list.forEach((t, i) => {
        dummy.position.set(t.x, 0, t.z);
        dummy.rotation.set(0, t.heading, 0);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        poles.setMatrixAt(i, dummy.matrix);
        // kepala lampu menjorok ke arah lintasan (arah menuju garis tengah = -side * kanan)
        const rightX = -Math.cos(t.heading);
        const rightZ = Math.sin(t.heading);
        dummy.position.set(t.x - t.side * rightX * 0.9, 9, t.z - t.side * rightZ * 0.9);
        dummy.updateMatrix();
        heads.setMatrixAt(i, dummy.matrix);
      });
      poles.frustumCulled = false;
      heads.frustumCulled = false;
      scene.add(poles, heads);
    }
  }

  return {
    scene,
    sun,
    sunDir,
    update(camPos, focus) {
      sky.position.copy(camPos);
      sun.target.position.copy(focus);
      sun.position.copy(focus).addScaledVector(sunDir, 150);
      sun.target.updateMatrixWorld();
    },
    dispose() {
      for (const d of disposables) {
        try {
          d.dispose();
        } catch {
          /* abaikan */
        }
      }
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && (m as unknown as THREE.InstancedMesh).isInstancedMesh) {
          (m as unknown as THREE.InstancedMesh).dispose();
        }
      });
    },
  };
}
