// Transport nyata: Supabase Realtime (Broadcast + Presence).
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabase } from '../lib/supabase';
import type { PeerInfo } from './protocol';
import type { Transport } from './transport';

export class SupabaseTransport implements Transport {
  private ch: RealtimeChannel | null = null;
  private msgHandler: ((e: string, p: any) => void) | null = null; // eslint-disable-line @typescript-eslint/no-explicit-any
  private peersHandler: ((p: PeerInfo[]) => void) | null = null;

  async join(code: string, me: PeerInfo): Promise<void> {
    const sb = getSupabase();
    if (!sb) throw new Error('supabase_not_configured');
    const ch = sb.channel('gt-room-' + code, {
      config: { broadcast: { self: false, ack: false }, presence: { key: me.id } },
    });
    this.ch = ch;

    ch.on('broadcast', { event: '*' }, (m) => {
      this.msgHandler?.(m.event, m.payload);
    });
    ch.on('presence', { event: 'sync' }, () => {
      const st = ch.presenceState() as Record<string, any[]>; // eslint-disable-line @typescript-eslint/no-explicit-any
      const peers: PeerInfo[] = [];
      for (const key of Object.keys(st)) {
        const meta = st[key]?.[0];
        if (meta) peers.push({ id: meta.id ?? key, name: String(meta.name ?? 'Pemain'), joinedAt: Number(meta.joinedAt ?? 0) });
      }
      this.peersHandler?.(peers);
    });

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout')), 12000);
      ch.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          try {
            await ch.track({ id: me.id, name: me.name, joinedAt: me.joinedAt });
            clearTimeout(timer);
            resolve();
          } catch (e) {
            clearTimeout(timer);
            reject(e);
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          clearTimeout(timer);
          reject(new Error(status));
        }
      });
    });
  }

  leave() {
    const sb = getSupabase();
    if (sb && this.ch) void sb.removeChannel(this.ch);
    this.ch = null;
  }

  send(event: string, payload: unknown) {
    if (!this.ch) return;
    void this.ch.send({ type: 'broadcast', event, payload });
  }

  onMessage(h: (e: string, p: any) => void) { // eslint-disable-line @typescript-eslint/no-explicit-any
    this.msgHandler = h;
  }
  onPeers(h: (p: PeerInfo[]) => void) {
    this.peersHandler = h;
  }
}
