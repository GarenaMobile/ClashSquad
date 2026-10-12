// Lapisan pengiriman pesan. Dua implementasi: Supabase (nyata) dan Memory (untuk tes).
import type { PeerInfo } from './protocol';

export interface Transport {
  join(code: string, me: PeerInfo): Promise<void>;
  leave(): void;
  send(event: string, payload: unknown): void;
  onMessage(h: (event: string, payload: any) => void): void; // eslint-disable-line @typescript-eslint/no-explicit-any
  onPeers(h: (peers: PeerInfo[]) => void): void;
}

// ---------------------------------------------------------------------
// Transport di memori: beberapa "pemain" dalam satu proses (untuk tes)
// ---------------------------------------------------------------------
export class MemoryHub {
  rooms = new Map<string, Set<MemoryTransport>>();
  create(latencyMs = 0): MemoryTransport {
    return new MemoryTransport(this, latencyMs);
  }
  announce(code: string) {
    const members = this.rooms.get(code);
    if (!members) return;
    const peers = [...members].filter((m) => m.me).map((m) => ({ ...m.me! }));
    for (const m of members) setTimeout(() => m.peersHandler?.(peers.map((p) => ({ ...p }))), 0);
  }
}

export class MemoryTransport implements Transport {
  me: PeerInfo | null = null;
  code = '';
  peersHandler: ((p: PeerInfo[]) => void) | null = null;
  private msgHandler: ((e: string, p: any) => void) | null = null; // eslint-disable-line @typescript-eslint/no-explicit-any

  constructor(
    private hub: MemoryHub,
    private latency: number,
  ) {}

  async join(code: string, me: PeerInfo) {
    this.me = me;
    this.code = code;
    if (!this.hub.rooms.has(code)) this.hub.rooms.set(code, new Set());
    this.hub.rooms.get(code)!.add(this);
    this.hub.announce(code);
  }
  leave() {
    const set = this.hub.rooms.get(this.code);
    if (!set) return;
    set.delete(this);
    this.me = null;
    if (set.size === 0) this.hub.rooms.delete(this.code);
    else this.hub.announce(this.code);
  }
  send(event: string, payload: unknown) {
    const set = this.hub.rooms.get(this.code);
    if (!set) return;
    const copy = JSON.parse(JSON.stringify(payload ?? null));
    for (const t of set) {
      if (t === this) continue;
      setTimeout(() => t.msgHandler?.(event, JSON.parse(JSON.stringify(copy))), this.latency);
    }
  }
  onMessage(h: (e: string, p: any) => void) { // eslint-disable-line @typescript-eslint/no-explicit-any
    this.msgHandler = h;
  }
  onPeers(h: (p: PeerInfo[]) => void) {
    this.peersHandler = h;
  }
}
