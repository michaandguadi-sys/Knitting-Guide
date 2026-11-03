
export type GarmentType = 'beanie' | 'scarf' | 'cowl' | 'pullover' | 'cardigan' | 'swatch' | 'other';

export type StitchType =
  | 'rib_1x1'
  | 'rib_2x2'
  | 'stockinette'
  | 'reverse_stockinette'
  | 'garter'
  | 'seed_stitch'
  | 'moss_stitch'
  | 'brioche'
  | 'fishermans_rib'
  | 'cable'
  | 'lace';

export type ConstructionType =
  | 'in_the_round'
  | 'top_down_round'
  | 'bottom_up_flat'
  | 'top_down_raglan'
  | 'drop_shoulder';

export type YarnWeightCategory =
  | 'Fingering / 4-ply'
  | 'Sport'
  | 'DK / Light Worsted'
  | 'Worsted / Aran'
  | 'Chunky / Bulky'
  | 'Super Bulky';

export interface StripeDefinition {
  colorName: string;
  hex: string;
  widthStsEstimate: number;
  /** Height in rows, for horizontal stripes. */
  heightRowsEstimate?: number;
  role: 'base' | 'stripe' | 'accent';
}

export type ColorworkType =
  | 'solid'
  | 'vertical_stripes'
  | 'horizontal_stripes'
  | 'color_block'
  | 'stranded_motif'
  | 'variegated';

/** Who or what made the original, because machine-only fabrics need a hand-knit equivalent. */
export type MadeBy = 'hand' | 'machine' | 'unknown';

export interface KnitBlueprint {
  garmentType: GarmentType;
  title: string;
  description: string;
  construction: ConstructionType;
  mainStitch: StitchType;
  secondaryStitch?: StitchType;
  hasFoldedBrim?: boolean;
  brimHeightRatio?: number;
  crownWedges?: number;
  /** `wedges` keeps visible decrease lines. Otherwise a rib's columns run to the centre. */
  crownStyle?: 'ribs' | 'wedges';
  colorworkType: ColorworkType;
  stripes?: StripeDefinition[];
  features: string[];
  suggestedYarnWeight: YarnWeightCategory;
  suggestedNeedleMm: number;
  difficulty: 'Beginner' | 'Advanced Beginner' | 'Intermediate' | 'Advanced';
  /** 0..1 from the decode, or null for a curated example that was never measured. */
  confidenceScore: number | null;
  madeBy?: MadeBy;
  visionNotes?: string;
  /** Steps written by the AI for what the compiler cannot write. Not stitch-checked. */
  aiSteps?: string[];
  isolatedImageUrl?: string;
  croppedImageUrl?: string;
  backgroundRatio?: number;
}

export interface KnitUserConstraints {
  targetSize: string;
  circumferenceCm: number;
  lengthCm: number;
  brimLengthCm?: number;
  gaugeSts10cm: number;
  gaugeRows10cm: number;
  easeCm: number;
  needleSizeMm: number;
  yarnWeight: YarnWeightCategory;
  language?: 'en' | 'es';
}

export type StitchOp =
  | 'k'
  | 'p'
  | 'k1b'
  | 'ssk'
  | 'k2tog'
  | 'ssp'
  | 'p2tog'
  | 'm1l'
  | 'm1r'
  | 'sl1wyif'
  | 'sm'
  | 'bo';

export type RowSide = 'round' | 'RS' | 'WS';

/** One row as worked, in working order. This is what the simulator checks. */
export interface WorkedRow {
  side: RowSide;
  ops: StitchOp[];
}

export interface PatternRowInstruction {
  stepNumber: number;
  sectionName: string;
  roundOrRow: 'Rnd' | 'Row';
  number: number;
  instruction: string;
  stitchCountAfter: number;
  /** Number of rows or rounds this step takes when you work through it. */
  repeatCount?: number;
  /** Rows in working order, cycled over `repeatCount`. Absent on preparation steps. */
  rows?: WorkedRow[];
  /** Line per cycled row, shown one at a time by the row counter. */
  rowTexts?: string[];
  /** Right-side, wrong-side, or round: which face you are looking at. */
  side?: RowSide;
  /** Preparation and finishing steps are read, not counted. */
  kind?: 'prep' | 'work' | 'finish';
  /** Technique ids this step uses, for the "how do I do this" help. */
  techniques?: string[];
  /** Measure or count to confirm before moving on. */
  checkpoint?: string;
  /** Colour to use on this step, for horizontal stripes. */
  colorNote?: string;
}

export interface PatternSection {
  id: string;
  title: string;
  subtitle: string;
  instructions: PatternRowInstruction[];
  totalRows: number;
  endingStitchCount: number;
}

export interface ChartCell {
  row: number;
  col: number;
  stitchType: 'K' | 'P' | 'k1b' | 'k2tog' | 'ssk' | 'p2tog' | 'ssp' | 'm1l' | 'm1r' | 'sl1' | 'yo' | 'no_stitch';
  colorHex?: string;
  symbol: string;
  name: string;
}

export interface ChartGrid {
  rows: number;
  cols: number;
  cells: ChartCell[][];
  rowLabels: number[];
  legend: { symbol: string; name: string; description: string; color?: string }[];
  /** How to read this chart for the way the piece is worked. */
  readingNote?: string;
}

export interface YarnEstimate {
  totalMeters: number;
  totalGrams: number;
  skeinsApprox: number;
  colorBreakdown?: {
    colorName: string;
    hex: string;
    grams: number;
    percentage: number;
  }[];
}

export interface PatternWarning {
  severity: 'info' | 'caution';
  message: string;
}

export interface CompiledPattern {
  id: string;
  title: string;
  blueprint: KnitBlueprint;
  constraints: KnitUserConstraints;
  finishedDimensions: {
    circumferenceCm: number;
    totalLengthCm: number;
    brimCm?: number;
  };
  calculatedGauge: {
    stsPerCm: number;
    rowsPerCm: number;
    castOnSts: number;
    totalRows: number;
  };
  yarnEstimates: YarnEstimate;
  materials: string[];
  abbreviations: { abbr: string; definition: string }[];
  sections: PatternSection[];
  chartData: ChartGrid;
  allRows: PatternRowInstruction[];
  /** Plain-language description of how the piece is built, read before starting. */
  howItsMade: string[];
  warnings: PatternWarning[];
  compiledAt: string;
}

export interface TrackerPosition {
  stepIndex: number;
  /** Rows finished inside the current step. */
  rowInStep: number;
}

export interface SavedProject {
  id: string;
  name: string;
  recipientName?: string;
  pattern: CompiledPattern;
  currentStepIndex: number;
  completedSteps: Record<number, boolean>;
  tracker?: TrackerPosition;
  notes: string;
  savedAt: string;
  updatedAt: string;
  imageThumbnail?: string;
}
