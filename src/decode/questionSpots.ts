import { FabricReading } from '../vision/pipeline';
import { QuestionField } from './types';

/** A rectangle on the picture, as fractions of its width and height. */
export interface PictureSpot {
  x: number;
  y: number;
  w: number;
  h: number;
}

const TILE_PX = 128;

/**
 * Where to look to answer a question, worked out from what was measured. The brim is the bottom of
 * the piece, the crown its top, and the stitch question points at the clearest stretch of fabric.
 * Returns null when no single spot answers it.
 */
export function spotForQuestion(field: QuestionField, reading: FabricReading): PictureSpot | null {
  const { raster, segment, texture } = reading;
  const box = {
    x: segment.box.x / raster.width,
    y: segment.box.y / raster.height,
    w: segment.box.width / raster.width,
    h: segment.box.height / raster.height,
  };
  switch (field) {
    case 'stitch': {
      const clearest = [...texture.tiles]
        .sort((a, b) => b.periodicity * b.yarnPurity - a.periodicity * a.yarnPurity)[0];
      if (!clearest) return null;
      const side = TILE_PX * 2 ** clearest.level;
      return {
        x: clearest.x / raster.width,
        y: clearest.y / raster.height,
        w: Math.min(1, side / raster.width),
        h: Math.min(1, side / raster.height),
      };
    }
    case 'foldedBrim':
    case 'edgeStitch':
      return segment.fullFrame ? null : { x: box.x, y: box.y + box.h * 0.72, w: box.w, h: box.h * 0.28 };
    case 'direction':
      return segment.fullFrame ? null : { x: box.x + box.w * 0.2, y: box.y, w: box.w * 0.6, h: box.h * 0.25 };
    default:
      return null;
  }
}
