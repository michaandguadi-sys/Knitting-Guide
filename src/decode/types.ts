import { ColorworkType, ConstructionType, GarmentType, MadeBy, StitchType, YarnWeightCategory } from '../types/knit';
import { FabricReading } from '../vision/pipeline';
import { Raster } from '../vision/raster';
import type { Deduction, Observation } from './analysis';

export type PhotoSlot = 'front' | 'closeup' | 'inside' | 'top' | 'edge';

export interface PhotoInput {
  slot: PhotoSlot;
  raster: Raster;
  originalLongSide: number;
}

export type FieldSource = 'measured' | 'ai' | 'you' | 'assumed';

/** One conclusion about the piece, always carrying where it came from and how sure it is. */
export interface Finding<T> {
  value: T;
  confidence: number;
  source: FieldSource;
  /** Short, plain reason a knitter can check against the photo. */
  evidence: string;
  alternatives?: T[];
}

export type InputKind = 'knitted_item' | 'crochet' | 'woven_or_other' | 'written_or_chart' | 'unclear';
export type WorkMethod = 'round' | 'flat' | 'unknown';
export type WorkDirection = 'bottom_up' | 'top_down' | 'side_to_side' | 'unknown';
export type ColorworkTechnique = 'none' | 'stripes' | 'stranded' | 'intarsia' | 'variegated_yarn' | 'unknown';

export interface Decoded {
  inputKind: Finding<InputKind>;
  garment: Finding<GarmentType>;
  stitch: Finding<StitchType>;
  /** Stitch of the brim, hem or cuff where it differs from the body. */
  edgeStitch: Finding<StitchType | 'same'>;
  method: Finding<WorkMethod>;
  direction: Finding<WorkDirection>;
  foldedBrim: Finding<boolean>;
  crownWedges: Finding<number | null>;
  colorwork: Finding<ColorworkType>;
  madeBy: Finding<MadeBy>;
  yarnWeight: Finding<YarnWeightCategory>;
  needleMm: Finding<number>;
  features: string[];
  title: string;
  notes: string[];
  /** Direct answer to the knitter's latest correction. */
  reply: string;
  /** The one extra photo the AI would most like to see. */
  nextPhoto: { slot: Exclude<PhotoSlot, 'front'>; reason: string } | null;
  /** The AI's written steps. Useful where the compiler cannot write row by row. Not stitch-checked. */
  howTo: string[];
}

/** The one part of the picture the knitter wants to make, as fractions of the picture. */
export interface PhotoFocus {
  x: number;
  y: number;
  /** Width of the selected square as a share of the picture's shorter side. */
  size: number;
}

/** A spot the knitter tapped on the photo, as fractions of its width and height. */
export interface PhotoMark {
  x: number;
  y: number;
  note: string;
}

/** Answer meaning "I cannot tell from my picture": the best guess is kept and not asked again. */
export const CANT_TELL = '__cant_tell';

export type QuestionField = 'stitch' | 'method' | 'direction' | 'foldedBrim' | 'garment' | 'madeBy' | 'crownWedges';

export interface QuestionOption {
  value: string;
  label: string;
  /** What to look at on the piece to pick this answer. */
  hint: string;
}

export interface DecodeQuestion {
  field: QuestionField;
  prompt: string;
  options: QuestionOption[];
  why: string;
}

export type AiStatus =
  | { state: 'used'; provider: 'claude' | 'gemini'; model: string; photosSent: number }
  | { state: 'no_key' }
  | { state: 'failed'; provider: 'claude' | 'gemini'; reason: AiFailure; detail: string };

export type AiFailure = 'bad_key' | 'quota' | 'network' | 'blocked' | 'invalid_response' | 'timeout' | 'no_model';

export interface DecodeReport {
  readings: { slot: PhotoSlot; reading: FabricReading }[];
  decoded: Decoded;
  questions: DecodeQuestion[];
  ai: AiStatus;
  /** The AI's latest reading, the starting point when the knitter corrects it. */
  aiDeduction: Deduction | null;
  aiObservation: Observation | null;
  /** The whole picture, kept when only a part of it was analysed. */
  context: Raster | null;
  /** Lowest-trust critical conclusion, 0..1. Answers raise it. */
  overallConfidence: number;
  /** True once stitch and method are known well enough to write a pattern without guessing. */
  readyToCompile: boolean;
  /** 0..1 gauge estimate from a measured width, once the knitter gives one. */
  measuredGauge?: { stsPer10cm: number; rowsPer10cm: number | null; stitchesAcross: number };
}

export const STITCH_VALUES: StitchType[] = [
  'stockinette',
  'reverse_stockinette',
  'garter',
  'rib_1x1',
  'rib_2x2',
  'seed_stitch',
  'moss_stitch',
  'fishermans_rib',
  'brioche',
  'cable',
  'lace',
];

export const GARMENT_VALUES: GarmentType[] = ['beanie', 'scarf', 'cowl', 'pullover', 'cardigan', 'swatch', 'other'];

export const COLORWORK_VALUES: ColorworkType[] = [
  'solid',
  'vertical_stripes',
  'horizontal_stripes',
  'color_block',
  'stranded_motif',
  'variegated',
];

export const YARN_VALUES: YarnWeightCategory[] = [
  'Fingering / 4-ply',
  'Sport',
  'DK / Light Worsted',
  'Worsted / Aran',
  'Chunky / Bulky',
  'Super Bulky',
];

export function constructionFrom(method: WorkMethod, direction: WorkDirection, garment: GarmentType): ConstructionType {
  if (garment === 'scarf' || method === 'flat') return 'bottom_up_flat';
  return direction === 'top_down' ? 'top_down_round' : 'in_the_round';
}
