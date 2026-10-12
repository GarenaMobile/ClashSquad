'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchTopLapTimes, subscribeLapTimes, type LapTimeEntry } from '@/lib/supabase';
import { getCar } from '@/lib/cars';
import { formatTime } from '@/lib/format';
import { getPlayerName } from '@/lib/storage';

export default function LeaderboardTable() {
  const [rows, setRows] = useState<LapTimeEntry[]>([]);
  const [online, setOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState('');

  const load = useCallback(async () => {
    const r = await fetchTopLapTimes();
    setRows(r.rows);
    setOnline(r.online);
    setLoading(false);
  }, []);

  useEffect(() => {
    setMe(getPlayerName());
    void load();
    const off = subscribeLapTimes(() => void load());
    return off;
  }, [load]);

  return (
    <div className="panel board">
      <div className="board-head">
        <h3>10 WAKTU TERCEPAT</h3>
        <span className={'pill ' + (online ? 'on' : '')}>{online ? '● LIVE' : 'OFFLINE (lokal)'}</span>
      </div>
      {loading && <p className="dim">Memuat...</p>}
      {!loading && rows.length === 0 && <p className="dim">Belum ada catatan waktu. Jadilah yang pertama!</p>}
      {rows.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Pembalap</th>
              <th>Mobil</th>
              <th>Total</th>
              <th>Lap terbaik</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id ?? i} className={r.player_name === me ? 'me' : ''}>
                <td>{i + 1}</td>
                <td>{r.player_name}</td>
                <td>{getCar(r.car_id).shortName}</td>
                <td>{formatTime(r.total_time_ms)}</td>
                <td>{formatTime(r.best_lap_ms)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {!online && (
        <p className="dim small">
          Papan peringkat online belum aktif. Isi file .env.local dengan data Supabase dan jalankan file SQL di folder supabase/migrations.
        </p>
      )}
    </div>
  );
}
