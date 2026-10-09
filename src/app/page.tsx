'use client';

// Halaman utama Clash Squad - Tahap 1: Fondasi Single-Player
import React from 'react';
import GameCanvas from '@/components/game/GameCanvas';

export default function HomePage() {
  return (
    <main style={styles.main}>
      <header style={styles.header}>
        <div style={styles.badge}>TAHAP 1: FONDASI SINGLE-PLAYER</div>
        <h1 style={styles.title}>CLASH SQUAD</h1>
        <p style={styles.subtitle}>
          Uji coba gerakan (WASD), tabrakan dinding simetris (AABB), bidikan mouse, dan tembakan hitscan ke target dummy.
        </p>
      </header>

      <section style={styles.gameSection}>
        <GameCanvas />
      </section>

      <footer style={styles.footer}>
        <p style={styles.footerText}>
          ⚡ Clash Squad MVP • Top-Down 2D Canvas Engine • Siap dilanjutkan ke Tahap 2 (Lobby & Room Supabase)
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
    padding: '24px 16px 40px',
    gap: '20px',
    backgroundColor: '#020617',
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: '8px',
    maxWidth: '800px',
  },
  badge: {
    fontSize: '11px',
    fontWeight: '700',
    letterSpacing: '0.1em',
    color: '#38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    border: '1px solid rgba(56, 189, 248, 0.3)',
    borderRadius: '9999px',
    padding: '4px 14px',
  },
  title: {
    fontSize: '32px',
    fontWeight: '900',
    letterSpacing: '0.08em',
    color: '#f8fafc',
    margin: 0,
    textShadow: '0 0 20px rgba(56, 189, 248, 0.3)',
  },
  subtitle: {
    fontSize: '14px',
    color: '#94a3b8',
    margin: 0,
    lineHeight: 1.5,
  },
  gameSection: {
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
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
