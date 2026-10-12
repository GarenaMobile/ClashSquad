import type { CarConfig } from '@/lib/cars';

const clamp = (v: number) => Math.max(0.05, Math.min(1, v));

export default function CarStats({ car }: { car: CarConfig }) {
  const rows = [
    { label: 'Kecepatan puncak', value: clamp(car.stats.topSpeedKmH / 380), text: `${car.stats.topSpeedKmH} km/h`, color: '#ff9f1c' },
    { label: 'Akselerasi 0-100', value: clamp((4.2 - car.stats.accel0to100) / 2.2), text: `${car.stats.accel0to100.toFixed(1)} dtk`, color: '#35c7ff' },
    { label: 'Pengereman', value: clamp((car.tuning.brakeMult - 0.85) / 0.35), text: `${Math.round(car.tuning.brakeMult * 100)}%`, color: '#ff5d5d' },
    { label: 'Handling', value: clamp((car.tuning.gripMult * car.tuning.steerMult - 0.85) / 0.4), text: `${Math.round(car.tuning.gripMult * car.tuning.steerMult * 100)}%`, color: '#5fe08a' },
  ];
  return (
    <div className="stats">
      {rows.map((r) => (
        <div key={r.label} className="stat">
          <div className="stat-head">
            <span>{r.label}</span>
            <b>{r.text}</b>
          </div>
          <div className="bar">
            <i style={{ width: `${r.value * 100}%`, background: r.color }} />
          </div>
        </div>
      ))}
      <div className="stat-foot">
        <span>{car.stats.horsePower} HP</span>
        <span>{car.stats.weightKg} kg</span>
      </div>
    </div>
  );
}
