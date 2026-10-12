'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RaceGame, type HudState, type RaceResult } from '@/game/RaceGame';
import { TRACK_NAME } from '@/game/track';
import { getCar } from '@/lib/cars';
import { getAssist, getCarId, getLaps, getMode, getPlayerName, getQuality } from '@/lib/storage';
import { formatTime } from '@/lib/format';
import ResultPanel from './ResultPanel';
import type { RoomSession } from '@/net/session';
import type { PrepareInfo } from '@/net/protocol';

export interface NetRaceProps {
  session: RoomSession;
  prepare: PrepareInfo;
  isHost: boolean;
  onLobby: () => void;
  onLeave: () => void;
}

const REV_SEGMENTS = 22;

function Speedo({ hud }: { hud: HudState }) {
  const lit = Math.round(hud.rpm * REV_SEGMENTS);
  return (
    <div className="speedo panel">
      <div className="speedo-main">
        <b>{hud.speedKmh}</b>
        <span>KM/H</span>
        <em>{hud.gear === 0 ? 'N' : hud.gear}</em>
      </div>
      <div className="rev">
        {Array.from({ length: REV_SEGMENTS }, (_, i) => (
          <i key={i} className={(i < lit ? 'on ' : '') + (i >= REV_SEGMENTS - 5 ? 'red' : '')} />
        ))}
      </div>
    </div>
  );
}

function Countdown({ n }: { n: number }) {
  return (
    <div className="countdown">
      <div className="lights">
        {[3, 2, 1].map((k) => (
          <i key={k} className={n <= k && n > 0 ? 'red' : n === 0 ? 'green' : ''} />
        ))}
      </div>
      <b>{n === 0 ? 'GO!' : n}</b>
    </div>
  );
}

export default function RaceView({ net }: { net?: NetRaceProps }) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const miniRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<RaceGame | null>(null);
  const [hud, setHud] = useState<HudState | null>(null);
  const [result, setResult] = useState<RaceResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('Pembalap');
  const [carName, setCarName] = useState('');

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const meId = net ? net.session.meId() : '';
    const player = net ? net.prepare.names[meId] || 'Pembalap' : getPlayerName() || 'Pembalap';
    const carId = net ? net.prepare.cars[meId] || getCarId() : getCarId();
    setName(player);
    setCarName(getCar(carId).name);
    const game = new RaceGame(
      container,
      miniRef.current,
      {
        carId,
        mode: net ? 'race' : getMode(),
        laps: net ? net.prepare.laps : getLaps(),
        quality: getQuality(),
        playerName: player,
        assist: getAssist(),
        net: net ? { session: net.session, prepare: net.prepare } : undefined,
      },
      {
        onHud: (h) => setHud(h),
        onFinish: (r) => setResult(r),
        onError: (m) => setError(m),
      },
    );
    gameRef.current = game;
    void game.init();
    return () => {
      game.dispose();
      gameRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const retry = useCallback(() => {
    setResult(null);
    gameRef.current?.restart();
  }, []);

  const phase = hud?.phase ?? 'loading';
  const racingUi = hud && (phase === 'countdown' || phase === 'racing' || phase === 'finished' || phase === 'paused');

  return (
    <div className="race-root">
      <div ref={containerRef} className="race-canvas" />

      {phase === 'loading' && !error && (
        <div className="overlay center dim">
          <div className="loading-card">
            <b>GRAND TURISMO</b>
            <p>{hud?.loadingText || 'Menyiapkan balapan...'}</p>
            <div className="progress">
              <i style={{ width: `${Math.round((hud?.loadingPct ?? 0) * 100)}%` }} />
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="overlay center dim">
          <div className="loading-card">
            <b>Game tidak bisa dimulai</b>
            <p>{error}</p>
            <p className="dim">Pastikan browser mendukung WebGL (Chrome, Edge, atau Firefox terbaru).</p>
            <button className="btn btn-primary" onClick={() => router.push('/garage')}>
              KEMBALI KE GARASI
            </button>
          </div>
        </div>
      )}

      {hud && phase === 'waiting' && (
        <div className="overlay center dim">
          <div className="loading-card">
            <b>SIAP BERTANDING</b>
            <p>{hud.loadingText}</p>
            <div className="progress">
              <i style={{ width: '100%' }} />
            </div>
          </div>
        </div>
      )}

      {hud && phase === 'ready' && (
        <div className="overlay center">
          <div className="ready panel">
            <p className="eyebrow">{TRACK_NAME.toUpperCase()}</p>
            <h2>{carName}</h2>
            <p className="lead">
              {hud.laps} lap • {hud.racers > 1 ? `melawan ${hud.racers - 1} bot` : 'time trial dengan ghost lap terbaikmu'}
            </p>
            <div className="keys">
              <span>
                <kbd>W</kbd>
                <kbd>↑</kbd> Gas
              </span>
              <span>
                <kbd>S</kbd>
                <kbd>↓</kbd> Rem / mundur
              </span>
              <span>
                <kbd>A</kbd>
                <kbd>D</kbd> Belok
              </span>
              <span>
                <kbd>SPASI</kbd> Handbrake
              </span>
              <span>
                <kbd>R</kbd> Kembali ke lintasan
              </span>
              <span>
                <kbd>C</kbd> Kamera
              </span>
              <span>
                <kbd>M</kbd> Suara
              </span>
              <span>
                <kbd>Esc</kbd> Jeda
              </span>
            </div>
            <button className="btn btn-primary wide" onClick={() => gameRef.current?.begin()}>
              MULAI (ENTER)
            </button>
          </div>
        </div>
      )}

      {racingUi && hud && (
        <>
          <div className="hud-tl panel">
            <small>LAP</small>
            <b>
              {hud.lap}
              <span>/{hud.laps}</span>
            </b>
            {hud.racers > 1 && (
              <div className="pos">
                P{hud.position}
                <span>/{hud.racers}</span>
              </div>
            )}
          </div>

          <div className="hud-tc panel">
            <small>WAKTU LAP</small>
            <b>{formatTime(hud.lapTimeMs)}</b>
            <div className="sub">
              <span>
                TERBAIK <em>{formatTime(hud.bestLapMs)}</em>
              </span>
              <span>
                TERAKHIR <em>{formatTime(hud.lastLapMs)}</em>
              </span>
            </div>
            <div className="total">TOTAL {formatTime(hud.totalMs)}</div>
          </div>

          <div className="hud-tr panel">
            <small>SIRKUIT</small>
            <b>{TRACK_NAME}</b>
            <span className="dim">{name}</span>
            {net && (
              <button className="leave-btn" style={{ pointerEvents: 'auto' }} onClick={net.onLeave}>
                Keluar room
              </button>
            )}
          </div>

          <Speedo hud={hud} />

          <div className="hud-hint">
            <span>Esc jeda</span>
            <span>C kamera ({hud.view === 'chase' ? 'belakang' : 'kap'})</span>
            <span>M suara {hud.muted ? 'mati' : 'aktif'}</span>
            <span>R reset</span>
            <span className="dim">{hud.fps} FPS</span>
          </div>

          {hud.message && <div className={'banner ' + (hud.messageKind ?? 'info')}>{hud.message}</div>}
          {phase === 'countdown' && hud.countdown !== null && <Countdown n={hud.countdown} />}
        </>
      )}

      {/* Kanvas minimap harus selalu ada di DOM (game menyimpan referensinya); hanya ditampilkan saat balapan */}
      <div className="hud-bl" style={{ display: racingUi ? 'block' : 'none' }}>
        <canvas ref={miniRef} width={190} height={190} className="minimap" />
      </div>

      {phase === 'paused' && (
        <div className="overlay center dim">
          <div className="ready panel">
            <h2>JEDA</h2>
            <div className="btn-row col">
              <button className="btn btn-primary" onClick={() => gameRef.current?.togglePause()}>
                LANJUTKAN
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  gameRef.current?.togglePause();
                  setResult(null);
                  gameRef.current?.restart();
                }}
              >
                ULANGI DARI AWAL
              </button>
              <button className="btn btn-ghost" onClick={() => router.push('/garage')}>
                KE GARASI
              </button>
            </div>
          </div>
        </div>
      )}

      {result && (
        <ResultPanel
          result={result}
          playerName={name}
          onRetry={retry}
          onGarage={() => router.push('/garage')}
          onBoard={() => router.push('/leaderboard')}
          multiplayer={net ? { isHost: net.isHost, onLobby: net.onLobby, onLeave: net.onLeave } : undefined}
        />
      )}
    </div>
  );
}
