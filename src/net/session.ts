// ====================================================================
// ROOM SESSION: logika room multiplayer (tanpa DOM, bisa diuji di Node).
// Host = pemain yang paling dulu masuk (dihitung dari data presence yang sama di semua
// pemain, jadi semua sepakat tanpa perlu server). Jika host keluar, pemain tertua
// berikutnya otomatis jadi host.
// ====================================================================
import {
  MAX_PLAYERS,
  makeRoomCode,
  normalizeCode,
  CODE_LENGTH,
  type FinishInfo,
  type GoInfo,
  type NetState,
  type PeerInfo,
  type PlayerInfo,
  type PrepareInfo,
  type RoomPhase,
  type RoomSnapshot,
} from './protocol';
import type { Transport } from './transport';

export type RoomErrorKind = 'not_found' | 'full' | 'in_race' | 'connect' | 'no_supabase';

export class RoomError extends Error {
  constructor(
    public kind: RoomErrorKind,
    message: string,
    public detail?: string,
  ) {
    super(message);
  }
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const byJoin = (a: PeerInfo, b: PeerInfo) => a.joinedAt - b.joinedAt || (a.id < b.id ? -1 : 1);

export class RoomSession {
  private code = '';
  private joinedAt = 0;
  private players = new Map<string, PlayerInfo>();
  private peers: PeerInfo[] = [];
  private phase: RoomPhase = 'lobby';
  private laps = 3;
  private prepare: PrepareInfo | null = null;
  private loaded = new Set<string>();
  private go: GoInfo | null = null;
  private finishes: Record<string, FinishInfo> = {};
  private roomInfoSeen = false;
  private opened = false;
  private clockOffset: number | null = null;
  private bestRtt = Infinity;
  private syncHost = '';
  private prevHost = '';
  /** Urutan masuk yang disepakati (disiarkan host). Dipakai untuk memilih host dan urutan grid. */
  private order: string[] = [];

  private intervals = new Set<ReturnType<typeof setInterval>>();
  private timeouts = new Set<ReturnType<typeof setTimeout>>();
  private updateCbs = new Set<(s: RoomSnapshot) => void>();
  private stateCbs = new Set<(s: NetState) => void>();
  private leftCbs = new Set<(id: string) => void>();

  constructor(
    private transport: Transport,
    private me: { id: string; name: string },
    private opts: { now?: () => number } = {},
  ) {}

  private now(): number {
    return this.opts.now ? this.opts.now() : Date.now();
  }

  // ---------------------------------------------------------------
  // MASUK / KELUAR
  // ---------------------------------------------------------------
  async create(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = makeRoomCode();
      await this.open(code, true);
      await sleep(450); // beri waktu presence untuk sinkron: pastikan kode belum dipakai
      const others = this.peers.filter((p) => p.id !== this.me.id).length;
      if (others === 0) {
        this.startClockSync();
        return code;
      }
      this.close();
    }
    throw new RoomError('connect', 'Gagal membuat room, coba lagi.');
  }

  async join(rawCode: string): Promise<void> {
    const code = normalizeCode(rawCode);
    if (code.length !== CODE_LENGTH) throw new RoomError('not_found', 'Kode room harus 5 karakter.');
    await this.open(code, false);
    const found = await this.waitFor(() => this.peers.some((p) => p.id !== this.me.id), 3500);
    if (!found) {
      this.close();
      throw new RoomError('not_found', 'Room tidak ditemukan atau sudah ditutup.');
    }
    if (this.peers.length > MAX_PLAYERS) {
      this.close();
      throw new RoomError('full', `Room penuh (maksimal ${MAX_PLAYERS} pemain).`);
    }
    this.sendHello();
    await this.waitFor(() => this.roomInfoSeen, 1800);
    if (this.phase !== 'lobby') {
      this.close();
      throw new RoomError('in_race', 'Balapan di room ini sudah dimulai.');
    }
    this.startClockSync();
  }

  /**
   * Pembuat room diberi joinedAt = 0 sehingga selalu paling depan (jadi host). Ini sengaja tidak
   * memakai jam perangkat: jam tiap pemain bisa berbeda beberapa detik. Pemain lain memakai jam
   * mereka sendiri, tetapi semua orang melihat angka yang sama, jadi urutannya tetap sepakat.
   */
  private async open(code: string, creator: boolean): Promise<void> {
    this.code = code;
    this.joinedAt = creator ? 0 : this.now();
    this.players.clear();
    this.peers = [];
    this.order = [];
    this.roomInfoSeen = false;
    this.phase = 'lobby';
    this.prepare = null;
    this.go = null;
    this.loaded.clear();
    this.finishes = {};
    this.players.set(this.me.id, { id: this.me.id, name: this.me.name, joinedAt: this.joinedAt, carId: 'infiniti', ready: false });
    this.transport.onMessage((e, p) => this.handleMessage(e, p));
    this.transport.onPeers((list) => this.handlePeers(list));
    try {
      await this.transport.join(code, { id: this.me.id, name: this.me.name, joinedAt: this.joinedAt });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[multiplayer] gagal terhubung:', e);
      throw new RoomError(
        msg === 'supabase_not_configured' ? 'no_supabase' : 'connect',
        msg === 'supabase_not_configured' ? 'Supabase belum diatur.' : 'Tidak bisa terhubung ke server multiplayer.',
        msg,
      );
    }
    this.opened = true;
  }

  private close() {
    this.opened = false;
    for (const t of this.intervals) clearInterval(t);
    for (const t of this.timeouts) clearTimeout(t);
    this.intervals.clear();
    this.timeouts.clear();
    this.transport.leave();
  }

  leave() {
    this.close();
    this.updateCbs.clear();
    this.stateCbs.clear();
    this.leftCbs.clear();
  }

  private async waitFor(cond: () => boolean, ms: number): Promise<boolean> {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      if (cond()) return true;
      await sleep(40);
    }
    return cond();
  }

  // ---------------------------------------------------------------
  // STATUS
  // ---------------------------------------------------------------
  private rank(id: string): number {
    const i = this.order.indexOf(id);
    return i < 0 ? Number.MAX_SAFE_INTEGER : i;
  }
  private ranked(): PeerInfo[] {
    return [...this.peers].sort((a, b) => this.rank(a.id) - this.rank(b.id) || byJoin(a, b));
  }
  private rankedPlayers(): PlayerInfo[] {
    return [...this.players.values()].sort((a, b) => this.rank(a.id) - this.rank(b.id) || byJoin(a, b));
  }
  private hostId(): string {
    const r = this.ranked();
    return r.length ? r[0].id : this.me.id;
  }
  isHost(): boolean {
    return this.hostId() === this.me.id;
  }
  getCode(): string {
    return this.code;
  }
  meId(): string {
    return this.me.id;
  }

  snapshot(): RoomSnapshot {
    const players = this.rankedPlayers();
    return {
      code: this.code,
      meId: this.me.id,
      hostId: this.hostId(),
      isHost: this.isHost(),
      phase: this.phase,
      laps: this.laps,
      players,
      loaded: [...this.loaded],
      prepare: this.prepare,
      go: this.go,
      finishes: { ...this.finishes },
      clockOffsetMs: this.isHost() ? 0 : this.clockOffset,
    };
  }

  onUpdate(cb: (s: RoomSnapshot) => void): () => void {
    this.updateCbs.add(cb);
    return () => this.updateCbs.delete(cb);
  }
  onRemoteState(cb: (s: NetState) => void): () => void {
    this.stateCbs.add(cb);
    return () => this.stateCbs.delete(cb);
  }
  onPeerLeft(cb: (id: string) => void): () => void {
    this.leftCbs.add(cb);
    return () => this.leftCbs.delete(cb);
  }

  private emit() {
    const snap = this.snapshot();
    for (const cb of [...this.updateCbs]) cb(snap);
  }

  // ---------------------------------------------------------------
  // AKSI PEMAIN
  // ---------------------------------------------------------------
  setProfile(p: { carId?: string; ready?: boolean }) {
    const mine = this.players.get(this.me.id);
    if (!mine) return;
    if (p.carId !== undefined) mine.carId = p.carId;
    if (p.ready !== undefined) mine.ready = p.ready;
    this.sendHello();
    this.emit();
  }

  setLaps(n: number) {
    if (!this.isHost() || this.phase !== 'lobby') return;
    this.laps = Math.max(1, Math.min(10, Math.round(n)));
    this.sendRoom();
    this.emit();
  }

  /** Host memulai: semua pemain memuat aset, lalu hitung mundur serempak. */
  start(): boolean {
    if (!this.isHost() || this.phase !== 'lobby') return false;
    const sorted = this.rankedPlayers().slice(0, MAX_PLAYERS);
    const prep: PrepareInfo = {
      laps: this.laps,
      order: sorted.map((p) => p.id),
      cars: Object.fromEntries(sorted.map((p) => [p.id, p.carId])),
      names: Object.fromEntries(sorted.map((p) => [p.id, p.name])),
    };
    this.prepare = prep;
    this.phase = 'loading';
    this.loaded.clear();
    this.go = null;
    this.finishes = {};
    this.transport.send('prepare', prep);
    this.sendRoom();
    this.startClockSync();
    this.track(setTimeout(() => this.forceGo(), 35000));
    this.emit();
    return true;
  }

  /** Dipanggil game setelah semua aset selesai dimuat. */
  markLoaded() {
    this.loaded.add(this.me.id);
    this.transport.send('loaded', { id: this.me.id });
    this.emit();
    this.checkGo();
  }

  sendState(s: NetState) {
    this.transport.send('state', s);
  }

  reportFinish(info: FinishInfo) {
    this.finishes[this.me.id] = info;
    this.transport.send('finish', info);
    // kirim ulang beberapa kali supaya tidak hilang
    this.track(setTimeout(() => this.opened && this.transport.send('finish', info), 1200));
    this.track(setTimeout(() => this.opened && this.transport.send('finish', info), 3000));
    this.emit();
  }

  /** Host: kembalikan semua pemain ke lobby (setelah balapan selesai). */
  backToLobby() {
    if (!this.isHost()) return;
    this.resetRace();
    this.phase = 'lobby';
    const mine = this.players.get(this.me.id);
    if (mine) mine.ready = false;
    this.sendRoom();
    this.sendHello();
    this.emit();
  }

  // ---------------------------------------------------------------
  // PESAN MASUK
  // ---------------------------------------------------------------
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private handleMessage(event: string, p: any) {
    if (!p && event !== 'room') return;
    switch (event) {
      case 'hello': {
        const cur = this.players.get(p.id);
        const peer = this.peers.find((x) => x.id === p.id);
        if (cur) {
          cur.carId = String(p.carId);
          cur.ready = !!p.ready;
          cur.name = String(p.name ?? cur.name);
        } else {
          this.players.set(p.id, { id: p.id, name: String(p.name ?? 'Pemain'), joinedAt: peer?.joinedAt ?? this.now(), carId: String(p.carId), ready: !!p.ready });
        }
        this.emit();
        break;
      }
      case 'room': {
        // abaikan pesan basi dari host lama; tetapi pesan pertama selalu diterima (kita belum tahu host yang benar)
        if (this.roomInfoSeen && p.hostId && p.hostId !== this.hostId()) break;
        if (Array.isArray(p.order)) {
          const o = (p.order as string[]).filter((x) => typeof x === 'string');
          this.order = [...o, ...this.order.filter((id) => !o.includes(id))];
        }
        this.applyRoom(p.phase as RoomPhase, Number(p.laps) || this.laps);
        break;
      }
      case 'prepare': {
        this.prepare = p as PrepareInfo;
        this.phase = 'loading';
        this.loaded.clear();
        this.go = null;
        this.finishes = {};
        this.roomInfoSeen = true;
        this.startClockSync();
        this.emit();
        break;
      }
      case 'loaded': {
        this.loaded.add(p.id);
        this.emit();
        this.checkGo();
        break;
      }
      case 'go': {
        this.applyGo(Number(p.startAt), (p.order as string[]) ?? []);
        break;
      }
      case 'state': {
        for (const cb of [...this.stateCbs]) cb(p as NetState);
        break;
      }
      case 'finish': {
        this.finishes[p.id] = p as FinishInfo;
        this.emit();
        break;
      }
      case 'ping': {
        if (this.isHost()) this.transport.send('pong', { to: p.from, t0: p.t0, th: this.now() });
        break;
      }
      case 'pong': {
        if (p.to !== this.me.id) break;
        const t = this.now();
        const rtt = t - p.t0;
        if (rtt >= 0 && rtt <= this.bestRtt) {
          this.bestRtt = rtt;
          this.clockOffset = p.th + rtt / 2 - t;
          this.emit();
        }
        break;
      }
    }
  }

  private handlePeers(list: PeerInfo[]) {
    this.peers = [...list].sort(byJoin);
    for (const p of this.peers) if (!this.order.includes(p.id)) this.order.push(p.id);
    const ids = new Set(list.map((p) => p.id));
    let added = false;
    for (const id of [...this.players.keys()]) {
      if (!ids.has(id)) {
        this.players.delete(id);
        this.loaded.delete(id);
        for (const cb of [...this.leftCbs]) cb(id);
      }
    }
    for (const p of list) {
      const cur = this.players.get(p.id);
      if (!cur) {
        this.players.set(p.id, { ...p, carId: 'infiniti', ready: false });
        added = true;
      } else {
        cur.joinedAt = p.joinedAt;
        cur.name = p.name;
      }
    }
    if (added && this.opened) {
      this.sendHello();
      if (this.isHost()) this.sendRoom();
    }
    const host = this.hostId();
    if (this.opened && host !== this.prevHost) {
      this.prevHost = host;
      if (this.isHost()) {
        this.clockOffset = 0;
        // host baru di tengah proses memuat: lanjutkan pengecekan
        this.checkGo();
      } else {
        this.startClockSync();
      }
    }
    this.emit();
  }

  // ---------------------------------------------------------------
  // PESAN KELUAR
  // ---------------------------------------------------------------
  private sendHello() {
    const mine = this.players.get(this.me.id);
    if (!mine) return;
    this.transport.send('hello', { id: mine.id, name: mine.name, carId: mine.carId, ready: mine.ready });
  }

  private sendRoom() {
    const order = this.order.filter((id) => this.players.has(id));
    this.transport.send('room', { phase: this.phase, laps: this.laps, hostId: this.me.id, order });
  }

  private applyRoom(phase: RoomPhase, laps: number) {
    const prev = this.phase;
    this.laps = laps;
    this.roomInfoSeen = true;
    if (phase === 'lobby' && prev !== 'lobby') {
      this.resetRace();
      const mine = this.players.get(this.me.id);
      if (mine) mine.ready = false;
      this.phase = 'lobby';
      this.sendHello();
    } else {
      this.phase = phase;
    }
    this.emit();
  }

  private resetRace() {
    this.prepare = null;
    this.go = null;
    this.loaded.clear();
    this.finishes = {};
  }

  // ---------------------------------------------------------------
  // MULAI SERENTAK
  // ---------------------------------------------------------------
  private checkGo() {
    if (!this.isHost() || this.phase !== 'loading' || !this.prepare || this.go) return;
    const present = this.prepare.order.filter((id) => this.players.has(id));
    if (present.length > 0 && present.every((id) => this.loaded.has(id))) this.sendGo(present);
  }

  private forceGo() {
    if (!this.isHost() || this.phase !== 'loading' || !this.prepare || this.go) return;
    const ok = this.prepare.order.filter((id) => this.loaded.has(id) && this.players.has(id));
    if (ok.length > 0) this.sendGo(ok);
    else this.backToLobby();
  }

  private sendGo(order: string[]) {
    const startAt = this.now() + 3600;
    this.transport.send('go', { startAt, order });
    this.applyGo(startAt, order);
  }

  private applyGo(startAtHost: number, order: string[]) {
    if (!this.prepare) return;
    const offset = this.isHost() ? 0 : this.clockOffset;
    const startAtLocal = offset === null ? this.now() + 3300 : startAtHost - offset;
    this.go = { ...this.prepare, order, startAtLocal };
    this.phase = 'racing';
    this.emit();
  }

  // ---------------------------------------------------------------
  // SINKRONISASI JAM (supaya hitung mundur serempak walau jam perangkat berbeda)
  // ---------------------------------------------------------------
  private startClockSync() {
    if (!this.opened) return;
    const host = this.hostId();
    if (this.isHost()) {
      this.clockOffset = 0;
      return;
    }
    if (this.syncHost !== host) {
      this.syncHost = host;
      this.bestRtt = Infinity;
      this.clockOffset = null;
    }
    const ping = () => {
      if (this.opened && !this.isHost()) this.transport.send('ping', { from: this.me.id, t0: this.now() });
    };
    for (let i = 0; i < 6; i++) this.track(setTimeout(ping, i * 150));
    if (this.intervals.size === 0) {
      const iv = setInterval(ping, 8000);
      this.intervals.add(iv);
    }
  }

  private track(t: ReturnType<typeof setTimeout>) {
    this.timeouts.add(t);
  }
}
