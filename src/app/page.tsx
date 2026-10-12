'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getPlayerName, setPlayerName } from '@/lib/storage';

export default function HomePage() {
  const router = useRouter();
  const [name, setName] = useState('');

  useEffect(() => {
    setName(getPlayerName());
  }, []);

  const go = () => {
    const n = name.trim() || 'Pembalap';
    setPlayerName(n);
    router.push('/garage');
  };

  return (
    <main className="home">
      <div className="home-sky" />
      <div className="home-road" />
      <section className="home-card">
        <p className="eyebrow">VISION GT • TIME TRIAL &amp; RACE</p>
        <h1 className="logo">
          GRAND <span>TURISMO</span>
        </h1>
        <p className="lead">Pilih supercar, taklukkan Grand Circuit, dan rebut posisi teratas papan peringkat.</p>
        <label className="field">
          <span>NAMA PEMBALAP</span>
          <input
            value={name}
            maxLength={16}
            placeholder="Tulis namamu"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && go()}
          />
        </label>
        <div className="btn-row">
          <button className="btn btn-primary" onClick={go}>
            MULAI BALAPAN
          </button>
        </div>
        <div className="btn-row">
          <Link className="btn btn-ghost" href="/multiplayer">
            MULTIPLAYER
          </Link>
          <Link className="btn btn-ghost" href="/leaderboard">
            PAPAN PERINGKAT
          </Link>
        </div>
        <p className="hint">Dimainkan dengan keyboard di laptop atau PC.</p>
      </section>
    </main>
  );
}
