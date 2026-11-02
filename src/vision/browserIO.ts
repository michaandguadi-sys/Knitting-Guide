import { Raster, fitLongSide } from './raster';

/** Largest working image: enough to see stitches, small enough for a phone's memory. */
const WORKING_LONG_SIDE = 1600;

export class PhotoLoadError extends Error {}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new PhotoLoadError('This image could not be opened.'));
    img.src = src;
  });
}

/** Browsers apply the phone's EXIF rotation when drawing an image, so the raster comes out upright. */
export async function loadPhoto(source: File | string): Promise<{ raster: Raster; originalLongSide: number; url: string }> {
  const url = typeof source === 'string' ? source : URL.createObjectURL(source);
  const img = await loadImageElement(url);
  const width = img.naturalWidth;
  const height = img.naturalHeight;
  if (!width || !height) throw new PhotoLoadError('This image has no size.');
  const scale = Math.min(1, WORKING_LONG_SIDE / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new PhotoLoadError('This browser cannot read images.');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return {
    raster: { width: data.width, height: data.height, data: data.data },
    originalLongSide: Math.max(width, height),
    url,
  };
}

export function rasterToDataUrl(raster: Raster, longSide = 1000, quality = 0.85): string {
  const fitted = fitLongSide(raster, longSide);
  const canvas = document.createElement('canvas');
  canvas.width = fitted.width;
  canvas.height = fitted.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const image = ctx.createImageData(fitted.width, fitted.height);
  image.data.set(fitted.data);
  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL('image/jpeg', quality);
}

/** Base64 JPEG without the data-URL prefix, the form the Gemini API expects. */
export async function encodeJpegBase64(raster: Raster): Promise<string> {
  return rasterToDataUrl(raster, 2000, 0.88).replace(/^data:image\/jpeg;base64,/, '');
}

export const nextFrame = () => new Promise<void>((resolve) => setTimeout(resolve, 16));
