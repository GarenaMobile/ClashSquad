'use client';

// Komponen HUD (Heads-Up Display) menampilkan informasi HP dan status permainan
import React from 'react';

interface HUDProps {
  playerHp: number;
  maxHp: number;
  canShoot: boolean;
  score: number;
}

export default function HUD({ playerHp, maxHp, canShoot, score }: HUDProps) {
  const hpPercent = Math.max(0, Math.min(100, (playerHp / maxHp) * 100));

  return (
    <div style={styles.hudContainer}>
      {/* Bar Darah (HP) Pemain */}
      <div style={styles.hpCard}>
        <div style={styles.hpLabelRow}>
          <span style={styles.hpTitle}>HP PEMAIN</span>
          <span style={styles.hpValue}>
            {playerHp} / {maxHp}
          </span>
        </div>
        <div style={styles.hpBarBg}>
          <div
            style={{
              ...styles.hpBarFill,
              width: `${hpPercent}%`,
              backgroundColor: hpPercent > 40 ? '#38bdf8' : '#ef4444',
            }}
          />
        </div>
      </div>

      {/* Status Senjata & Skor Target */}
      <div style={styles.statsCard}>
        <div style={styles.statItem}>
          <span style={styles.statLabel}>STATUS SENJATA</span>
          <span
            style={{
              ...styles.statBadge,
              backgroundColor: canShoot ? '#10b981' : '#f59e0b',
            }}
          >
            {canShoot ? 'SIAP TEMBAK' : 'RELOAD/JEDA'}
          </span>
        </div>

        <div style={styles.statItem}>
          <span style={styles.statLabel}>TARGET HANCUR</span>
          <span style={styles.scoreValue}>{score}</span>
        </div>
      </div>

      {/* Petunjuk Kontrol */}
      <div style={styles.controlsInfo}>
        <span style={styles.controlKey}>[W][A][S][D]</span> Gerak &nbsp;•&nbsp;
        <span style={styles.controlKey}>[Mouse]</span> Arah Bidik &nbsp;•&nbsp;
        <span style={styles.controlKey}>[Klik Kiri]</span> Tembak
      </div>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  hudContainer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    maxWidth: '960px',
    backgroundColor: '#0f172a',
    border: '1px solid #334155',
    borderRadius: '12px',
    padding: '12px 20px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.4)',
    color: '#f8fafc',
    userSelect: 'none',
  },
  hpCard: {
    display: 'flex',
    flexDirection: 'column',
    width: '240px',
    gap: '6px',
  },
  hpLabelRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '12px',
    fontWeight: 'bold',
    letterSpacing: '0.05em',
    color: '#94a3b8',
  },
  hpTitle: {
    color: '#38bdf8',
  },
  hpValue: {
    color: '#f8fafc',
    fontVariantNumeric: 'tabular-nums',
  },
  hpBarBg: {
    height: '14px',
    backgroundColor: '#1e293b',
    borderRadius: '6px',
    overflow: 'hidden',
    border: '1px solid #334155',
  },
  hpBarFill: {
    height: '100%',
    transition: 'width 0.15s ease-out',
  },
  statsCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '24px',
  },
  statItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
  },
  statLabel: {
    fontSize: '11px',
    color: '#94a3b8',
    letterSpacing: '0.05em',
  },
  statBadge: {
    fontSize: '12px',
    fontWeight: 'bold',
    padding: '3px 10px',
    borderRadius: '9999px',
    color: '#ffffff',
  },
  scoreValue: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#facc15',
  },
  controlsInfo: {
    fontSize: '12px',
    color: '#94a3b8',
  },
  controlKey: {
    color: '#f8fafc',
    fontWeight: 'bold',
  },
};
