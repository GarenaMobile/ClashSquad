'use client';

import Link from 'next/link';
import LeaderboardTable from '@/components/board/LeaderboardTable';

export default function LeaderboardPage() {
  return (
    <main className="garage">
      <header className="topbar">
        <Link href="/" className="back">
          ← Menu
        </Link>
        <h2>PAPAN PERINGKAT</h2>
        <Link href="/garage" className="back">
          Garasi →
        </Link>
      </header>
      <div className="board-wrap">
        <LeaderboardTable />
        <Link href="/garage" className="btn btn-primary wide" style={{ marginTop: 16, textAlign: 'center' }}>
          BALAPAN SEKARANG
        </Link>
      </div>
    </main>
  );
}
