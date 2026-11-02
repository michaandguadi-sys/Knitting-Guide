// Dev tool: scores the stitch reading against labelled real photos. npx tsx src/vision/testing/realBench.ts <dir>
import fs from 'node:fs';
import path from 'node:path';
import { fitLongSide } from '../raster';
import { readFabric } from '../pipeline';
import { loadImage } from './loadImage';

const EXPECT: Record<string, string[]> = {
  stockinette: ['vee_lattice'],
  garter: ['horizontal_ridges'],
  rib: ['vertical_columns'],
  seed: ['bump_lattice'],
  cable: ['irregular'],
  fairisle: ['irregular', 'unresolved'],
};
const dir = process.argv[2];
let right = 0;
let wrong = 0;
let abstained = 0;
for (const file of fs.readdirSync(dir).filter((f) => /\.(jpe?g|png)$/i.test(f)).sort()) {
  const label = file.split('_')[0];
  const reading = readFabric(fitLongSide(loadImage(path.join(dir, file)), 1600));
  const family = reading.texture.family;
  const unsure = reading.textureConfidence < 0.5 || family === 'unresolved' || family === 'irregular';
  const ok = EXPECT[label]?.includes(family);
  let verdict = 'WRONG';
  if (ok) (verdict = 'ok'), right++;
  else if (unsure) (verdict = 'says unsure'), abstained++;
  else wrong++;
  console.log(`${file.padEnd(22)} ${family.padEnd(18)} conf=${reading.textureConfidence.toFixed(2)} ${verdict}`);
}
console.log({ right, abstained, confidentlyWrong: wrong });
