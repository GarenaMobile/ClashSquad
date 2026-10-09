'use client';

// Halaman Pengujian Clash Squad 3D - Tahap 0: Persiapan Boss Indominus Rex
import React, { useState } from 'react';
import dynamic from 'next/dynamic';

// Muat komponen Three.js secara client-only (ssr: false) sesuai instruksi teknis
const BossViewer = dynamic(() => import('@/components/boss/BossViewer'), {
  ssr: false,
  loading: () => (
    <div style={styles.loadingPlaceholder}>
      <p style={{ color: '#38bdf8', fontWeight: 'bold' }}>Menginisialisasi Three.js Engine...</p>
    </div>
  ),
});

const GameCanvas2D = dynamic(() => import('@/components/game/GameCanvas'), {
  ssr: false,
});

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<'boss' | '2d'>('boss');

  return (
    <main style={styles.main}>
      <header style={styles.header}>
        <div style={styles.badge}>TAHAP 0: PERSIAPAN BOSS (THREE.JS 3D)</div>
        <h1 style={styles.title}>CLASH SQUAD 3D</h1>
        <p style={styles.subtitle}>
          Pengujian Boss <strong>Indominus Rex</strong>: Model teroptimasi (2.49 MB, 51.7k poligon), 4 animasi kustom 30 FPS, material cel-shading, dan skala perbandingan pemain.
        </p>

        {/* Tab Selector */}
        <div style={styles.tabContainer}>
          <button
            onClick={() => setActiveTab('boss')}
            style={{
              ...styles.tabBtn,
              ...(activeTab === 'boss' ? styles.tabBtnActive : {}),
            }}
          >
            🦖 Uji 3D Boss Indominus (Tahap 0)
          </button>
          <button
            onClick={() => setActiveTab('2d')}
            style={{
              ...styles.tabBtn,
              ...(activeTab === '2d' ? styles.tabBtnActive : {}),
            }}
          >
            🎯 Fondasi Hitscan 2D (Arsip Tahap 1)
          </button>
        </div>
      </header>

      <section style={styles.contentSection}>
        {activeTab === 'boss' ? (
          <BossViewer />
        ) : (
          <div style={styles.gameWrapper}>
            <GameCanvas2D />
          </div>
        )}
      </section>

      <footer style={styles.footer}>
        <p style={styles.footerText}>
          ⚡ Clash Squad 3D • Next.js & Three.js • Siap dilanjutkan ke <strong>Tahap 1: Fondasi Single-Player 3D (First-Person, Pointer Lock & AI Boss)</strong>
        </p>
      </footer>
    </main>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  main: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '24px 16px 36px',
    gap: '20px',
    backgroundColor: '#020617',
    color: '#f8fafc',
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: '10px',
    maxWidth: '850px',
  },
  badge: {
    fontSize: '11px',
    fontWeight: '800',
    letterSpacing: '0.12em',
    color: '#38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    border: '1px solid rgba(56, 189, 248, 0.35)',
    borderRadius: '9999px',
    padding: '5px 16px',
  },
  title: {
    fontSize: '34px',
    fontWeight: '900',
    letterSpacing: '0.08em',
    color: '#f8fafc',
    margin: 0,
    textShadow: '0 0 24px rgba(56, 189, 248, 0.35)',
  },
  subtitle: {
    fontSize: '14px',
    color: '#94a3b8',
    margin: 0,
    lineHeight: 1.6,
  },
  tabContainer: {
    display: 'flex',
    gap: '8px',
    marginTop: '6px',
    backgroundColor: '#0f172a',
    padding: '4px',
    borderRadius: '10px',
    border: '1px solid #334155',
  },
  tabBtn: {
    padding: '8px 18px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '600',
    border: 'none',
    backgroundColor: 'transparent',
    color: '#94a3b8',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  tabBtnActive: {
    backgroundColor: '#0284c7',
    color: '#ffffff',
    boxShadow: '0 2px 8px rgba(2, 132, 199, 0.4)',
  },
  contentSection: {
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
  },
  gameWrapper: {
    width: '100%',
    maxWidth: '960px',
    display: 'flex',
    justifyContent: 'center',
  },
  loadingPlaceholder: {
    width: '100%',
    maxWidth: '1080px',
    height: '540px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a',
    borderRadius: '16px',
    border: '1px solid #334155',
  },
  footer: {
    marginTop: 'auto',
    textAlign: 'center',
  },
  footerText: {
    fontSize: '12px',
    color: '#64748b',
  },
};
