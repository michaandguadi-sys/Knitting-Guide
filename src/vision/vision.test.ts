import test from 'node:test';
import assert from 'node:assert/strict';
import { readFabric } from './pipeline';
import { Raster, createRaster } from './raster';
import { segmentGarment } from './segment';
import { analyzeColors } from './colors';
import { SynthStitch, renderFabric, rng } from './testing/synthFabric';

const families: Record<SynthStitch, string[]> = {
  stockinette: ['vee_lattice'],
  reverse_stockinette: ['horizontal_ridges', 'bump_lattice'],
  garter: ['horizontal_ridges'],
  rib_1x1: ['vertical_columns'],
  rib_2x2: ['vertical_columns'],
  seed: ['bump_lattice'],
};

function darken(src: Raster, factor: number): Raster {
  const out = createRaster(src.width, src.height);
  for (let i = 0; i < src.data.length; i += 4) {
    out.data[i] = src.data[i] * factor;
    out.data[i + 1] = src.data[i + 1] * factor;
    out.data[i + 2] = src.data[i + 2] * factor;
    out.data[i + 3] = 255;
  }
  return out;
}

function boxBlur(src: Raster, radius: number): Raster {
  const out = createRaster(src.width, src.height);
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      const acc = [0, 0, 0];
      let n = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const yy = Math.min(src.height - 1, Math.max(0, y + dy));
          const xx = Math.min(src.width - 1, Math.max(0, x + dx));
          const p = (yy * src.width + xx) * 4;
          acc[0] += src.data[p];
          acc[1] += src.data[p + 1];
          acc[2] += src.data[p + 2];
          n++;
        }
      }
      const q = (y * src.width + x) * 4;
      out.data[q] = acc[0] / n;
      out.data[q + 1] = acc[1] / n;
      out.data[q + 2] = acc[2] / n;
      out.data[q + 3] = 255;
    }
  }
  return out;
}

/** A garment-shaped patch of fabric pasted on a plain surface, the normal phone photo. */
function onTable(fabric: Raster, surface: [number, number, number], width = 960, height = 800): Raster {
  const out = createRaster(width, height);
  const random = rng(3);
  const ox = Math.floor((width - fabric.width) / 2);
  const oy = Math.floor((height - fabric.height) / 2);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = (y * width + x) * 4;
      const fx = x - ox;
      const fy = y - oy;
      if (fx >= 0 && fy >= 0 && fx < fabric.width && fy < fabric.height) {
        const q = (fy * fabric.width + fx) * 4;
        out.data[p] = fabric.data[q];
        out.data[p + 1] = fabric.data[q + 1];
        out.data[p + 2] = fabric.data[q + 2];
      } else {
        const n = (random() - 0.5) * 4;
        out.data[p] = surface[0] + n;
        out.data[p + 1] = surface[1] + n;
        out.data[p + 2] = surface[2] + n;
      }
      out.data[p + 3] = 255;
    }
  }
  return out;
}

for (const stitch of Object.keys(families) as SynthStitch[]) {
  test(`reads ${stitch} through normal photo conditions`, () => {
    const variants = [
      { name: 'clean', opts: {} },
      { name: 'other gauge', opts: { stitchPx: 14, rowPx: 10 } },
      { name: 'big stitches', opts: { stitchPx: 36, rowPx: 27 } },
      { name: 'tilted 8 degrees', opts: { tiltDeg: 8 } },
      { name: 'uneven light', opts: { light: 0.7 } },
      { name: 'dark yarn', opts: { color: [40, 44, 60] as [number, number, number] } },
      { name: 'pale yarn', opts: { color: [205, 195, 175] as [number, number, number] } },
    ];
    const misses: string[] = [];
    for (const variant of variants) {
      const reading = readFabric(renderFabric({ stitch, ...variant.opts }));
      if (!families[stitch].includes(reading.texture.family)) misses.push(`${variant.name}: ${reading.texture.family}`);
    }
    assert.ok(misses.length <= 1, `${stitch} misread in ${misses.join(', ')}`);
  });
}

test('measures stitch size, unaffected by which stitch it is', () => {
  for (const [stitchPx, rowPx] of [[20, 15], [14, 10], [32, 24]]) {
    const texture = readFabric(renderFabric({ stitch: 'stockinette', stitchPx, rowPx })).texture;
    assert.ok(Math.abs(texture.pxPerStitch! - stitchPx) / stitchPx < 0.1, `${stitchPx}: got ${texture.pxPerStitch}`);
    assert.ok(Math.abs(texture.pxPerRow! - rowPx) / rowPx < 0.1, `${rowPx}: got ${texture.pxPerRow}`);
  }
});

test('tells 1x1 from 2x2 rib', () => {
  assert.equal(readFabric(renderFabric({ stitch: 'rib_1x1' })).texture.ribRepeatSts, 2);
  assert.equal(readFabric(renderFabric({ stitch: 'rib_2x2' })).texture.ribRepeatSts, 4);
});

test('a blurred photo is not read confidently', () => {
  const sharp = readFabric(renderFabric({ stitch: 'stockinette', stitchPx: 14, rowPx: 10 }));
  const blurred = readFabric(boxBlur(renderFabric({ stitch: 'stockinette', stitchPx: 14, rowPx: 10 }), 7));
  assert.ok(blurred.textureConfidence < sharp.textureConfidence, `${blurred.textureConfidence} vs ${sharp.textureConfidence}`);
  assert.ok(blurred.quality.issues.some((i) => i.code === 'blurry' || i.code === 'stitches_too_small'));
});

test('quality gate flags dark and tiny photos', () => {
  const dark = readFabric(darken(renderFabric({ stitch: 'garter', color: [80, 80, 80] }), 0.12));
  assert.ok(dark.quality.issues.some((i) => i.code === 'too_dark'));
  const tiny = readFabric(renderFabric({ stitch: 'garter', width: 200, height: 200 }), 200);
  assert.equal(tiny.quality.usable, false);
  assert.ok(tiny.quality.issues.some((i) => i.code === 'too_small'));
});

test('a small Pinterest-size picture is flagged but still usable', () => {
  const pin = readFabric(renderFabric({ stitch: 'garter', width: 474, height: 474 }), 474);
  assert.equal(pin.quality.usable, true);
  assert.ok(pin.quality.issues.some((i) => i.code === 'too_small' && i.severity === 'warn'));
});

test('a close-up keeps all its fabric instead of cutting stitches away', () => {
  const seg = segmentGarment(renderFabric({ stitch: 'stockinette' }));
  assert.equal(seg.fullFrame, true);
  assert.equal(seg.coverage, 1);
});

test('separates a garment from a table, even light yarn on a light table', () => {
  const dark = segmentGarment(onTable(renderFabric({ stitch: 'stockinette', width: 520, height: 460, color: [120, 40, 40] }), [210, 205, 195]));
  assert.equal(dark.fullFrame, false);
  assert.ok(Math.abs(dark.coverage - (520 * 460) / (960 * 800)) < 0.06, `coverage ${dark.coverage}`);

  const pale = segmentGarment(onTable(renderFabric({ stitch: 'garter', width: 520, height: 460, color: [190, 185, 170] }), [225, 222, 215]));
  assert.equal(pale.fullFrame, false);
  assert.ok(pale.coverage > 0.2 && pale.coverage < 0.45, `coverage ${pale.coverage}`);
});

test('finds stripes as yarn colours, with stitch shadows not counted as extra yarns', () => {
  const solid = readFabric(renderFabric({ stitch: 'rib_1x1', color: [150, 70, 60] }));
  assert.equal(solid.colors.colors.length, 1);
  assert.equal(solid.colors.layout, 'solid');

  const striped = renderFabric({ stitch: 'stockinette', stripe: { color: [20, 50, 140], every: 8, width: 3 } });
  const reading = readFabric(striped);
  assert.ok(reading.colors.colors.length >= 2, reading.colors.colors.map((c) => c.name.en).join());
  assert.equal(reading.colors.layout, 'vertical_stripes');
});

test('the same photo decodes the same way every time', () => {
  const photo = renderFabric({ stitch: 'seed' });
  const a = readFabric(photo);
  const b = readFabric(photo);
  assert.equal(a.texture.family, b.texture.family);
  assert.equal(a.texture.pxPerStitch, b.texture.pxPerStitch);
  assert.deepEqual(a.colors.colors.map((c) => c.hex), b.colors.colors.map((c) => c.hex));
});

test('does not throw on degenerate input', () => {
  const flat = createRaster(400, 400);
  flat.data.fill(128);
  const reading = readFabric(flat, 400);
  assert.equal(reading.texture.family, 'unresolved');
  assert.equal(reading.textureConfidence, 0);
  assert.ok(analyzeColors(flat, { width: 400, height: 400, data: new Uint8Array(400 * 400) }, null).colors.length === 0);
});
