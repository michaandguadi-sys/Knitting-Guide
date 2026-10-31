export type GarmentType = 'beanie' | 'scarf' | 'cowl' | 'pullover' | 'cardigan';

export type StitchType =
  | 'rib_1x1'
  | 'rib_2x2'
  | 'stockinette'
  | 'reverse_stockinette'
  | 'garter'
  | 'seed_stitch'
  | 'moss_stitch'
  | 'brioche';

export type ConstructionType =
  | 'in_the_round'
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
  role: 'base' | 'stripe' | 'accent';
}

export interface KnitBlueprint {
  garmentType: GarmentType;
  title: string;
  description: string;
  construction: ConstructionType;
  mainStitch: StitchType;
  secondaryStitch?: StitchType;
  hasFoldedBrim?: boolean;
  brimHeightRatio?: number; // e.g., 0.3
  crownWedges?: number; // e.g. 4 or 6 for beanie
  colorworkType: 'solid' | 'vertical_stripes' | 'horizontal_stripes' | 'color_block';
  stripes?: StripeDefinition[];
  features: string[];
  suggestedYarnWeight: YarnWeightCategory;
  suggestedNeedleMm: number;
  difficulty: 'Beginner' | 'Advanced Beginner' | 'Intermediate' | 'Advanced';
  confidenceScore: number;
  visionNotes?: string;
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

export interface PatternRowInstruction {
  stepNumber: number;
  sectionName: string;
  roundOrRow: 'Rnd' | 'Row';
  number: number;
  instruction: string;
  stitchCountAfter: number;
  repeatCount?: number;
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
  stitchType: 'K' | 'P' | 'k2tog' | 'ssk' | 'sl1' | 'yo' | 'no_stitch';
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
  compiledAt: string;
}
