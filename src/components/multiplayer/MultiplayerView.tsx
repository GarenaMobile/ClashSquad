'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { RoomError, RoomSession } from '@/net/session';
import { SupabaseTransport } from '@/net/supabaseTransport';
import { getPlayerId, getSupabase, supabaseConfigProblem } from '@/lib/supabase';
import { CARS, getCar } from '@/lib/cars';
import { getCarId, getPlayerName, setCarId, setPlayerName } from '@/lib/storage';
import { MAX_PLAYERS, normalizeCode, type RoomSnapshot } from '@/net/protocol';

const RaceView = dynamic(() => import('@/components/race/RaceView'), {
  ssr: false,
  loading: () => (
    <div className="overlay center dim">
      <div className="loading-card">
        <b>Menyiapkan balapan...</b>
      </div>
    </div>
  ),
});

function errorText(e: unknown): string {
  if (e instanceof RoomError) {
    switch (e.kind) {
      case 'not_found':
        return 'Room tidak ditemukan. Periksa kodenya, atau minta temanmu membuat room lagi.';
      case 'full':
        return `Room sudah penuh (maksimal ${MAX_PLAYERS} pemain).`;
      case 'in_race':
        return 'Balapan di room ini sudah dimulai. Tunggu sampai selesai, lalu coba lagi.';
      case 'no_supabase':
        return 'Multiplayer membutuhkan Supabase. Isi file .env.local, lalu jalankan ulang game.';
      default:
        return `Tidak bisa terhubung ke server multiplayer. Periksa internet dan pengaturan Supabase.${e.detail ? ` (detail: ${e.detail})` : ''}`;
    }
  }
  return 'Terjadi kesalahan. Coba lagi.';
}

export default function MultiplayerView() {
  const sessionRef = useRef<RoomSession | null>(null);
  const lastPrepare = useRef<unknown>(null);
  const [snap, setSnap] = useState<RoomSnapshot | null>(null);
  const [raceKey, setRaceKey] = useState(0);
  const [name, setName] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const [configured, setConfigured] = useState(true);
  const [configProblem, setConfigProblem] = useState<string | null>(null);
  const [myCar, setMyCar] = useState('infiniti');

  useEffect(() => {
    setName(getPlayerName());
    setMyCar(getCarId());
    setConfigured(getSupabase() !== null);
    setConfigProblem(supabaseConfigProblem());
    const r = new URLSearchParams(window.location.search).get('room');
    if (r) setCodeInput(normalizeCode(r));
    return () => {
      sessionRef.current?.leave();
      sessionRef.current = null;
    };
  }, []);

  const connect = useCallback(
    async (kind: 'create' | 'join') => {
      if (busy) return;
      setBusy(true);
      setError(null);
      const display = name.trim() || 'Pembalap';
      let session: RoomSession | null = null;
      try {
        if (!getSupabase()) throw new RoomError('no_supabase', 'Supabase belum diatur');
        setPlayerName(display);
        // ID unik per tab, supaya dua tab di satu komputer bisa dipakai untuk uji coba
        const base = (await getPlayerId()).slice(0, 8);
        const id = `${base}-${Math.random().toString(36).slice(2, 8)}`;
        session = new RoomSession(new SupabaseTransport(), { id, name: display });
        if (kind === 'create') await session.create();
        else await session.join(codeInput);
        sessionRef.current = session;
        lastPrepare.current = null;
        session.onUpdate((s) => {
          if (s.prepare && s.prepare !== lastPrepare.current) {
            lastPrepare.current = s.prepare;
            setRaceKey((k) => k + 1);
          }
          setSnap(s);
        });
        session.setProfile({ carId: getCarId(), ready: false });
        setSnap(session.snapshot());
      } catch (e) {
        session?.leave();
        sessionRef.current = null;
        setError(errorText(e));
      } finally {
        setBusy(false);
      }
    },
    [busy, name, codeInput],
  );

  const leave = useCallback(() => {
    sessionRef.current?.leave();
    sessionRef.current = null;
    lastPrepare.current = null;
    setSnap(null);
  }, []);

  const copy = async (what: 'code' | 'link') => {
    if (!snap) return;
    const text = what === 'code' ? snap.code : `${window.location.origin}/multiplayer?room=${snap.code}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      /* abaikan */
    }
  };

  const pickCar = (id: string) => {
    setMyCar(id);
    setCarId(id);
    sessionRef.current?.setProfile({ carId: id });
  };

  // ---------------- sedang balapan ----------------
  if (snap && snap.phase !== 'lobby' && snap.prepare && snap.prepare.order.includes(snap.meId)) {
    return (
      <RaceView
        key={raceKey}
        net={{
          session: sessionRef.current!,
          prepare: snap.prepare,
          isHost: snap.isHost,
          onLobby: () => sessionRef.current?.backToLobby(),
          onLeave: leave,
        }}
      />
    );
  }

  // ---------------- terlambat masuk ----------------
  if (snap && snap.phase !== 'lobby') {
    return (
      <main className="garage">
        <div className="mp-center panel">
          <h3>BALAPAN SEDANG BERLANGSUNG</h3>
          <p className="lead">Kamu tidak ikut balapan ini. Tunggu sampai selesai, lobby akan terbuka lagi.</p>
          <button className="btn btn-ghost" onClick={leave}>
            KELUAR ROOM
          </button>
        </div>
      </main>
    );
  }

  // ---------------- lobby ----------------
  if (snap) {
    const me = snap.players.find((p) => p.id === snap.meId);
    const others = snap.players.filter((p) => p.id !== snap.meId);
    const readyCount = others.filter((p) => p.ready).length;
    return (
      <main className="garage">
        <header className="topbar">
          <button className="back linklike" onClick={leave}>
            ← Keluar room
          </button>
          <h2>LOBBY</h2>
          <span className="back">{snap.players.length}/{MAX_PLAYERS} pemain</span>
        </header>

        <div className="mp-grid">
          <section className="panel mp-code">
            <p className="eyebrow">KODE ROOM</p>
            <div className="code-box">{snap.code}</div>
            <p className="dim small" style={{ marginTop: 0 }}>
              Bagikan kode ini ke temanmu. Mereka memasukkannya di menu Multiplayer.
            </p>
            <div className="btn-row">
              <button className="btn btn-ghost" onClick={() => copy('code')}>
                {copied === 'code' ? 'TERSALIN ✓' : 'SALIN KODE'}
              </button>
              <button className="btn btn-ghost" onClick={() => copy('link')}>
                {copied === 'link' ? 'TERSALIN ✓' : 'SALIN TAUTAN'}
              </button>
            </div>
          </section>

          <section className="panel mp-players">
            <h3>PEMAIN</h3>
            {snap.players.map((p, i) => (
              <div key={p.id} className={'player-row' + (p.id === snap.meId ? ' me' : '')}>
                <span className="slot">{i + 1}</span>
                <b>
                  {p.name}
                  {p.id === snap.meId && <em> (kamu)</em>}
                </b>
                <span className="car">{getCar(p.carId).shortName}</span>
                <span className={'status ' + (p.id === snap.hostId || p.ready ? 'ok' : '')}>
                  {p.id === snap.hostId ? '👑 HOST' : p.ready ? 'SIAP' : 'BELUM'}
                </span>
              </div>
            ))}
          </section>

          <section className="panel mp-controls">
            <h3>MOBILMU</h3>
            <div className="car-list">
              {CARS.map((c) => (
                <button key={c.id} className={'car-item' + (c.id === myCar ? ' active' : '')} onClick={() => pickCar(c.id)}>
                  <b>{c.shortName}</b>
                  <span>{c.tagline}</span>
                </button>
              ))}
            </div>

            {snap.isHost ? (
              <>
                <div className="opt-row">
                  <span>Jumlah lap</span>
                  <div className="seg">
                    {[1, 2, 3, 5].map((n) => (
                      <button key={n} className={snap.laps === n ? 'on' : ''} onClick={() => sessionRef.current?.setLaps(n)}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <button className="btn btn-primary wide" onClick={() => sessionRef.current?.start()}>
                  MULAI BALAPAN
                </button>
                <p className="dim small">
                  {others.length === 0
                    ? 'Kamu sendirian di room. Menunggu teman bergabung (kamu tetap bisa mulai).'
                    : `${readyCount} dari ${others.length} pemain lain sudah siap.`}
                </p>
              </>
            ) : (
              <>
                <p className="dim small" style={{ marginTop: 0 }}>
                  Jumlah lap: <b style={{ color: 'var(--text)' }}>{snap.laps}</b> (diatur host)
                </p>
                <button
                  className={'btn wide ' + (me?.ready ? 'btn-ghost' : 'btn-primary')}
                  onClick={() => sessionRef.current?.setProfile({ ready: !me?.ready })}
                >
                  {me?.ready ? 'BATAL SIAP' : 'SAYA SIAP'}
                </button>
                <p className="dim small">Menunggu host memulai balapan...</p>
              </>
            )}
          </section>
        </div>
      </main>
    );
  }

  // ---------------- menu ----------------
  return (
    <main className="garage">
      <header className="topbar">
        <Link href="/" className="back">
          ← Menu
        </Link>
        <h2>MULTIPLAYER</h2>
        <Link href="/garage" className="back">
          Main solo →
        </Link>
      </header>

      <div className="mp-center panel">
        {!configured && (
          <div className="notice">
            Multiplayer belum aktif: {configProblem ?? 'Supabase belum diatur.'} Perbaiki file <code>.env.local</code>, simpan (Ctrl+S), lalu jalankan ulang <code>npm run dev</code>.
          </div>
        )}
        <label className="field">
          <span>NAMA PEMBALAP</span>
          <input value={name} maxLength={16} placeholder="Tulis namamu" onChange={(e) => setName(e.target.value)} />
        </label>

        <button className="btn btn-primary wide" disabled={busy || !configured} onClick={() => connect('create')}>
          {busy ? 'MENGHUBUNGKAN...' : 'BUAT ROOM BARU'}
        </button>

        <div className="or">
          <i />
          <span>ATAU GABUNG DENGAN KODE</span>
          <i />
        </div>

        <div className="join-row">
          <input
            className="code-input"
            value={codeInput}
            maxLength={5}
            placeholder="KODE"
            onChange={(e) => setCodeInput(normalizeCode(e.target.value))}
            onKeyDown={(e) => e.key === 'Enter' && codeInput.length === 5 && connect('join')}
          />
          <button className="btn btn-ghost" disabled={busy || !configured || codeInput.length !== 5} onClick={() => connect('join')}>
            GABUNG
          </button>
        </div>

        {error && <div className="notice bad">{error}</div>}
        <p className="dim small">Uji coba sendiri: buka game di dua tab browser, buat room di tab pertama, gabung dengan kodenya di tab kedua.</p>
      </div>
    </main>
  );
}
