// Tes balapan penuh tanpa tampilan: 4 mobil sekaligus dengan tabrakan antar mobil aktif.
// Memastikan tidak ada mobil yang macet/terjebak dan semuanya menyelesaikan balapan.
import { CARS } from '../src/lib/cars';
import { getTrack } from '../src/game/track';
import { FIXED_DT, newCarState, newControls, placeCar, specFromConfig, stepCar } from '../src/game/physics';
import { aiControl } from '../src/game/ai';
import { collideCars } from '../src/game/collision';

let failed = 0;
function check(name: string, ok: boolean, info = '') {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${name}${info ? '  — ' + info : ''}`);
  if (!ok) failed++;
}

const track = getTrack();
const LAPS = 2;
const lineup = [
  { car: CARS[0], pace: 1.0, off: -3.2 },
  { car: CARS[4], pace: 0.975, off: 3.0 },
  { car: CARS[6], pace: 0.94, off: -3.0 },
  { car: CARS[8], pace: 0.9, off: 3.0 },
];

const racers = lineup.map((l, i) => {
  const st = newCarState();
  const g = track.gridSlot(i);
  placeCar(st, g.x, g.z, g.heading);
  track.locate(st.x, st.z, -1, st.loc);
  return { ...l, st, spec: specFromConfig(l.car), ctl: newControls(), dist: g.s, lastS: st.loc.s, finishT: null as number | null, stuck: 0, maxStuck: 0, walls: 0 };
});

let t = 0;
let contacts = 0;
let strongest = 0;
while (t < 420 && racers.some((r) => r.finishT === null)) {
  for (const r of racers) {
    aiControl(r.st, r.spec, track, { pace: r.pace, lineOffset: r.off }, r.ctl);
    stepCar(r.st, r.spec, r.ctl, FIXED_DT, track);
    if (r.st.wallImpact > 1) r.walls++;
    let ds = r.st.loc.s - r.lastS;
    if (ds < -track.length / 2) ds += track.length;
    if (ds > track.length / 2) ds -= track.length;
    r.lastS = r.st.loc.s;
    r.dist += ds;
    if (r.finishT === null && r.dist >= LAPS * track.length) r.finishT = t;
    r.stuck = r.st.speed < 1.5 ? r.stuck + FIXED_DT : 0;
    r.maxStuck = Math.max(r.maxStuck, r.stuck);
  }
  for (let i = 0; i < racers.length; i++)
    for (let j = i + 1; j < racers.length; j++) {
      const h = collideCars(racers[i].st, racers[i].spec, racers[j].st, racers[j].spec, true, true);
      if (h && h.relSpeed > 0.8) {
        contacts++;
        strongest = Math.max(strongest, h.relSpeed);
      }
    }
  t += FIXED_DT;
}

const times = racers.map((r) => (r.finishT === null ? 'belum' : r.finishT.toFixed(1)));
check('semua mobil menyelesaikan balapan 4 mobil', racers.every((r) => r.finishT !== null), `waktu: ${times.join(' / ')} dtk`);
check('tidak ada mobil yang macet lebih dari 4 detik', racers.every((r) => r.maxStuck < 4), `macet terlama ${Math.max(...racers.map((r) => r.maxStuck)).toFixed(1)} dtk`);
check('tabrakan antar mobil tidak berlebihan', contacts < 600, `${contacts} langkah bersentuhan, benturan terkeras ${strongest.toFixed(1)} m/s`);
check('mobil tidak sering menghantam dinding', racers.every((r) => r.walls < 400), `langkah kontak dinding: ${racers.map((r) => r.walls).join(' / ')}`);

console.log(failed === 0 ? '\nSEMUA TES BALAPAN PENUH LULUS' : `\n${failed} TES GAGAL`);
process.exit(failed === 0 ? 0 : 1);
