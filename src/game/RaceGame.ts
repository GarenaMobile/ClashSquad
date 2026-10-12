// ====================================================================
// RACE GAME: mengatur dunia 3D, mobil pemain & bot, input, lap, kamera,
// efek (asap, suara), dan mengirim data ke tampilan HUD (React).
// Semua logika permainan ada di sini, bukan di komponen React.
// ====================================================================
import * as THREE from 'three';
import { getTrack, newLocation, TRACK_NAME, type Track } from './track';
import { CARS, getCar, type CarConfig } from '../lib/cars';
import {
  FIXED_DT,
  newCarState,
  newControls,
  placeCar,
  specFromConfig,
  stepCar,
  type CarSpec,
  type CarState,
  type Controls,
} from './physics';
import { aiControl, simulateRace, type AiParams } from './ai';
import { collideCars } from './collision';
import { buildWorld, type World } from './render/world';
import { loadCarVisual, makeGhostVisual, type CarVisual } from './render/carModel';
import { SmokeSystem } from './render/particles';
import { qualitySettings, type QualitySettings } from './render/quality';
import { EngineAudio } from './audio';
import { getBestLap, getFlip, getGhost, setBestLap, setGhost, type AssistLevelSetting, type QualityLevel, type RaceMode } from '../lib/storage';
import type { RoomSession } from '../net/session';
import { stateSurfaceCode, surfaceFromCode, type GoInfo, type NetState, type PrepareInfo, type RoomSnapshot } from '../net/protocol';

export type Phase = 'loading' | 'ready' | 'waiting' | 'countdown' | 'racing' | 'finished' | 'paused';

export interface RaceOptions {
  carId: string;
  mode: RaceMode;
  laps: number;
  quality: QualityLevel;
  playerName: string;
  /** Bantuan berkendara untuk mobil pemain (bot memakai tingkat normal). */
  assist?: AssistLevelSetting;
  /** Diisi saat multiplayer: sesi room + info balapan dari host. */
  net?: { session: RoomSession; prepare: PrepareInfo };
}

export interface MedalTargets {
  gold: number;
  silver: number;
  bronze: number;
}

export interface HudState {
  phase: Phase;
  loadingText: string;
  loadingPct: number;
  countdown: number | null; // 3, 2, 1, 0 (= GO)
  speedKmh: number;
  gear: number; // 0 = N
  rpm: number; // 0..1
  lap: number;
  laps: number;
  lapTimeMs: number;
  totalMs: number;
  bestLapMs: number | null;
  lastLapMs: number | null;
  position: number;
  racers: number;
  message: string | null;
  messageKind: 'info' | 'warn' | 'danger' | 'good' | null;
  medals: MedalTargets | null;
  view: 'chase' | 'hood';
  muted: boolean;
  fps: number;
}

export interface StandingRow {
  name: string;
  carName: string;
  timeMs: number | null;
  isPlayer: boolean;
}

export interface RaceResult {
  totalMs: number;
  lapTimes: number[];
  bestLapMs: number;
  position: number;
  racers: number;
  medal: 'gold' | 'silver' | 'bronze' | null;
  standings: StandingRow[];
  carId: string;
  newBest: boolean;
}

export interface GameCallbacks {
  onHud(h: HudState): void;
  onFinish(r: RaceResult): void;
  onError(msg: string): void;
}

interface RemoteTarget {
  x: number;
  z: number;
  h: number;
  vx: number;
  vz: number;
  al: number;
  ag: number;
  sl: number;
  su: number;
  at: number; // performance.now() saat diterima
}

interface Racer {
  id: string;
  name: string;
  cfg: CarConfig;
  spec: CarSpec;
  state: CarState;
  visual: CarVisual;
  isPlayer: boolean;
  ai: AiParams;
  autopilot: boolean;
  ctl: Controls;
  slot: number;
  color: string;
  // kemajuan
  dist: number;
  lastS: number;
  nextLine: number;
  lapStartMs: number | null;
  lapTimes: number[];
  finishMs: number | null;
  // visual
  roll: number;
  pitch: number;
  remote: RemoteTarget | null;
  tag: THREE.Sprite | null;
}

const BOT_NAMES = ['Kenji', 'Rafi', 'Mira'];
const BOT_PACE = [0.9, 0.94, 0.975];
const BOT_COLORS = ['#ff5d5d', '#4da3ff', '#5fe08a'];
const REMOTE_COLORS = ['#ff5d5d', '#4da3ff', '#5fe08a', '#c78bff', '#ff8fd0', '#58e0e0', '#ffe14d'];
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const wrapAngle = (a: number) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};

export class RaceGame {
  private container: HTMLElement;
  private minimap: HTMLCanvasElement | null;
  private opts: RaceOptions;
  private cb: GameCallbacks;

  private track: Track = getTrack();
  private q: QualitySettings;
  private renderer!: THREE.WebGLRenderer;
  private camera!: THREE.PerspectiveCamera;
  private world!: World;
  private smoke!: SmokeSystem;
  private audio = new EngineAudio();
  private resizeObs: ResizeObserver | null = null;

  private racers: Racer[] = [];
  private player!: Racer;
  private ghostVisual: CarVisual | null = null;
  private ghostFrames: number[] = [];
  private ghostLapMs = 0;
  private recFrames: number[] = [];
  private recNext = 0;

  private phase: Phase = 'loading';
  private prePausePhase: Phase = 'racing';
  private countdownT = 0;
  private timeMs = 0; // waktu balapan sejak GO
  private acc = 0;
  private last = 0;
  private raf = 0;
  private disposed = false;
  private elapsed = 0; // waktu bebas (untuk orbit kamera)

  private keys = new Set<string>();
  private playerCtl = newControls();
  private view: 'chase' | 'hood' = 'chase';
  private muted = false;

  private camPos = new THREE.Vector3();
  private camHeading = 0;
  private camInit = false;
  private shake = 0;

  private message: string | null = null;
  private messageKind: HudState['messageKind'] = null;
  private messageT = 0;
  private wrongWayT = 0;
  private stuckT = 0;
  private lastLapMs: number | null = null;
  private sessionBest: number | null = null;
  private storedBest: number | null = null;
  private medals: MedalTargets | null = null;
  private hudT = 0;
  private miniT = 0;
  private miniStatic: HTMLCanvasElement | null = null;
  private miniScale = 1;
  private miniOx = 0;
  private miniOy = 0;
  private loadingText = 'Menyiapkan dunia 3D...';
  private loadingPct = 0;
  private fpsAcc = 0;
  private fpsFrames = 0;
  private fps = 60;
  private dpr = 1;
  private resultSent = false;
  private finishDelay = 0;
  private hitFx: { x: number; z: number; nx: number; nz: number; relSpeed: number; scrape: number; player: boolean }[] = [];
  private lastImpactSnd = 0;
  private net: RaceOptions['net'];
  private netUnsubs: (() => void)[] = [];
  private netStartLocal = 0;
  private netT = 0;
  private netResultT = 0;

  constructor(container: HTMLElement, minimap: HTMLCanvasElement | null, opts: RaceOptions, cb: GameCallbacks) {
    this.container = container;
    this.minimap = minimap;
    this.opts = opts;
    this.cb = cb;
    this.q = qualitySettings(opts.quality);
    this.net = opts.net;
  }

  // ------------------------------------------------------------------
  // INISIALISASI
  // ------------------------------------------------------------------
  async init(): Promise<void> {
    try {
      this.pushHud(true);
      const w = this.container.clientWidth || window.innerWidth;
      const h = this.container.clientHeight || window.innerHeight;

      this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 0.95;
      if (this.q.shadowMap > 0) {
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      }
      this.dpr = Math.min(window.devicePixelRatio || 1, this.q.maxPixelRatio);
      this.renderer.setPixelRatio(this.dpr);
      this.renderer.setSize(w, h);
      this.renderer.domElement.style.display = 'block';
      this.renderer.domElement.style.width = '100%';
      this.renderer.domElement.style.height = '100%';
      this.container.appendChild(this.renderer.domElement);

      this.camera = new THREE.PerspectiveCamera(65, w / h, 0.4, 6000);

      this.setLoading('Membangun sirkuit...', 0.1);
      await this.nextFrame();
      if (this.disposed) return;
      this.world = buildWorld(this.renderer, this.track, this.q);
      this.smoke = new SmokeSystem();
      this.world.scene.add(this.smoke.points);
      this.smoke.setViewportScale(h * this.dpr, 65);
      if (this.disposed) return;

      // --- mobil pemain ---
      const pcfg = getCar(this.opts.carId);
      this.setLoading(`Memuat ${pcfg.shortName}...`, 0.25);
      const pvis = await loadCarVisual(pcfg, getFlip(pcfg.id), { castShadow: this.q.shadowMap > 0 });
      if (this.disposed) return;
      this.world.scene.add(pvis.root);
      const meId = this.net ? this.net.session.meId() : 'player';
      const mySlot = this.net ? Math.max(0, this.net.prepare.order.indexOf(meId)) : 0;
      this.player = this.makeRacer(meId, this.opts.playerName || 'Kamu', pcfg, pvis, true, mySlot);
      this.racers.push(this.player);

      if (this.net) {
        // --- pemain lain (multiplayer) ---
        const prep = this.net.prepare;
        const others = prep.order.filter((id) => id !== meId);
        for (let i = 0; i < others.length; i++) {
          const id = others[i];
          const cfg = getCar(prep.cars[id]);
          this.setLoading(`Memuat mobil ${prep.names[id] ?? 'pemain'}...`, 0.4 + (0.45 * i) / Math.max(1, others.length));
          const vis = await loadCarVisual(cfg, getFlip(cfg.id), { castShadow: false });
          if (this.disposed) return;
          this.world.scene.add(vis.root);
          const slot = prep.order.indexOf(id);
          const r = this.makeRacer(id, prep.names[id] ?? 'Pemain', cfg, vis, false, slot);
          r.color = REMOTE_COLORS[i % REMOTE_COLORS.length];
          r.remote = { x: 0, z: 0, h: 0, vx: 0, vz: 0, al: 0, ag: 0, sl: 0, su: 0, at: performance.now() };
          this.attachTag(r);
          this.racers.push(r);
        }
      } else if (this.opts.mode === 'race') {
        const pool = CARS.filter((c) => c.id !== pcfg.id);
        for (let i = pool.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [pool[i], pool[j]] = [pool[j], pool[i]];
        }
        const others = pool.slice(0, 3);
        for (let i = 0; i < others.length; i++) {
          this.setLoading(`Memuat mobil lawan ${i + 1}/${others.length}...`, 0.4 + 0.15 * i);
          const vis = await loadCarVisual(others[i], getFlip(others[i].id), { castShadow: this.q.shadowMap > 0 });
          if (this.disposed) return;
          this.world.scene.add(vis.root);
          const r = this.makeRacer('bot' + i, 'Bot ' + BOT_NAMES[i], others[i], vis, false, i + 1);
          r.ai = { pace: BOT_PACE[i], lineOffset: i % 2 === 0 ? 3 : -3 };
          r.color = BOT_COLORS[i];
          this.attachTag(r);
          this.racers.push(r);
        }
      } else {
        this.ghostVisual = makeGhostVisual(pvis);
        this.ghostVisual.root.visible = false;
        this.world.scene.add(this.ghostVisual.root);
      }

      // --- waktu acuan medali (simulasi bot tanpa tampilan) ---
      this.setLoading('Menghitung waktu acuan...', 0.9);
      await this.nextFrame();
      if (this.disposed) return;
      try {
        const sim = simulateRace(this.track, pcfg, this.opts.laps, 1.0);
        if (sim.finished) {
          this.medals = { gold: sim.totalMs * 1.12, silver: sim.totalMs * 1.25, bronze: sim.totalMs * 1.45 };
        }
      } catch {
        this.medals = null;
      }

      this.storedBest = getBestLap(pcfg.id);
      this.loadGhost();
      this.buildMinimapStatic();
      this.attachEvents();
      this.resetRace();
      if (this.net) {
        const session = this.net.session;
        this.netUnsubs.push(session.onUpdate((snap) => this.onSession(snap)));
        this.netUnsubs.push(session.onRemoteState((st) => this.onRemoteState(st)));
        this.netUnsubs.push(session.onPeerLeft((id) => this.onPeerLeft(id)));
        this.phase = 'waiting';
        this.setLoading('Menunggu pemain lain...', 1);
        session.markLoaded();
        this.onSession(session.snapshot());
      } else {
        this.phase = 'ready';
        this.setLoading('', 1);
      }
      this.pushHud(true);

      this.last = performance.now();
      this.raf = requestAnimationFrame(this.loop);
    } catch (e) {
      console.error(e);
      this.cb.onError(e instanceof Error ? e.message : 'Gagal memulai game');
    }
  }

  private nextFrame(): Promise<void> {
    return new Promise((r) => requestAnimationFrame(() => r()));
  }

  private setLoading(text: string, pct: number) {
    this.loadingText = text;
    this.loadingPct = pct;
    this.pushHud(true);
  }

  private makeRacer(id: string, name: string, cfg: CarConfig, visual: CarVisual, isPlayer: boolean, slot: number): Racer {
    return {
      id,
      name,
      cfg,
      spec: specFromConfig(cfg, isPlayer ? this.opts.assist ?? 'easy' : 'normal'),
      state: newCarState(),
      visual,
      isPlayer,
      ai: { pace: 1, lineOffset: 0 },
      autopilot: false,
      ctl: newControls(),
      slot,
      color: '#ffd23f',
      dist: 0,
      lastS: 0,
      nextLine: 0,
      lapStartMs: null,
      lapTimes: [],
      finishMs: null,
      roll: 0,
      pitch: 0,
      remote: null,
      tag: null,
    };
  }

  private loadGhost() {
    this.ghostFrames = [];
    this.ghostLapMs = 0;
    if (this.opts.mode !== 'trial') return;
    const g = getGhost(this.player.cfg.id);
    if (g && g.frames.length >= 8) {
      this.ghostFrames = g.frames;
      this.ghostLapMs = g.lapMs;
    }
  }

  // ------------------------------------------------------------------
  // KONTROL DARI LUAR (React)
  // ------------------------------------------------------------------
  /** Dipanggil dari klik / tombol pengguna: mulai hitung mundur. */
  begin() {
    if (this.phase !== 'ready' || this.net) return;
    this.audio.start();
    this.audio.setMuted(this.muted);
    this.phase = 'countdown';
    this.countdownT = 3.99;
    this.pushHud(true);
  }

  restart() {
    if (this.net) return;
    this.resetRace();
    this.audio.start();
    this.phase = 'countdown';
    this.countdownT = 3.99;
    this.pushHud(true);
  }

  togglePause() {
    if (this.net) return;
    if (this.phase === 'paused') {
      this.phase = this.prePausePhase;
      this.last = performance.now();
      this.audio.resume();
    } else if (this.phase === 'racing' || this.phase === 'countdown') {
      this.prePausePhase = this.phase;
      this.phase = 'paused';
      this.audio.suspend();
    }
    this.pushHud(true);
  }

  toggleMute() {
    this.muted = !this.muted;
    this.audio.setMuted(this.muted);
    this.pushHud(true);
  }

  toggleView() {
    this.view = this.view === 'chase' ? 'hood' : 'chase';
    this.pushHud(true);
  }

  respawn() {
    if (this.phase !== 'racing') return;
    const r = this.player;
    const p = this.track.at(r.state.loc.s);
    placeCar(r.state, p.x, p.z, p.heading);
    r.state.loc.i = -1;
    this.setMessage('Kembali ke lintasan', 'info', 1.2);
  }

  setQuality(level: QualityLevel) {
    // perubahan kualitas penuh membutuhkan muat ulang; di sini hanya resolusi
    const q = qualitySettings(level);
    this.dpr = Math.min(window.devicePixelRatio || 1, q.maxPixelRatio);
    this.renderer.setPixelRatio(this.dpr);
    this.onResize();
  }

  // ------------------------------------------------------------------
  // RESET BALAPAN
  // ------------------------------------------------------------------
  private resetRace() {
    this.timeMs = 0;
    this.acc = 0;
    this.resultSent = false;
    this.finishDelay = 0;
    this.lastLapMs = null;
    this.sessionBest = null;
    this.wrongWayT = 0;
    this.stuckT = 0;
    this.message = null;
    this.messageT = 0;
    this.recFrames = [];
    this.recNext = 0;
    for (const r of this.racers) {
      const g = this.track.gridSlot(r.slot);
      placeCar(r.state, g.x, g.z, g.heading);
      r.state.loc.i = -1;
      this.track.locate(r.state.x, r.state.z, -1, r.state.loc);
      r.dist = g.s;
      r.lastS = r.state.loc.s;
      r.nextLine = 0;
      r.lapStartMs = null;
      r.lapTimes = [];
      r.finishMs = null;
      r.autopilot = false;
      r.ctl = newControls();
      r.roll = 0;
      r.pitch = 0;
      if (r.remote) r.remote = { x: g.x, z: g.z, h: g.heading, vx: 0, vz: 0, al: 0, ag: 0, sl: 0, su: 0, at: performance.now() };
    }
    this.camInit = false;
    this.syncVisuals(0);
    if (this.ghostVisual) this.ghostVisual.root.visible = false;
  }

  // ------------------------------------------------------------------
  // INPUT
  // ------------------------------------------------------------------
  private onKeyDown = (e: KeyboardEvent) => {
    const k = e.code;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(k)) e.preventDefault();
    if (e.repeat) {
      this.keys.add(k);
      return;
    }
    this.keys.add(k);
    if (k === 'Enter' && this.phase === 'ready') this.begin();
    if (k === 'KeyR') this.respawn();
    if (k === 'KeyC') this.toggleView();
    if (k === 'KeyM') this.toggleMute();
    if (k === 'Escape' || k === 'KeyP') this.togglePause();
  };
  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };
  private onBlur = () => {
    this.keys.clear();
    if (this.phase === 'racing') this.togglePause();
  };

  private attachEvents() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    this.resizeObs = new ResizeObserver(() => this.onResize());
    this.resizeObs.observe(this.container);
  }

  private onResize() {
    if (!this.renderer) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w < 10 || h < 10) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.smoke.setViewportScale(h * this.dpr, this.camera.fov);
  }

  private readInput() {
    const k = this.keys;
    const c = this.playerCtl;
    c.throttle = k.has('KeyW') || k.has('ArrowUp') ? 1 : 0;
    c.brake = k.has('KeyS') || k.has('ArrowDown') ? 1 : 0;
    const right = k.has('KeyD') || k.has('ArrowRight') ? 1 : 0;
    const left = k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0;
    c.steer = right - left; // +1 = kanan
    c.handbrake = k.has('Space');
  }

  // ------------------------------------------------------------------
  // LOOP UTAMA
  // ------------------------------------------------------------------
  private loop = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.elapsed += dt;

    if (this.phase !== 'paused') this.update(dt);
    this.render(dt);

    // FPS & resolusi dinamis
    this.fpsAcc += dt;
    this.fpsFrames++;
    if (this.fpsAcc >= 1) {
      this.fps = this.fpsFrames / this.fpsAcc;
      this.fpsAcc = 0;
      this.fpsFrames = 0;
      if (this.phase === 'racing' || this.phase === 'countdown') this.adaptResolution();
    }
  };

  private adaptResolution() {
    const maxDpr = Math.min(window.devicePixelRatio || 1, this.q.maxPixelRatio);
    let next = this.dpr;
    if (this.fps < 40 && this.dpr > 0.6) next = Math.max(0.6, this.dpr * 0.85);
    else if (this.fps > 58 && this.dpr < maxDpr) next = Math.min(maxDpr, this.dpr * 1.1);
    if (Math.abs(next - this.dpr) > 0.01) {
      this.dpr = next;
      this.renderer.setPixelRatio(this.dpr);
      this.onResize();
    }
  }

  private update(dt: number) {
    if (this.messageT > 0) {
      this.messageT -= dt;
      if (this.messageT <= 0) {
        this.message = null;
        this.messageKind = null;
      }
    }

    if (this.phase === 'countdown') {
      const prev = Math.ceil(this.countdownT);
      if (this.net) this.countdownT = (this.netStartLocal - Date.now()) / 1000;
      else this.countdownT -= dt;
      const cur = Math.ceil(this.countdownT);
      if (cur !== prev && cur > 0) this.pushHud(true);
      if (this.countdownT <= 0) {
        this.phase = 'racing';
        this.timeMs = this.net ? Math.max(0, Date.now() - this.netStartLocal) : 0;
        this.setMessage('GO!', 'good', 1.2);
        this.pushHud(true);
      }
    }

    if (this.phase === 'racing' || this.phase === 'finished') {
      this.readInput();
      this.acc += dt;
      let guard = 0;
      while (this.acc >= FIXED_DT && guard++ < 20) {
        this.acc -= FIXED_DT;
        this.stepAll();
      }
      if (guard >= 20) this.acc = 0;
      this.watchPlayer(dt);
    }
    this.updateRemotes(dt);
    this.sendNet(dt);

    if (this.phase === 'finished') {
      this.finishDelay += dt;
      if (!this.resultSent && this.finishDelay > 1.4) {
        this.resultSent = true;
        this.cb.onFinish(this.buildResult());
      } else if (this.resultSent && this.net) {
        // perbarui klasemen selagi pemain lain masih menyelesaikan balapan
        this.netResultT += dt;
        if (this.netResultT > 1) {
          this.netResultT = 0;
          this.cb.onFinish(this.buildResult());
        }
      }
    }

    // efek & suara
    this.processHits();
    this.emitSmoke(dt);
    const p = this.player;
    if (p) {
      const kmh = p.state.speed * 3.6;
      const { rpm } = this.gearInfo(kmh, p.spec);
      this.audio.update(rpm, this.playerCtl.throttle, p.state.surface === 'asphalt' ? p.state.slip : 0, this.phase === 'racing' || this.phase === 'finished' || this.phase === 'countdown');
    }

    this.hudT += dt;
    if (this.hudT > 0.08) {
      this.hudT = 0;
      this.pushHud(false);
    }
    this.miniT += dt;
    if (this.miniT > 0.06) {
      this.miniT = 0;
      this.drawMinimap();
    }
  }

  private stepAll() {
    this.timeMs += FIXED_DT * 1000;
    for (const r of this.racers) {
      if (r.remote) continue;
      if (r.isPlayer && !r.autopilot) {
        r.ctl = this.playerCtl;
      } else {
        aiControl(r.state, r.spec, this.track, r.ai, r.ctl);
      }
      const prevDist = r.dist;
      stepCar(r.state, r.spec, r.ctl, FIXED_DT, this.track);
      this.advance(r, prevDist);
      if (r.isPlayer && r.state.wallImpact > 6) {
        this.shake = Math.min(1, r.state.wallImpact / 25);
        this.setMessage('BENTURAN!', 'danger', 0.8);
      }
      if (r.state.wallImpact > 2.5) {
        this.hitFx.push({ x: r.state.x, z: r.state.z, nx: 0, nz: 0, relSpeed: r.state.wallImpact, scrape: r.state.speed * 0.25, player: r.isPlayer });
      }
    }
    // tabrakan antar mobil: benturan, gesekan, dan putaran. Di multiplayer hanya mobil sendiri yang digerakkan.
    for (let i = 0; i < this.racers.length; i++) {
      for (let j = i + 1; j < this.racers.length; j++) {
        const A = this.racers[i];
        const B = this.racers[j];
        if (A.remote && B.remote) continue;
        const hit = collideCars(A.state, A.spec, B.state, B.spec, !A.remote, !B.remote);
        if (hit && (hit.relSpeed > 0.8 || hit.scrape > 2.5)) {
          this.hitFx.push({ x: hit.x, z: hit.z, nx: hit.nx, nz: hit.nz, relSpeed: hit.relSpeed, scrape: hit.scrape, player: A.isPlayer || B.isPlayer });
        }
      }
    }
    // rekam ghost (hanya mode trial)
    if (this.opts.mode === 'trial' && this.player.lapStartMs !== null && this.player.finishMs === null) {
      const t = this.timeMs - this.player.lapStartMs;
      if (t >= this.recNext) {
        const s = this.player.state;
        this.recFrames.push(Math.round(t), +s.x.toFixed(2), +s.z.toFixed(2), +s.heading.toFixed(3));
        this.recNext = t + 50;
      }
    }
  }

  private advance(r: Racer, prevDist: number) {
    const L = this.track.length;
    let ds = r.state.loc.s - r.lastS;
    if (ds < -L / 2) ds += L;
    if (ds > L / 2) ds -= L;
    r.lastS = r.state.loc.s;
    r.dist += ds;
    const laps = this.opts.laps;
    while (r.nextLine <= laps) {
      const target = r.nextLine * L;
      if (prevDist < target && r.dist >= target) {
        const frac = (target - prevDist) / (r.dist - prevDist || 1);
        const tc = this.timeMs - (1 - frac) * FIXED_DT * 1000;
        this.onLine(r, r.nextLine, tc);
        r.nextLine++;
      } else break;
    }
  }

  private onLine(r: Racer, k: number, tc: number) {
    if (k === 0) {
      r.lapStartMs = tc;
      if (r.isPlayer) {
        this.recFrames = [];
        this.recNext = 0;
        this.setMessage('LAP 1', 'info', 1.2);
      }
      return;
    }
    const lapMs = tc - (r.lapStartMs ?? tc);
    r.lapTimes.push(lapMs);
    r.lapStartMs = tc;
    if (r.isPlayer) {
      this.lastLapMs = lapMs;
      const prevBest = this.bestLap();
      if (prevBest === null || lapMs < prevBest) {
        this.sessionBest = lapMs;
        if (k < this.opts.laps) this.setMessage('LAP TERCEPAT!', 'good', 1.6);
        if (this.opts.mode === 'trial') {
          this.recFrames.push(Math.round(lapMs), +r.state.x.toFixed(2), +r.state.z.toFixed(2), +r.state.heading.toFixed(3));
          setGhost(r.cfg.id, lapMs, this.recFrames.slice());
          this.ghostFrames = this.recFrames.slice();
          this.ghostLapMs = lapMs;
        }
        setBestLap(r.cfg.id, lapMs);
        this.storedBest = lapMs;
      } else if (k < this.opts.laps) {
        this.setMessage(`LAP ${k + 1}`, 'info', 1.2);
      }
      this.recFrames = [];
      this.recNext = 0;
    }
    if (k === this.opts.laps) {
      r.finishMs = tc;
      if (r.isPlayer) {
        if (this.net) {
          this.net.session.reportFinish({
            id: this.net.session.meId(),
            totalMs: tc,
            lapTimes: r.lapTimes.slice(),
            bestLapMs: r.lapTimes.length ? Math.min(...r.lapTimes) : tc,
          });
        }
        r.autopilot = true;
        r.ai = { pace: 0.5, lineOffset: 0 };
        this.phase = 'finished';
        this.setMessage('FINISH!', 'good', 3);
        this.pushHud(true);
      }
    }
  }

  private bestLap(): number | null {
    const a = this.sessionBest;
    const b = this.storedBest;
    if (a === null) return b;
    if (b === null) return a;
    return Math.min(a, b);
  }

  private watchPlayer(dt: number) {
    const p = this.player;
    if (!p || this.phase !== 'racing') return;
    const s = p.state;
    const dot = Math.sin(s.heading) * s.loc.tx + Math.cos(s.heading) * s.loc.tz;
    if (dot < -0.25 && s.speed > 6) this.wrongWayT += dt;
    else this.wrongWayT = Math.max(0, this.wrongWayT - dt * 2);
    if (this.wrongWayT > 0.7) this.setMessage('ARAH SALAH!', 'danger', 0.3);
    else if (s.surface === 'gravel' && s.speed > 8) this.setMessage('KELUAR JALUR', 'warn', 0.25);

    if (s.speed < 1.2 && this.playerCtl.throttle === 0) this.stuckT = 0;
    else if (s.speed < 1.5) this.stuckT += dt;
    else this.stuckT = 0;
    if (this.stuckT > 3.5) {
      this.setMessage('Tekan R untuk kembali ke lintasan', 'info', 0.3);
    }
  }

  private setMessage(text: string, kind: HudState['messageKind'], dur: number) {
    this.message = text;
    this.messageKind = kind;
    this.messageT = dur;
  }

  // ------------------------------------------------------------------
  // MULTIPLAYER
  // ------------------------------------------------------------------
  private onSession(snap: RoomSnapshot) {
    if (this.disposed) return;
    // info finish pemain lain
    for (const [id, f] of Object.entries(snap.finishes)) {
      const r = this.racers.find((x) => x.id === id);
      if (r && r.remote) {
        r.finishMs = f.totalMs;
        r.lapTimes = f.lapTimes.slice();
      }
    }
    if (this.phase === 'waiting') {
      const total = snap.prepare?.order.length ?? this.racers.length;
      this.loadingText = `Menunggu pemain lain... (${snap.loaded.length}/${total} siap)`;
      if (snap.go && snap.go.order.includes(this.net!.session.meId())) this.startFromGo(snap.go);
    }
  }

  private startFromGo(go: GoInfo) {
    this.netStartLocal = go.startAtLocal;
    this.countdownT = (go.startAtLocal - Date.now()) / 1000;
    this.phase = 'countdown';
    this.audio.start();
    this.audio.setMuted(this.muted);
    // pemain yang tidak ikut (gagal memuat) disingkirkan
    for (const r of [...this.racers]) if (!r.isPlayer && !go.order.includes(r.id)) this.removeRacer(r);
    this.pushHud(true);
  }

  private onRemoteState(st: NetState) {
    const r = this.racers.find((x) => x.id === st.id);
    if (!r || !r.remote) return;
    r.remote = { x: st.x, z: st.z, h: st.h, vx: st.vx, vz: st.vz, al: st.al, ag: st.ag, sl: st.sl, su: st.su, at: performance.now() };
    r.dist = st.d;
    r.nextLine = st.n;
    if (st.f !== null && r.finishMs === null) r.finishMs = st.f;
  }

  private onPeerLeft(id: string) {
    const r = this.racers.find((x) => x.id === id);
    if (!r || r.isPlayer) return;
    if (r.finishMs === null) {
      this.removeRacer(r);
      this.setMessage(`${r.name} keluar`, 'info', 2);
    }
  }

  private removeRacer(r: Racer) {
    this.racers = this.racers.filter((x) => x !== r);
    r.visual.dispose();
  }

  private updateRemotes(dt: number) {
    const now = performance.now();
    const k = 1 - Math.exp(-14 * dt);
    for (const r of this.racers) {
      const t = r.remote;
      if (!t) continue;
      const s = r.state;
      const age = Math.min(0.3, (now - t.at) / 1000);
      const tx = t.x + t.vx * age;
      const tz = t.z + t.vz * age;
      s.x += (tx - s.x) * k;
      s.z += (tz - s.z) * k;
      s.heading += wrapAngle(t.h - s.heading) * k;
      s.vx = t.vx;
      s.vz = t.vz;
      s.speed = Math.hypot(t.vx, t.vz);
      s.aLat = t.al;
      s.aLong = t.ag;
      s.slip = t.sl;
      s.surface = surfaceFromCode(t.su);
    }
  }

  private sendNet(dt: number) {
    if (!this.net || (this.phase !== 'racing' && this.phase !== 'finished')) return;
    this.netT += dt;
    if (this.netT < 0.1) return;
    this.netT = 0;
    const p = this.player;
    const s = p.state;
    this.net.session.sendState({
      id: this.net.session.meId(),
      x: +s.x.toFixed(2),
      z: +s.z.toFixed(2),
      h: +s.heading.toFixed(3),
      vx: +s.vx.toFixed(2),
      vz: +s.vz.toFixed(2),
      al: +s.aLat.toFixed(1),
      ag: +s.aLong.toFixed(1),
      sl: +s.slip.toFixed(2),
      su: stateSurfaceCode(s.surface),
      d: +p.dist.toFixed(1),
      f: p.finishMs === null ? null : Math.round(p.finishMs),
      n: p.nextLine,
    });
  }

  private attachTag(r: Racer) {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 64;
    const g = c.getContext('2d')!;
    g.fillStyle = 'rgba(8,10,18,0.78)';
    g.beginPath();
    if (typeof g.roundRect === 'function') g.roundRect(4, 6, 248, 52, 14);
    else g.rect(4, 6, 248, 52);
    g.fill();
    g.fillStyle = r.color;
    g.fillRect(14, 20, 6, 24);
    g.fillStyle = '#ffffff';
    g.font = '700 28px system-ui, sans-serif';
    g.textBaseline = 'middle';
    g.fillText(r.name.slice(0, 14), 30, 33);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, fog: false, depthWrite: false }));
    sp.scale.set(3.4, 0.85, 1);
    sp.position.set(0, 2.3, 0);
    r.visual.root.add(sp);
    r.tag = sp;
  }

  // ------------------------------------------------------------------
  // PERINGKAT & HASIL
  // ------------------------------------------------------------------
  private ranking(): Racer[] {
    return [...this.racers].sort((a, b) => {
      if (a.finishMs !== null && b.finishMs !== null) return a.finishMs - b.finishMs;
      if (a.finishMs !== null) return -1;
      if (b.finishMs !== null) return 1;
      return b.dist - a.dist;
    });
  }

  private buildResult(): RaceResult {
    const p = this.player;
    const order = this.ranking();
    const total = p.finishMs ?? this.timeMs;
    let medal: RaceResult['medal'] = null;
    if (this.medals) {
      if (total <= this.medals.gold) medal = 'gold';
      else if (total <= this.medals.silver) medal = 'silver';
      else if (total <= this.medals.bronze) medal = 'bronze';
    }
    const best = p.lapTimes.length ? Math.min(...p.lapTimes) : total;
    return {
      totalMs: total,
      lapTimes: p.lapTimes.slice(),
      bestLapMs: best,
      position: order.indexOf(p) + 1,
      racers: this.racers.length,
      medal,
      standings: order.map((r) => ({ name: r.name, carName: r.cfg.shortName, timeMs: r.finishMs, isPlayer: r.isPlayer })),
      carId: p.cfg.id,
      newBest: this.sessionBest !== null && this.sessionBest === best,
    };
  }

  // ------------------------------------------------------------------
  // RENDER
  // ------------------------------------------------------------------
  private gearInfo(kmh: number, spec: CarSpec) {
    const vmaxKmh = spec.vmax * 3.6;
    const gears = 7;
    const band = vmaxKmh / gears;
    const gear = clamp(1 + Math.floor(kmh / band), 1, gears);
    const within = clamp((kmh - (gear - 1) * band) / band, 0, 1);
    const rpm = kmh < 2 ? 0.14 : 0.3 + 0.7 * within;
    return { gear, rpm };
  }

  private syncVisuals(dt: number) {
    for (const r of this.racers) {
      const s = r.state;
      r.visual.root.position.set(s.x, 0, s.z);
      r.visual.root.rotation.y = s.heading;
      const k = 1 - Math.exp(-10 * dt);
      const tRoll = clamp(-s.aLat * 0.0048, -0.07, 0.07);
      const tPitch = clamp(-s.aLong * 0.0035, -0.05, 0.05);
      r.roll += (tRoll - r.roll) * k;
      r.pitch += (tPitch - r.pitch) * k;
      r.visual.body.rotation.z = r.roll;
      r.visual.body.rotation.x = r.pitch;
      r.visual.body.position.y = s.surface === 'kerb' && s.speed > 5 ? Math.sin(this.elapsed * 90) * 0.012 : 0;
    }
  }

  /** Percikan api, getaran kamera, dan suara dari tabrakan pada langkah fisika sebelumnya. */
  private processHits() {
    if (this.hitFx.length === 0) return;
    let strongest = 0;
    let playerHit = false;
    for (const h of this.hitFx) {
      strongest = Math.max(strongest, h.relSpeed);
      if (h.player) playerHit = true;
      if (this.q.particles && this.smoke) {
        const n = Math.min(8, Math.floor(1 + h.relSpeed * 0.5 + h.scrape * 0.25));
        for (let k = 0; k < n; k++) {
          const sp = 2 + Math.random() * 5;
          const ang = Math.random() * Math.PI * 2;
          this.smoke.emit(h.x, 0.35 + Math.random() * 0.4, h.z, Math.cos(ang) * sp - h.nx * 1.5, 1.5 + Math.random() * 3, Math.sin(ang) * sp - h.nz * 1.5, 0.22, 0.28 + Math.random() * 0.3, 0.95, 1.0, 0.72, 0.25, -9, 0.1);
        }
        if (h.relSpeed > 3) {
          this.smoke.emit(h.x, 0.5, h.z, (Math.random() - 0.5) * 2, 1, (Math.random() - 0.5) * 2, 1.3, 0.9, 0.35, 0.85, 0.85, 0.85);
        }
      }
    }
    this.hitFx.length = 0;
    if (playerHit) {
      this.shake = Math.max(this.shake, Math.min(1, strongest / 18));
      if (strongest > 6) this.setMessage('TABRAKAN!', 'danger', 0.7);
    }
    const now = performance.now();
    if (strongest > 1.5 && now - this.lastImpactSnd > 120) {
      this.lastImpactSnd = now;
      this.audio.impact(strongest);
    }
  }

  private emitSmoke(dt: number) {
    if (!this.q.particles || !this.smoke) return;
    this.smoke.update(dt);
    if (this.phase !== 'racing' && this.phase !== 'finished') return;
    for (const r of this.racers) {
      const s = r.state;
      if (s.speed < 6) continue;
      const asphaltSlide = s.surface !== 'gravel' && s.slip > 0.4;
      const hardBrake = s.aLong < -9 && s.speed > 30;
      const dust = s.surface === 'gravel';
      if (!asphaltSlide && !hardBrake && !dust) continue;
      if (Math.random() > 0.55) continue;
      const fx = Math.sin(s.heading);
      const fz = Math.cos(s.heading);
      const rx = -fz;
      const rz = fx;
      const back = -r.spec.halfLength * 0.7;
      for (const side of [-0.95, 0.95]) {
        const x = s.x + fx * back + rx * side;
        const z = s.z + fz * back + rz * side;
        if (dust) this.smoke.emit(x, 0.2, z, -s.vx * 0.15 + (Math.random() - 0.5), 0.8, -s.vz * 0.15 + (Math.random() - 0.5), 1.4, 0.9, 0.5, 0.72, 0.6, 0.42);
        else this.smoke.emit(x, 0.15, z, -s.vx * 0.08 + (Math.random() - 0.5) * 0.6, 0.6, -s.vz * 0.08 + (Math.random() - 0.5) * 0.6, 1.2, 1.1, 0.45, 0.92, 0.92, 0.92);
      }
    }
  }

  private updateCamera(dt: number) {
    const p = this.player;
    const s = p.state;
    const cam = this.camera;

    if (this.phase === 'ready' || this.phase === 'loading') {
      // orbit pelan mengelilingi mobil di grid
      const a = this.elapsed * 0.35 + s.heading;
      const r = 8.5;
      cam.position.set(s.x + Math.sin(a) * r, 2.3, s.z + Math.cos(a) * r);
      cam.lookAt(s.x, 0.9, s.z);
      cam.fov = 55;
      cam.updateProjectionMatrix();
      this.camInit = false;
      return;
    }

    const fx = Math.sin(s.heading);
    const fz = Math.cos(s.heading);
    const spd = s.speed;
    const velAng = spd > 6 ? Math.atan2(s.vx, s.vz) : s.heading;
    const target = s.heading + wrapAngle(velAng - s.heading) * 0.35;
    if (!this.camInit) this.camHeading = s.heading;
    this.camHeading += wrapAngle(target - this.camHeading) * (1 - Math.exp(-16 * dt));
    const cx = Math.sin(this.camHeading);
    const cz = Math.cos(this.camHeading);

    let fov: number;
    if (this.view === 'chase') {
      const dist = 7.2 + spd * 0.012;
      const height = 2.4 + spd * 0.004;
      const tx = s.x - cx * dist;
      const tz = s.z - cz * dist;
      const ty = height;
      if (!this.camInit) this.camPos.set(tx, ty, tz);
      else {
        const k = 1 - Math.exp(-22 * dt);
        this.camPos.x += (tx - this.camPos.x) * k;
        this.camPos.y += (ty - this.camPos.y) * k;
        this.camPos.z += (tz - this.camPos.z) * k;
      }
      cam.position.copy(this.camPos);
      cam.lookAt(s.x + cx * 9, 1.15, s.z + cz * 9);
      fov = 62 + clamp(spd / 90, 0, 1) * 14;
    } else {
      this.camPos.set(s.x + fx * 0.6, 1.05, s.z + fz * 0.6);
      cam.position.copy(this.camPos);
      cam.lookAt(s.x + fx * 20, 1.0, s.z + fz * 20);
      fov = 70 + clamp(spd / 90, 0, 1) * 12;
    }
    this.camInit = true;

    // getaran kamera: benturan, kerb, kecepatan tinggi
    this.shake = Math.max(0, this.shake - dt * 2.5);
    let amp = this.shake * 0.35;
    if (s.surface === 'kerb' && spd > 8) amp += 0.015;
    if (s.surface === 'gravel' && spd > 8) amp += 0.035;
    amp += clamp((spd - 60) / 60, 0, 1) * 0.006;
    if (amp > 0) {
      cam.position.x += (Math.random() - 0.5) * amp;
      cam.position.y += (Math.random() - 0.5) * amp;
      cam.position.z += (Math.random() - 0.5) * amp;
    }

    if (Math.abs(cam.fov - fov) > 0.05) {
      cam.fov += (fov - cam.fov) * (1 - Math.exp(-5 * dt));
      cam.updateProjectionMatrix();
      this.smoke.setViewportScale(this.renderer.domElement.height, cam.fov);
    }
  }

  private updateGhost() {
    const gv = this.ghostVisual;
    if (!gv) return;
    const p = this.player;
    const f = this.ghostFrames;
    if (f.length < 8 || p.lapStartMs === null || p.finishMs !== null) {
      gv.root.visible = false;
      return;
    }
    const t = this.timeMs - p.lapStartMs;
    if (t > this.ghostLapMs + 500) {
      gv.root.visible = false;
      return;
    }
    const n = f.length / 4;
    // cari frame (pencarian biner)
    let lo = 0;
    let hi = n - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (f[mid * 4] <= t) lo = mid;
      else hi = mid - 1;
    }
    const a = lo * 4;
    const b = Math.min(n - 1, lo + 1) * 4;
    const span = f[b] - f[a];
    const u = span > 0 ? clamp((t - f[a]) / span, 0, 1) : 0;
    const x = f[a + 1] + (f[b + 1] - f[a + 1]) * u;
    const z = f[a + 2] + (f[b + 2] - f[a + 2]) * u;
    const h = f[a + 3] + wrapAngle(f[b + 3] - f[a + 3]) * u;
    gv.root.visible = true;
    gv.root.position.set(x, 0, z);
    gv.root.rotation.y = h;
  }

  private render(dt: number) {
    if (!this.renderer || !this.player) return;
    this.syncVisuals(dt);
    for (const r of this.racers) {
      if (r.tag) {
        const d = Math.hypot(r.state.x - this.camera.position.x, r.state.z - this.camera.position.z);
        r.tag.visible = d < 170 && d > 3;
      }
    }
    this.updateGhost();
    this.updateCamera(dt);
    this.world.update(this.camera.position, this.player.visual.root.position);
    this.renderer.render(this.world.scene, this.camera);
  }

  // ------------------------------------------------------------------
  // MINIMAP
  // ------------------------------------------------------------------
  private buildMinimapStatic() {
    const cv = this.minimap;
    if (!cv) return;
    const W = cv.width;
    const H = cv.height;
    const S = this.track.samples;
    let minX = Infinity,
      maxX = -Infinity,
      minZ = Infinity,
      maxZ = -Infinity;
    for (const s of S) {
      minX = Math.min(minX, s.x);
      maxX = Math.max(maxX, s.x);
      minZ = Math.min(minZ, s.z);
      maxZ = Math.max(maxZ, s.z);
    }
    const pad = 14;
    const sc = Math.min((W - pad * 2) / (maxX - minX), (H - pad * 2) / (maxZ - minZ));
    this.miniScale = sc;
    this.miniOx = (W - (maxX - minX) * sc) / 2 - minX * sc;
    this.miniOy = (H - (maxZ - minZ) * sc) / 2 - minZ * sc;
    const off = document.createElement('canvas');
    off.width = W;
    off.height = H;
    const g = off.getContext('2d')!;
    g.lineJoin = 'round';
    g.lineCap = 'round';
    const path = () => {
      g.beginPath();
      S.forEach((s, i) => {
        const x = s.x * sc + this.miniOx;
        const y = s.z * sc + this.miniOy;
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      });
      g.closePath();
    };
    g.strokeStyle = 'rgba(0,0,0,0.65)';
    g.lineWidth = 8;
    path();
    g.stroke();
    g.strokeStyle = 'rgba(235,238,245,0.9)';
    g.lineWidth = 4;
    path();
    g.stroke();
    // garis start
    const s0 = S[0];
    const sx = s0.x * sc + this.miniOx;
    const sy = s0.z * sc + this.miniOy;
    g.strokeStyle = '#ffffff';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(sx + s0.rx * 7, sy + s0.rz * 7);
    g.lineTo(sx - s0.rx * 7, sy - s0.rz * 7);
    g.stroke();
    this.miniStatic = off;
  }

  private drawMinimap() {
    const cv = this.minimap;
    if (!cv || !this.miniStatic) return;
    const g = cv.getContext('2d');
    if (!g) return;
    g.clearRect(0, 0, cv.width, cv.height);
    g.drawImage(this.miniStatic, 0, 0);
    const dot = (r: Racer, big: boolean) => {
      const x = r.state.x * this.miniScale + this.miniOx;
      const y = r.state.z * this.miniScale + this.miniOy;
      g.fillStyle = r.color;
      g.strokeStyle = '#0b0d14';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(x, y, big ? 6 : 4.5, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      if (big) {
        const hx = Math.sin(r.state.heading);
        const hz = Math.cos(r.state.heading);
        g.strokeStyle = '#ffffff';
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + hx * 11, y + hz * 11);
        g.stroke();
      }
    };
    for (const r of this.racers) if (!r.isPlayer) dot(r, false);
    if (this.player) dot(this.player, true);
  }

  // ------------------------------------------------------------------
  // HUD
  // ------------------------------------------------------------------
  private pushHud(force: boolean) {
    void force;
    const p = this.player;
    const kmh = p ? p.state.speed * 3.6 : 0;
    const gi = p ? this.gearInfo(kmh, p.spec) : { gear: 0, rpm: 0 };
    const racing = this.phase === 'racing' || this.phase === 'finished';
    const lapStart = p?.lapStartMs ?? null;
    const order = p ? this.ranking() : [];
    const nextLine = p ? Math.min(Math.max(p.nextLine, 1), this.opts.laps) : 1;
    const hud: HudState = {
      phase: this.phase,
      loadingText: this.loadingText,
      loadingPct: this.loadingPct,
      countdown: this.phase === 'countdown' ? Math.max(0, Math.min(3, Math.ceil(this.countdownT))) : null,
      speedKmh: Math.round(kmh),
      gear: p && kmh < 3 && this.playerCtl.throttle === 0 ? 0 : gi.gear,
      rpm: gi.rpm,
      lap: nextLine,
      laps: this.opts.laps,
      lapTimeMs: racing ? (p?.finishMs != null ? (this.lastLapMs ?? 0) : lapStart !== null ? this.timeMs - lapStart : 0) : 0,
      totalMs: racing ? (p?.finishMs ?? this.timeMs) : 0,
      bestLapMs: this.bestLap(),
      lastLapMs: this.lastLapMs,
      position: p ? order.indexOf(p) + 1 : 1,
      racers: this.racers.length || 1,
      message: this.message,
      messageKind: this.messageKind,
      medals: this.medals,
      view: this.view,
      muted: this.muted,
      fps: Math.round(this.fps),
    };
    this.cb.onHud(hud);
  }

  // ------------------------------------------------------------------
  // BERSIH-BERSIH
  // ------------------------------------------------------------------
  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    this.resizeObs?.disconnect();
    for (const u of this.netUnsubs) u();
    this.netUnsubs = [];
    this.audio.dispose();
    try {
      this.smoke?.dispose();
      this.world?.dispose();
      for (const r of this.racers) r.visual.dispose();
      this.ghostVisual?.dispose();
      if (this.renderer) {
        this.renderer.dispose();
        this.renderer.domElement.remove();
      }
    } catch {
      /* abaikan */
    }
  }
}

export { TRACK_NAME, newLocation };
