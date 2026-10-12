// Alat ukur: berapa meter sebelum tikungan U pertama kita harus mulai mengerem (dari 200 km/h) agar tidak keluar jalur?
import { CARS } from '../src/lib/cars';
import { getTrack, ROAD_HALF, KERB_W } from '../src/game/track';
import { FEEL, FIXED_DT, newCarState, newControls, placeCar, specFromConfig, stepCar, type AssistLevel } from '../src/game/physics';
import { aiControl } from '../src/game/ai';

const track = getTrack();
// awal tikungan ketat pertama setelah garis start
let sC = 0;
for (let i = 0; i < track.n; i++) {
  if (track.samples[i].s > 150 && Math.abs(track.samples[i].kappa) > 1 / 70) { sC = track.samples[i].s; break; }
}

function attempt(cfgIndex: number, D: number, startKmh: number, cornerKmh: number, level: AssistLevel = 'normal') {
  const spec = specFromConfig(CARS[cfgIndex], level);
  const car = newCarState();
  const p = track.at(sC - D);
  placeCar(car, p.x, p.z, p.heading);
  car.vx = Math.sin(p.heading) * (startKmh / 3.6);
  car.vz = Math.cos(p.heading) * (startKmh / 3.6);
  track.locate(car.x, car.z, -1, car.loc);
  const ctl = newControls();
  let ok = true, minV = 1e9, offMax = 0, t = 0;
  while (t < 30) {
    aiControl(car, spec, track, { pace: 1, lineOffset: 0 }, ctl);
    // pengemudi manusia sederhana: rem penuh sampai kecepatan tikungan, lalu gas halus
    const target = cornerKmh / 3.6;
    if (car.speed > target) { ctl.brake = 1; ctl.throttle = 0; } else { ctl.brake = 0; ctl.throttle = 0.35; }
    stepCar(car, spec, ctl, FIXED_DT, track);
    t += FIXED_DT;
    minV = Math.min(minV, car.speed);
    offMax = Math.max(offMax, Math.abs(car.loc.d));
    if (Math.abs(car.loc.d) > ROAD_HALF + KERB_W) { ok = false; break; }
    if (car.loc.s > sC + 260 || (car.loc.s < sC - D - 20)) break;
  }
  return { ok, offMax };
}

export function minBrakeDistance(cfgIndex = 0, startKmh = 200, cornerKmh = 100, level: AssistLevel = 'normal') {
  for (let D = 20; D <= 400; D += 5) {
    const r = attempt(cfgIndex, D, startKmh, cornerKmh, level);
    // sukses jika tidak keluar jalur pada jarak D dan semua jarak yang lebih jauh (hingga +40 m)
    if (r.ok && attempt(cfgIndex, D + 20, startKmh, cornerKmh, level).ok && attempt(cfgIndex, D + 40, startKmh, cornerKmh, level).ok) return D;
  }
  return -1;
}

if (process.argv[1].includes('corner_probe')) {
  console.log('tikungan ketat pertama di s =', sC.toFixed(0), 'm');
  for (const [startKmh, cornerKmh] of [[200, 100], [240, 110], [160, 90]]) {
    console.log(`dari ${startKmh} km/h ke ${cornerKmh} km/h: jarak rem minimum`, ['infiniti','bmw','lambo'].map((id) => { const i = CARS.findIndex((c) => c.id === id); return id + '=' + minBrakeDistance(i, startKmh, cornerKmh) + ' m'; }).join(', '));
  }
  console.log('FEEL:', JSON.stringify({ brakeG: FEEL.brakeG, brakeRise: FEEL.brakeRise }));
}
