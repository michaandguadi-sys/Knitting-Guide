import { FabricReading } from '../vision/pipeline';
import { DecodeQuestion, QuestionField } from './types';

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
    case 'stitch':
    case 'yarnWeight': {
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
    case 'madeBy':
      return segment.fullFrame ? null : { x: box.x, y: box.y + box.h * 0.72, w: box.w, h: box.h * 0.28 };
    case 'direction':
    case 'crownWedges':
      return segment.fullFrame ? null : { x: box.x + box.w * 0.2, y: box.y, w: box.w * 0.6, h: box.h * 0.25 };
    default:
      return null;
  }
}

const ABOUT_A_PART: QuestionField[] = ['foldedBrim', 'edgeStitch', 'direction', 'crownWedges'];

/** Never says "the marked part" when a close-up or a missing outline left nothing to mark. */
export function whereToLook(question: DecodeQuestion, spot: PictureSpot | null, language: 'en' | 'es'): string {
  if (spot || !ABOUT_A_PART.includes(question.field)) return question.where;
  return language === 'es'
    ? 'No puedo marcarlo en esta foto. Si esa parte no aparece, elegí "No se ve en la foto".'
    : 'I cannot mark this on the photo. If that part is not in the picture, choose "I can\'t tell from the picture".';
}
