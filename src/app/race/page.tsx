'use client';

import dynamic from 'next/dynamic';

const RaceView = dynamic(() => import('@/components/race/RaceView'), {
  ssr: false,
  loading: () => (
    <div className="overlay center">
      <div className="loading-card">
        <b>Menyiapkan balapan...</b>
      </div>
    </div>
  ),
});

export default function RacePage() {
  return <RaceView />;
}
