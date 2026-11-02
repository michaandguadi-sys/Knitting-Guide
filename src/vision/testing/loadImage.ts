import fs from 'node:fs';
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';
import { Raster } from '../raster';

/** Test-only file decoding. The app itself decodes through the browser canvas. */
export function loadImage(path: string): Raster {
  const bytes = fs.readFileSync(path);
  if (path.toLowerCase().endsWith('.png')) {
    const png = PNG.sync.read(bytes);
    return { width: png.width, height: png.height, data: new Uint8ClampedArray(png.data) };
  }
  const decoded = jpeg.decode(bytes, { useTArray: true, maxMemoryUsageInMB: 2048, maxResolutionInMP: 200 });
  return { width: decoded.width, height: decoded.height, data: new Uint8ClampedArray(decoded.data) };
}

export function savePng(path: string, raster: Raster): void {
  const png = new PNG({ width: raster.width, height: raster.height });
  png.data = Buffer.from(raster.data);
  fs.writeFileSync(path, PNG.sync.write(png));
}
