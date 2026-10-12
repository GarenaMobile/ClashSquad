'use client';

import { useEffect, useRef, useState } from 'react';
import type { RaceResult } from '@/game/RaceGame';
import { getCar } from '@/lib/cars';
import { formatTime } from '@/lib/format';
import { saveLapTime } from '@/lib/supabase';

const MEDAL = { gold: '🥇 EMAS', silver: '🥈 PERAK', bronze: '🥉 PERUNGGU' } as const;

export default function ResultPanel({
  result,
  playerName,
  onRetry,
  onGarage,
  onBoard,
  multiplayer,
}: {
  result: RaceResult;
  playerName: string;
  onRetry: () => void;
  onGarage: () => void;
  onBoard: () => void;
  multiplayer?: { isHost: boolean; onLobby: () => void; onLeave: () => void };
}) {
  const [saveState, setSaveState] = useState<'saving' | 'online' | 'local'>('saving');
  const saved = useRef(false);

  useEffect(() => {
    if (saved.current) return;
    saved.current = true;
    saveLapTime({
      player_name: playerName,
      car_id: result.carId,
      total_time_ms: result.totalMs,
      best_lap_ms: result.bestLapMs,
    })
      .then((r) => setSaveState(r.online ? 'online' : 'local'))
      .catch(() => setSaveState('local'));
  }, [result, playerName]);

  const win = result.position === 1;
  return (
    <div className="overlay center dim">
      <div className="result panel">
        <p className="eyebrow">{result.racers > 1 ? 'HASIL BALAPAN' : 'HASIL TIME TRIAL'}</p>
        <h2 className="result-pos">
          {result.racers > 1 ? (
            <>
              P{result.position}
              <small>/{result.racers}</small>
            </>
          ) : (
            'SELESAI'
          )}
          {win && result.racers > 1 && <span className="trophy">🏆</span>}
        </h2>
        {result.medal && <div className={'medal ' + result.medal}>{MEDAL[result.medal]}</div>}

        <div className="result-times">
          <div>
            <span>WAKTU TOTAL</span>
            <b>{formatTime(result.totalMs)}</b>
          </div>
          <div>
            <span>LAP TERCEPAT</span>
            <b>{formatTime(result.bestLapMs)}</b>
          </div>
        </div>

        <div className="lap-list">
          {result.lapTimes.map((t, i) => (
            <div key={i} className={t === result.bestLapMs ? 'best' : ''}>
              <span>Lap {i + 1}</span>
              <b>{formatTime(t)}</b>
            </div>
          ))}
        </div>

        {result.racers > 1 && (
          <div className="standings">
            {result.standings.map((s, i) => (
              <div key={i} className={s.isPlayer ? 'me' : ''}>
                <span>{i + 1}</span>
                <span>{s.isPlayer ? playerName || 'Kamu' : s.name}</span>
                <em>{s.carName}</em>
                <b>{s.timeMs !== null ? formatTime(s.timeMs) : 'masih balapan'}</b>
              </div>
            ))}
          </div>
        )}

        <p className="save-note">
          {saveState === 'saving' && 'Menyimpan ke papan peringkat...'}
          {saveState === 'online' && '✓ Tersimpan di papan peringkat online'}
          {saveState === 'local' && 'Tersimpan di perangkat ini (papan peringkat online belum aktif)'}
        </p>
        <p className="save-note dim">Mobil: {getCar(result.carId).name}</p>

        {multiplayer ? (
          <div className="btn-row">
            {multiplayer.isHost ? (
              <button className="btn btn-primary" onClick={multiplayer.onLobby}>
                KEMBALI KE LOBBY
              </button>
            ) : (
              <p className="save-note">Menunggu host membuka lobby lagi...</p>
            )}
            <button className="btn btn-ghost" onClick={multiplayer.onLeave}>
              KELUAR ROOM
            </button>
          </div>
        ) : (
          <div className="btn-row">
            <button className="btn btn-primary" onClick={onRetry}>
              BALAPAN LAGI
            </button>
            <button className="btn btn-ghost" onClick={onGarage}>
              GANTI MOBIL
            </button>
            <button className="btn btn-ghost" onClick={onBoard}>
              PERINGKAT
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
