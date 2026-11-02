// Dev tool: prints what the vision stages measure on each image. npx tsx src/vision/testing/inspect.ts <dir|files> [--save out]
import fs from 'node:fs';
import path from 'node:path';
import { fitLongSide } from '../raster';
import { segmentGarment } from '../segment';
import { enhance } from '../enhance';
import { analyzeTexture } from '../texture';
import { analyzeColors } from '../colors';
import { loadImage, savePng } from './loadImage';

const args = process.argv.slice(2);
const saveIdx = args.indexOf('--save');
const saveDir = saveIdx >= 0 ? args.splice(saveIdx, 2)[1] : null;
const files = args.flatMap((a) =>
  fs.statSync(a).isDirectory() ? fs.readdirSync(a).filter((f) => /\.(jpe?g|png)$/i.test(f)).map((f) => path.join(a, f)) : [a]
);
const f2 = (n: number | null | undefined) => (n === null || n === undefined ? ' - ' : n.toFixed(2));
for (const file of files.sort()) {
  const img = fitLongSide(loadImage(file), 1600);
  const t0 = Date.now();
  const seg = segmentGarment(img);
  const en = enhance(img, seg.mask);
  const first = analyzeTexture(en.flat, seg.mask);
  const col = analyzeColors(en.clean, seg.mask, first.pxPerStitch);
  const tx = analyzeTexture(en.flat, seg.mask, { labels: col.labels, width: col.labelWidth, height: col.labelHeight, sourceWidth: img.width, sourceHeight: img.height });
  console.log(
    `${path.basename(file).padEnd(34)} ${tx.family.padEnd(18)} agree=${f2(tx.agreement)} per=${f2(tx.periodicity)} stitch=${f2(tx.pxPerStitch)} row=${f2(tx.pxPerRow)} ribRep=${tx.ribRepeatSts ?? '-'} tilt=${tx.tiltDeg} lvl=${tx.level} tiles=${tx.tileCount} cov=${f2(seg.coverage)} full=${seg.fullFrame} ${Date.now() - t0}ms`
  );
  console.log(`    colors=${col.colors.map((c) => c.name.en + ':' + Math.round(c.share * 100) + '%').join(' ')} layout=${col.layout}(${f2(col.layoutConfidence)}) stripeW=${f2(col.stripeWidthPx)} stripeH=${f2(col.stripeHeightPx)}`);
  const mean = (fn: (t: (typeof tx.tiles)[0]) => number) => tx.tiles.reduce((a, t) => a + fn(t), 0) / Math.max(1, tx.tiles.length);
  console.log(
    `    colP=${f2(mean((t) => t.columnPersistence))} rowP=${f2(mean((t) => t.rowPersistence))} eX=${f2(mean((t) => t.energyX))} eY=${f2(mean((t) => t.energyY))} eD=${f2(mean((t) => t.energyDiag))} brick=${f2(mean((t) => t.brick))} sX=${f2(mean((t) => t.strengthX))} sY=${f2(mean((t) => t.strengthY))}  zones=${tx.zones.map((z) => z.zone[0] + ':' + z.family).join(' ')}`
  );
  if (saveDir) {
    fs.mkdirSync(saveDir, { recursive: true });
    savePng(path.join(saveDir, path.basename(file) + '.map.png'), fitLongSide(en.stitchMap, 900));
  }
}
