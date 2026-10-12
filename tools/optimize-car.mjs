// ====================================================================
// OPTIMASI MODEL MOBIL (.glb) UNTUK GAME
//
// Pemakaian (dari folder tools):
//   npm install
//   node optimize-car.mjs <file-asli.glb> ../public/models/car_<id>.glb [target-segitiga=60000] [ukuran-tekstur=1024]
//
// Yang dilakukan: skala ke panjang 4,7 m, pusat di tengah & dasar roda di tanah, gabung mesh per material,
// sederhanakan ke ±60 ribu segitiga, kompres tekstur (WebP) dan geometri. Hasil biasanya 1-2 MB.
// Syarat model: bagian depan mobil menghadap sumbu +Z dan sumbu panjang = Z.
// Jika depan model menghadap arah lain, setel frontRotationY di src/lib/cars.ts (Math.PI untuk 180 derajat).
// Opsional: SIMP_ERR=0.012 untuk penyederhanaan lebih agresif.
// ====================================================================
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, flatten, join, weld, simplify, textureCompress, quantize, meshopt, getBounds } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'fs';

await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
  'meshopt.decoder': MeshoptDecoder,
  'meshopt.encoder': MeshoptEncoder,
});

const [src, dst, targetTris = '60000', texSize = '1024'] = process.argv.slice(2);
const doc = await io.read(src);
const root = doc.getRoot();
const scene = root.listScenes()[0];

// 1) normalisasi: skala ke panjang 4,7 m, pusat di X/Z = 0, dasar roda di Y = 0, depan = +Z
const b = getBounds(scene);
const size = [b.max[0]-b.min[0], b.max[1]-b.min[1], b.max[2]-b.min[2]];
const s = 4.7 / size[2];
const cx = (b.max[0]+b.min[0])/2, cz = (b.max[2]+b.min[2])/2;
const wrapper = doc.createNode('car_root').setScale([s,s,s]).setTranslation([-cx*s, -b.min[1]*s, -cz*s]);
for (const child of scene.listChildren()) { scene.removeChild(child); wrapper.addChild(child); }
scene.addChild(wrapper);

const trisBefore = (() => { let t=0; for (const m of root.listMeshes()) for (const p of m.listPrimitives()) t += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount())/3; return t; })();

await doc.transform(
  dedup(),
  flatten(),
  join({ keepMeshes: false, keepNamed: false }),
  weld({ tolerance: 0.0005 }),
  prune(),
);

let tri = 0;
for (const m of root.listMeshes()) for (const p of m.listPrimitives()) tri += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount())/3;
const ratio = Math.min(1, Number(targetTris) / tri);
if (ratio < 0.98) {
  await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio, error: Number(process.env.SIMP_ERR || 0.004), lockBorder: false }));
}
await doc.transform(
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [Number(texSize), Number(texSize)], quality: 82 }),
  prune(),
  quantize(),
  meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
);

let triAfter = 0;
for (const m of root.listMeshes()) for (const p of m.listPrimitives()) triAfter += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount())/3;
await io.write(dst, doc);
const nb = getBounds(doc.getRoot().listScenes()[0]);
console.log(JSON.stringify({
  src: src.split('/').pop(), trisBefore: Math.round(trisBefore), trisAfter: Math.round(triAfter),
  meshes: root.listMeshes().length, mats: root.listMaterials().length, tex: root.listTextures().length,
  MB: +(fs.statSync(dst).size/1e6).toFixed(2),
  bounds: { min: nb.min.map(v=>+v.toFixed(2)), max: nb.max.map(v=>+v.toFixed(2)) },
}));
