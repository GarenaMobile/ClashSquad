'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CARS, getCar } from '@/lib/cars';
import CarStats from '@/components/garage/CarStats';
import {
  getAssist,
  getBestLap,
  getCarId,
  getFlip,
  getLaps,
  getMode,
  getQuality,
  setAssist,
  setCarId,
  setFlip,
  setLaps,
  setMode,
  setQuality,
  type AssistLevelSetting,
  type QualityLevel,
  type RaceMode,
} from '@/lib/storage';
import { formatTime } from '@/lib/format';

const CarPreview = dynamic(() => import('@/components/garage/CarPreview'), {
  ssr: false,
  loading: () => <div className="preview-canvas" />,
});

export default function GaragePage() {
  const router = useRouter();
  const [carId, setCar] = useState('infiniti');
  const [flip, setFlipState] = useState(false);
  const [mode, setModeState] = useState<RaceMode>('race');
  const [laps, setLapsState] = useState(3);
  const [quality, setQualityState] = useState<QualityLevel>('medium');
  const [assist, setAssistState] = useState<AssistLevelSetting>('easy');
  const [loading, setLoading] = useState(true);
  const [best, setBest] = useState<number | null>(null);

  useEffect(() => {
    const id = getCarId();
    setCar(id);
    setFlipState(getFlip(id));
    setModeState(getMode());
    setLapsState(getLaps());
    setQualityState(getQuality());
    setAssistState(getAssist());
  }, []);

  useEffect(() => {
    setBest(getBestLap(carId));
    setFlipState(getFlip(carId));
  }, [carId]);

  const car = getCar(carId);

  const pick = (id: string) => {
    setCar(id);
    setCarId(id);
  };
  const toggleFlip = () => {
    const v = !flip;
    setFlipState(v);
    setFlip(carId, v);
  };
  const start = () => {
    setCarId(carId);
    setMode(mode);
    setLaps(laps);
    setQuality(quality);
    setAssist(assist);
    router.push('/race');
  };

  return (
    <main className="garage">
      <header className="topbar">
        <Link href="/" className="back">
          ← Menu
        </Link>
        <h2>GARASI</h2>
        <Link href="/leaderboard" className="back">
          Papan peringkat →
        </Link>
      </header>

      <div className="garage-grid">
        <section className="preview-wrap panel">
          <CarPreview car={car} flip={flip} onLoading={setLoading} />
          {loading && <div className="preview-loading">Memuat mobil...</div>}
          <div className="preview-caption">
            <b>{car.brand}</b>
            <span>{car.name}</span>
          </div>
          <p className="preview-hint">Geser untuk memutar mobil</p>
        </section>

        <section className="garage-side">
          <div className="panel">
            <h3>PILIH MOBIL</h3>
            <div className="car-list">
              {CARS.map((c) => (
                <button key={c.id} className={'car-item' + (c.id === carId ? ' active' : '')} onClick={() => pick(c.id)}>
                  <b>{c.shortName}</b>
                  <span>{c.tagline}</span>
                </button>
              ))}
            </div>
            <CarStats car={car} />
            <div className="best-line">
              <span>Lap terbaikmu dengan mobil ini</span>
              <b>{formatTime(best)}</b>
            </div>
            <button className="link-btn" onClick={toggleFlip}>
              Mobil tampak menghadap terbalik? Balik 180°
            </button>
          </div>

          <div className="panel">
            <h3>PENGATURAN BALAPAN</h3>
            <div className="opt-row">
              <span>Mode</span>
              <div className="seg">
                <button className={mode === 'race' ? 'on' : ''} onClick={() => setModeState('race')}>
                  Balapan vs Bot
                </button>
                <button className={mode === 'trial' ? 'on' : ''} onClick={() => setModeState('trial')}>
                  Time Trial + Ghost
                </button>
              </div>
            </div>
            <div className="opt-row">
              <span>Jumlah lap</span>
              <div className="seg">
                {[1, 2, 3, 5].map((n) => (
                  <button key={n} className={laps === n ? 'on' : ''} onClick={() => setLapsState(n)}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div className="opt-row">
              <span>Bantuan berkendara</span>
              <div className="seg">
                {([['easy', 'Mudah'], ['normal', 'Normal'], ['pro', 'Pro']] as [AssistLevelSetting, string][]).map(([k, label]) => (
                  <button key={k} className={assist === k ? 'on' : ''} onClick={() => setAssistState(k)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <p className="dim small" style={{ marginTop: -4, marginBottom: 12 }}>
              Mudah: grip dan rem lebih kuat, kerikil lebih ringan. Pro: sebaliknya.
            </p>
            <div className="opt-row">
              <span>Kualitas grafis</span>
              <div className="seg">
                {(['low', 'medium', 'high'] as QualityLevel[]).map((q) => (
                  <button key={q} className={quality === q ? 'on' : ''} onClick={() => setQualityState(q)}>
                    {q === 'low' ? 'Rendah' : q === 'medium' ? 'Sedang' : 'Tinggi'}
                  </button>
                ))}
              </div>
            </div>
            <button className="btn btn-primary wide" onClick={start}>
              MASUK KE TREK
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
