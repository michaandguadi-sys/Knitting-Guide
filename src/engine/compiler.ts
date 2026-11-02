import {
  ChartCell,
  ChartGrid,
  CompiledPattern,
  GarmentType,
  KnitBlueprint,
  KnitUserConstraints,
  PatternRowInstruction,
  PatternSection,
  PatternWarning,
  RowSide,
  StitchOp,
  StitchType,
  StripeDefinition,
  WorkedRow,
  YarnEstimate,
} from '../types/knit';
import { Appearance, STITCHES, StitchSpec, countRow, opFor, rowToText } from './stitches';

/**
 * Standard Yarn weight metrics (meters per 100g and typical weight per cm² in standard gauge)
 */
export const YARN_SPECS: Record<
  string,
  { metersPer100g: number; gramPerCm2: number; defaultNeedle: number }
> = {
  'Fingering / 4-ply': { metersPer100g: 400, gramPerCm2: 0.024, defaultNeedle: 3.0 },
  'Sport': { metersPer100g: 300, gramPerCm2: 0.030, defaultNeedle: 3.5 },
  'DK / Light Worsted': { metersPer100g: 220, gramPerCm2: 0.038, defaultNeedle: 4.0 },
  'Worsted / Aran': { metersPer100g: 190, gramPerCm2: 0.048, defaultNeedle: 4.5 },
  'Chunky / Bulky': { metersPer100g: 130, gramPerCm2: 0.065, defaultNeedle: 6.0 },
  'Super Bulky': { metersPer100g: 80, gramPerCm2: 0.090, defaultNeedle: 9.0 },
};

export const YARN_NAMES_ES: Record<string, string> = {
  'Fingering / 4-ply': 'Hilado Fino (3/8 o Cashmilon fino - agujas 2.5–3 mm)',
  'Sport': 'Hilado Semi-Fino (4/8 - agujas 3.5 mm)',
  'DK / Light Worsted': 'Hilado Mediano (2/7 - agujas 4.0 mm)',
  'Worsted / Aran': 'Hilado Semigrueso (Cashmilon 4/7 o Lana Merino - agujas 4.5–5 mm)',
  'Chunky / Bulky': 'Hilado Grueso / Mecha (3/4 - agujas 6–8 mm)',
  'Super Bulky': 'Hilado Super Grueso / Vellón (agujas 9–12 mm)',
};

/** Stockinette stitches per 10 cm for each weight, for spotting implausible gauge entries. */
const TYPICAL_STS_10CM: Record<string, [number, number]> = {
  'Fingering / 4-ply': [27, 36],
  'Sport': [23, 28],
  'DK / Light Worsted': [20, 24],
  'Worsted / Aran': [16, 21],
  'Chunky / Bulky': [11, 16],
  'Super Bulky': [6, 11],
};

/**
 * Typical measurements by garment. A scarf must not inherit a hat's 56 cm "circumference".
 */
export function sizePresetsFor(garment: GarmentType, lang: 'en' | 'es' = 'es') {
  const es = lang === 'es';
  switch (garment) {
    case 'scarf':
      return [
        { id: 'narrow', label: es ? 'Angosta' : 'Narrow', circ: 18, len: 150 },
        { id: 'regular', label: es ? 'Clásica' : 'Regular', circ: 24, len: 170 },
        { id: 'wide', label: es ? 'Ancha' : 'Wide', circ: 35, len: 190 },
      ];
    case 'cowl':
      return [
        { id: 'snug', label: es ? 'Ajustado' : 'Snug', circ: 55, len: 22 },
        { id: 'regular', label: es ? 'Clásico' : 'Regular', circ: 65, len: 28 },
        { id: 'loop', label: es ? 'Doble vuelta' : 'Double loop', circ: 120, len: 28 },
      ];
    default:
      return [
        { id: 'baby', label: es ? 'Bebé' : 'Baby', circ: 42, len: 16, brim: 4 },
        { id: 'child', label: es ? 'Infantil' : 'Child', circ: 50, len: 20, brim: 6 },
        { id: 'adult_m', label: es ? 'Adulto' : 'Adult', circ: 56, len: 22, brim: 7.5 },
      ];
  }
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

export function lcm(a: number, b: number): number {
  return Math.abs(a * b) / gcd(a, b);
}

/**
 * Calculate the nearest multiple of `factor` to `val`
 */
export function roundToMultiple(val: number, factor: number): number {
  const rounded = Math.round(val / factor) * factor;
  return Math.max(factor, rounded);
}

/**
 * Estimate yarn requirements based on garment geometry and gauge density
 */
export function calculateYarnEstimate(
  blueprint: KnitBlueprint,
  constraints: KnitUserConstraints,
  finishedAreaCm2: number
): YarnEstimate {
  const spec = YARN_SPECS[constraints.yarnWeight] || YARN_SPECS['Worsted / Aran'];
  const factor = STITCHES[blueprint.mainStitch]?.yarnFactor ?? 1;
  // Add 12% safety margin for swatching, tension variance, and finishing tails
  const baseGrams = finishedAreaCm2 * spec.gramPerCm2 * factor * 1.12;
  const totalGrams = Math.round(baseGrams);
  const totalMeters = Math.round((totalGrams / 100) * spec.metersPer100g);
  const skeinsApprox = Math.ceil(totalGrams / 100);

  let colorBreakdown: YarnEstimate['colorBreakdown'] = undefined;
  if (blueprint.stripes && blueprint.stripes.length > 0) {
    const totalWeight = blueprint.stripes.reduce((acc, s) => acc + (s.widthStsEstimate || 1), 0);
    colorBreakdown = blueprint.stripes.map((stripe) => {
      const percentage = Math.round(((stripe.widthStsEstimate || 1) / totalWeight) * 100);
      const grams = Math.round((totalGrams * percentage) / 100);
      return {
        colorName: stripe.colorName,
        hex: stripe.hex,
        grams,
        percentage,
      };
    });
  }

  return {
    totalMeters,
    totalGrams,
    skeinsApprox,
    colorBreakdown,
  };
}

/** The glossary lists what this pattern actually uses and nothing else. */
export function getStandardAbbreviations(
  blueprint: KnitBlueprint,
  lang: 'en' | 'es' = 'es',
  used?: Set<StitchOp>,
  inRound = true
): { abbr: string; definition: string }[] {
  const has = (op: StitchOp) => !used || used.has(op);
  const es = lang === 'es';
  const list: { abbr: string; definition: string }[] = es
    ? [
        { abbr: 'M', definition: 'Montar puntos en la aguja de forma elástica' },
        { abbr: 'D', definition: 'Punto del derecho' },
        { abbr: 'R', definition: 'Punto del revés' },
        { abbr: 'p.', definition: 'Punto(s)' },
        { abbr: 'LD / LR', definition: 'Lado del derecho / Lado del revés del tejido' },
        { abbr: 'Cerrar', definition: 'Cerrar puntos flojo como se presentan' },
      ]
    : [
        { abbr: 'CO', definition: 'Cast on stitches using preferred stretchy method' },
        { abbr: 'BO', definition: 'Bind off stitches loosely in pattern' },
        { abbr: 'K', definition: 'Knit stitch' },
        { abbr: 'P', definition: 'Purl stitch' },
        { abbr: 'st(s)', definition: 'Stitch(es)' },
        { abbr: 'RS / WS', definition: 'Right Side / Wrong Side of fabric' },
      ];
  if (inRound) {
    list.push(
      es
        ? { abbr: 'MIV', definition: 'Marcador de inicio de vuelta' }
        : { abbr: 'BOR', definition: 'Beginning of round marker' },
      es
        ? { abbr: 'Vta(s)', definition: 'Vuelta(s) tejidas en redondo' }
        : { abbr: 'Rnd(s)', definition: 'Round(s) in circular knitting' }
    );
  }
  if (!used || used.has('sm')) {
    list.push(
      es
        ? { abbr: 'SM', definition: 'Deslizar marcador de una aguja a la otra' }
        : { abbr: 'sm', definition: 'Slip stitch marker from left to right needle' }
    );
  }
  const entry = (op: StitchOp, esItem: [string, string], enItem: [string, string]) => {
    if (!has(op)) return;
    const [abbr, definition] = es ? esItem : enItem;
    list.push({ abbr, definition });
  };
  entry('k2tog', ['2pjD', '2 puntos juntos al derecho (disminución hacia la derecha / k2tog)'], ['k2tog', 'Knit 2 stitches together (right-leaning single decrease)']);
  entry('ssk', ['SS', 'Surjete simple: deslizar 2 puntos de a uno y tejerlos juntos por detrás (disminución hacia la izquierda / ssk)'], ['ssk', 'Slip, slip, knit slipped stitches together through back loop (left-leaning single decrease)']);
  entry('p2tog', ['2pjR', '2 puntos juntos al revés'], ['p2tog', 'Purl 2 stitches together']);
  entry('ssp', ['SSR', 'Deslizar 2 puntos y tejerlos juntos al revés por detrás'], ['ssp', 'Slip, slip, purl slipped stitches together through back loop']);
  entry('m1l', ['A1I', 'Aumento hacia la izquierda levantando la hebra entre puntos'], ['M1L', 'Make one, left-leaning increase']);
  entry('m1r', ['A1D', 'Aumento hacia la derecha levantando la hebra entre puntos'], ['M1R', 'Make one, right-leaning increase']);
  entry('k1b', ['D1A', 'Tejer al derecho en el punto de la vuelta de abajo'], ['K1b', 'Knit into the stitch one row below']);
  entry('sl1wyif', ['Desl1', 'Deslizar 1 punto como al revés con la hebra adelante'], ['Sl1 wyif', 'Slip 1 stitch purlwise with yarn in front']);
  void blueprint;
  return list;
}

export function needleToUs(mm: number): string {
  const map: Record<number, string> = {
    2.25: '1',
    2.75: '2',
    3.25: '3',
    3.5: '4',
    3.75: '5',
    4.0: '6',
    4.5: '7',
    5.0: '8',
    5.5: '9',
    6.0: '10',
    6.5: '10.5',
    8.0: '11',
    9.0: '13',
    10.0: '15',
  };
  return map[mm] || `${mm}mm`;
}

type Tr = (en: string, es: string) => string;

/** A stitch name as it reads inside a sentence: "en elástico 1x1", "in stockinette". */
function nameOf(spec: StitchSpec, lang: 'en' | 'es'): string {
  const name = lang === 'es' ? spec.name.es : spec.name.en;
  return name.charAt(0).toLowerCase() + name.slice(1);
}

const capitalized = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** One row of the chart: what happens to each surviving column, in fabric order. */
interface ChartRow {
  cells: { op: StitchOp; look?: Appearance; col: number | null }[];
}

/** Accumulates steps while tracking the live stitch count, so text and maths cannot disagree. */
class PatternBuilder {
  sections: PatternSection[] = [];
  allRows: PatternRowInstruction[] = [];
  used = new Set<StitchOp>();
  sts = 0;
  private step = 1;
  private current: PatternSection | null = null;

  constructor(private lang: 'en' | 'es', readonly flat: boolean) {}

  section(id: string, title: string, subtitle: string): void {
    this.current = { id, title, subtitle, instructions: [], totalRows: 0, endingStitchCount: this.sts };
    this.sections.push(this.current);
  }

  private add(inst: Omit<PatternRowInstruction, 'stepNumber' | 'sectionName'>): PatternRowInstruction {
    const section = this.current!;
    const full: PatternRowInstruction = {
      ...inst,
      stepNumber: this.step++,
      sectionName: section.title.replace(/^\d+\.\s*/, ''),
    };
    section.instructions.push(full);
    section.endingStitchCount = inst.stitchCountAfter;
    this.allRows.push(full);
    return full;
  }

  prep(text: string, opts: Partial<PatternRowInstruction> = {}): void {
    this.add({
      roundOrRow: this.flat ? 'Row' : 'Rnd',
      number: 0,
      instruction: text,
      stitchCountAfter: this.sts,
      kind: 'prep',
      ...opts,
    });
  }

  castOn(count: number, text: string, techniques: string[], checkpoint: string): void {
    this.sts = count;
    this.prep(text, { stitchCountAfter: count, techniques, checkpoint });
  }

  private label(number: number, side: RowSide): string {
    const es = this.lang === 'es';
    if (side === 'round') return es ? `Vta ${number}` : `Rnd ${number}`;
    if (es) return `Hilera ${number} (${side === 'RS' ? 'LD' : 'LR'})`;
    return `Row ${number} (${side})`;
  }

  /**
   * Adds `count` rows cycling through `rows`, and checks every row against the live stitch count.
   * `startNumber` is the row number within the section, shown to the knitter.
   */
  work(
    rows: WorkedRow[],
    count: number,
    startNumber: number,
    opts: { note?: string; techniques?: string[]; checkpoint?: string; colorNote?: string } = {}
  ): void {
    const es = this.lang === 'es';
    for (const row of rows) {
      for (const op of row.ops) this.used.add(op);
    }
    const ending = (() => {
      let live = this.sts;
      for (let i = 0; i < count; i++) {
        const { consumed, produced } = countRow(rows[i % rows.length].ops);
        if (consumed !== live) {
          throw new Error(`Pattern error: row needs ${consumed} sts but ${live} are on the needle`);
        }
        live = produced;
      }
      return live;
    })();

    const rowTexts = rows.map((r) => rowToText(r.ops, this.lang));
    const unit = this.flat ? (es ? 'Hileras' : 'Rows') : es ? 'Vtas' : 'Rnds';
    const last = startNumber + count - 1;
    let text: string;
    if (rows.length === 1) {
      const head = count === 1 ? this.label(startNumber, rows[0].side) : `${unit} ${startNumber}–${last}`;
      text = `${head}: ${rowTexts[0]}.`;
    } else {
      const lines = rows.map((r, i) => `${this.label(startNumber + i, r.side)}: ${rowTexts[i]}.`);
      if (count <= rows.length) {
        text = lines.slice(0, count).join(' ');
      } else {
        const again = es
          ? `Repetí estas ${rows.length} hasta llegar a la ${this.flat ? 'hilera' : 'vuelta'} ${last} (${count} en total).`
          : `Repeat these ${rows.length} through ${this.flat ? 'row' : 'round'} ${last} (${count} in total).`;
        text = `${lines.join(' ')} ${again}`;
      }
    }
    if (opts.note) text = `${text} ${opts.note}`;
    const sameSide = rows.every((r) => r.side === rows[0].side);
    this.add({
      roundOrRow: this.flat ? 'Row' : 'Rnd',
      number: startNumber,
      instruction: text,
      stitchCountAfter: ending,
      repeatCount: count,
      rows,
      rowTexts,
      side: sameSide ? rows[0].side : undefined,
      kind: 'work',
      techniques: opts.techniques,
      checkpoint: opts.checkpoint,
      colorNote: opts.colorNote,
    });
    this.current!.totalRows += count;
    this.sts = ending;
  }

  finish(text: string, stitchCountAfter: number, techniques?: string[], checkpoint?: string): void {
    this.sts = stitchCountAfter;
    this.prep(text, { stitchCountAfter, techniques, checkpoint, kind: 'finish' });
  }
}

/** The side you look at on a given row. Rounds never flip, flat rows alternate. */
function sideOf(flat: boolean, spec: StitchSpec, row: number): RowSide {
  if (!flat) return 'round';
  const firstIsWS = spec.flatStartsOnWS === true;
  return (row % 2 === 0) === firstIsWS ? 'WS' : 'RS';
}

function rowFor(columns: number[], row: number, spec: StitchSpec, side: RowSide, selvedge: boolean): WorkedRow {
  const order = side === 'WS' ? [...columns].reverse() : columns;
  const ops = order.map((col) => opFor(spec.appearance(col, row), side));
  if (!selvedge) return { side, ops };
  // Edge stitches stay stockinette, which gives a clean line for the mattress seam.
  return { side, ops: [side === 'WS' ? 'p' : 'k', ...ops, side === 'WS' ? 'p' : 'k'] };
}

/** Rows needed before the fabric repeats, doubled when worked flat so RS and WS both cycle. */
function cycleLength(spec: StitchSpec, flat: boolean): number {
  return flat ? lcm(spec.repeatRows, 2) : spec.repeatRows;
}

function cycleRows(columns: number[], startRow: number, spec: StitchSpec, flat: boolean, selvedge: boolean): WorkedRow[] {
  const rows: WorkedRow[] = [];
  for (let i = 0; i < cycleLength(spec, flat); i++) {
    const row = startRow + i;
    rows.push(rowFor(columns, row, spec, sideOf(flat, spec, row), selvedge));
  }
  return rows;
}

function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i);
}

/** A compilable stitch to actually write, plus why it differs from what was decoded, if it does. */
function resolveStitch(stitch: StitchType): { stitch: StitchType; substituted: boolean } {
  return STITCHES[stitch]?.compilable ? { stitch, substituted: false } : { stitch: 'stockinette', substituted: true };
}

function baseWarnings(blueprint: KnitBlueprint, constraints: KnitUserConstraints, t: Tr): PatternWarning[] {
  const warnings: PatternWarning[] = [];
  const stitch = blueprint.mainStitch;
  if (!STITCHES[stitch]?.compilable) {
    warnings.push({
      severity: 'caution',
      message: t(
        `This piece uses ${STITCHES[stitch]?.name.en ?? stitch}, which this app cannot write out row by row yet. The steps below give you the right size and shape in plain stockinette. Add the ${STITCHES[stitch]?.name.en.toLowerCase()} from a chart, and swatch it first because it changes the gauge.`,
        `Esta prenda usa ${STITCHES[stitch]?.name.es ?? stitch}, y la app todavía no puede escribirlo vuelta a vuelta. Los pasos dan el tamaño y la forma correctos en jersey liso. Agregá ${STITCHES[stitch]?.name.es.toLowerCase()} desde un gráfico y hacé la muestra antes, porque cambia la tensión.`
      ),
    });
  }
  if (stitch === 'brioche') {
    warnings.push({
      severity: 'info',
      message: t(
        "Written as fisherman's rib, which looks nearly the same as brioche and is much easier to fix.",
        'Se escribe como elástico inglés, que se ve casi igual que el punto inglés y es mucho más fácil de corregir.'
      ),
    });
  }
  if (blueprint.madeBy === 'machine') {
    warnings.push({
      severity: 'caution',
      message: t(
        'The original looks machine-knit. Machines use fine yarn and stitches hands cannot match, so this is the closest hand-knit equivalent, not an exact copy.',
        'La prenda original parece tejida a máquina. Las máquinas usan hilos finos y puntos que no se pueden igualar a mano, así que esto es lo más parecido a mano, no una copia exacta.'
      ),
    });
  }
  const typical = TYPICAL_STS_10CM[constraints.yarnWeight];
  if (typical && (constraints.gaugeSts10cm < typical[0] * 0.8 || constraints.gaugeSts10cm > typical[1] * 1.25)) {
    warnings.push({
      severity: 'caution',
      message: t(
        `${constraints.gaugeSts10cm} stitches per 10 cm is unusual for ${constraints.yarnWeight} yarn, which normally gives ${typical[0]}–${typical[1]}. Check that the swatch number and yarn are right.`,
        `${constraints.gaugeSts10cm} puntos en 10 cm es raro para este hilado, que suele dar ${typical[0]}–${typical[1]}. Revisá la muestra y el hilado.`
      ),
    });
  }
  if (blueprint.colorworkType === 'stranded_motif') {
    warnings.push({
      severity: 'caution',
      message: t(
        'The motif is not written out here. Draw it on squared paper first, one square per stitch, reading from the bottom right. Stranded fabric pulls in, so swatch with both colours.',
        'El motivo no está escrito acá. Dibujalo primero en papel cuadriculado, un cuadrito por punto, leyendo desde abajo a la derecha. El tejido con dos colores se cierra, así que hacé la muestra con ambos.'
      ),
    });
  }
  return warnings;
}

function stripePlanText(stripes: StripeDefinition[], castOn: number, t: Tr): { text: string; order: StripeDefinition[] } {
  const unit = stripes.reduce((acc, s) => acc + Math.max(1, s.widthStsEstimate), 0);
  const repeats = Math.max(1, Math.round(castOn / unit));
  const leftover = castOn - repeats * unit;
  const parts = stripes.map((s) => `${Math.max(1, s.widthStsEstimate)} ${s.colorName}`).join(', ');
  const tail =
    leftover === 0
      ? ''
      : leftover > 0
        ? t(
            ` Work ${leftover} extra stitches in ${stripes[0].colorName} at the end of the round.`,
            ` Tejé ${leftover} puntos más en ${stripes[0].colorName} al final de la vuelta.`
          )
        : t(
            ` Leave ${-leftover} stitches out of the last ${stripes[0].colorName} stripe so the round closes evenly.`,
            ` Sacá ${-leftover} puntos de la última raya de ${stripes[0].colorName} para que la vuelta cierre parejo.`
          );
  return {
    text: t(
      `Colour plan for every round, starting at the marker: ${parts}. Repeat this ${repeats} times around.${tail} Keep working the stitch pattern as usual, and only change which yarn you pick up. These widths are estimated from the photo, so adjust them by eye.`,
      `Plan de color para cada vuelta, desde el marcador: ${parts}. Repetilo ${repeats} veces alrededor.${tail} Seguí tejiendo el punto como siempre y solo cambiá la hebra que usás. Los anchos son una estimación de la foto, así que ajustalos a ojo.`
    ),
    order: stripes,
  };
}

const CELL_INFO: Record<StitchOp, { symbol: string; type: ChartCell['stitchType']; en: string; es: string; desc: { en: string; es: string } }> = {
  k: { symbol: '|', type: 'K', en: 'Knit', es: 'Derecho', desc: { en: 'Knit on the right side', es: 'Derecho del lado del derecho' } },
  p: { symbol: '–', type: 'P', en: 'Purl', es: 'Revés', desc: { en: 'Purl on the right side', es: 'Revés del lado del derecho' } },
  k1b: { symbol: 'U', type: 'k1b', en: 'K1b', es: 'D1A', desc: { en: 'Knit in the stitch below', es: 'Derecho en el punto de abajo' } },
  ssk: { symbol: '\\', type: 'ssk', en: 'ssk', es: 'SS', desc: { en: 'Left-leaning decrease', es: 'Disminución hacia la izquierda' } },
  k2tog: { symbol: '/', type: 'k2tog', en: 'k2tog', es: '2pjD', desc: { en: 'Right-leaning decrease', es: 'Disminución hacia la derecha' } },
  ssp: { symbol: '\\', type: 'ssp', en: 'ssp', es: 'SSR', desc: { en: 'Left-leaning purl decrease', es: 'Disminución al revés hacia la izquierda' } },
  p2tog: { symbol: '/', type: 'p2tog', en: 'p2tog', es: '2pjR', desc: { en: 'Right-leaning purl decrease', es: 'Disminución al revés hacia la derecha' } },
  m1l: { symbol: 'Y', type: 'm1l', en: 'M1L', es: 'A1I', desc: { en: 'Left-leaning increase', es: 'Aumento hacia la izquierda' } },
  m1r: { symbol: 'y', type: 'm1r', en: 'M1R', es: 'A1D', desc: { en: 'Right-leaning increase', es: 'Aumento hacia la derecha' } },
  sl1wyif: { symbol: 'V', type: 'sl1', en: 'Slip', es: 'Deslizado', desc: { en: 'Slip purlwise, yarn in front', es: 'Deslizar como al revés, hebra adelante' } },
  sm: { symbol: ' ', type: 'no_stitch', en: '', es: '', desc: { en: '', es: '' } },
  bo: { symbol: ' ', type: 'no_stitch', en: '', es: '', desc: { en: '', es: '' } },
};

/** Draws rows from the same stitch data as the text, centred so shaping looks like the piece. */
function buildChart(rowsBottomUp: ChartRow[], lang: 'en' | 'es', readingNote: string, colorOfCol?: (col: number) => string | undefined): ChartGrid {
  const es = lang === 'es';
  const cols = Math.max(1, ...rowsBottomUp.map((r) => r.cells.length));
  const total = rowsBottomUp.length;
  const seen = new Set<StitchOp>();
  const cells: ChartCell[][] = [];
  const rowLabels: number[] = [];
  for (let r = total - 1; r >= 0; r--) {
    const data = rowsBottomUp[r].cells;
    const rowNumber = r + 1;
    rowLabels.push(rowNumber);
    const pad = Math.floor((cols - data.length) / 2);
    const line: ChartCell[] = [];
    for (let c = 0; c < cols; c++) {
      const entry = data[cols - 1 - c - pad];
      const colNumber = cols - c;
      if (!entry || c < pad || c >= pad + data.length) {
        line.push({ row: rowNumber, col: colNumber, stitchType: 'no_stitch', symbol: ' ', name: es ? 'Sin punto' : 'No stitch' });
        continue;
      }
      const info = CELL_INFO[entry.op];
      seen.add(entry.op);
      line.push({
        row: rowNumber,
        col: colNumber,
        stitchType: info.type,
        symbol: info.symbol,
        name: es ? info.es : info.en,
        colorHex: entry.col !== null && colorOfCol ? colorOfCol(entry.col) : undefined,
      });
    }
    cells.push(line);
  }
  return {
    rows: total,
    cols,
    cells,
    rowLabels,
    legend: [...seen].map((op) => ({
      symbol: CELL_INFO[op].symbol,
      name: es ? CELL_INFO[op].es : CELL_INFO[op].en,
      description: es ? CELL_INFO[op].desc.es : CELL_INFO[op].desc.en,
    })),
    readingNote,
  };
}

/** Chart cells show the fabric from the right side, so wrong-side ops are flipped back. */
function chartRowFromColumns(columns: number[], row: number, spec: StitchSpec): ChartRow {
  return {
    cells: columns.map((col) => {
      const look = spec.appearance(col, row);
      return { op: look === 'K1B' ? ('k1b' as StitchOp) : look === 'K' ? ('k' as StitchOp) : ('p' as StitchOp), col };
    }),
  };
}

function chartNote(flat: boolean, t: Tr): string {
  return flat
    ? t(
        'Read from the bottom. Right-side rows go right to left, wrong-side rows left to right, and on wrong-side rows do the opposite stitch: a knit square is purled.',
        'Se lee desde abajo. Las hileras del derecho van de derecha a izquierda, las del revés de izquierda a derecha, y en las del revés hacé el punto contrario: un cuadro al derecho se teje al revés.'
      )
    : t(
        'Read from the bottom. Every round goes right to left, because in the round you always look at the right side. Blank squares are not stitches.',
        'Se lee desde abajo. Todas las vueltas van de derecha a izquierda, porque en redondo siempre mirás el derecho. Los cuadros vacíos no son puntos.'
      );
}

function gaugeStep(b: PatternBuilder, spec: StitchSpec, constraints: KnitUserConstraints, lang: 'en' | 'es', t: Tr, flat: boolean): void {
  const swatchSts = Math.max(
    roundToMultiple((constraints.gaugeSts10cm / 10) * 15, spec.repeatSts),
    spec.repeatSts * 4
  );
  const note = lang === 'es' ? spec.gaugeNote.es : spec.gaugeNote.en;
  const stitchName = nameOf(spec, lang);
  b.prep(
    t(
      `Knit a test square before anything else. Cast on ${swatchSts} sts on ${constraints.needleSizeMm} mm needles and work about 15 cm in ${stitchName}${flat ? '' : ', ideally in the round, because many knitters purl tighter or looser than they knit'}. Wash or steam it and let it dry flat. You need ${constraints.gaugeSts10cm} sts and ${constraints.gaugeRows10cm} rows in 10 cm. Too many stitches: go up a needle size. Too few: go down. ${note} Type your real numbers into the gauge box and every count here recalculates.`,
      `Tejé una muestra antes que nada. Montá ${swatchSts} puntos en agujas de ${constraints.needleSizeMm} mm y tejé unos 15 cm en ${stitchName}${flat ? '' : ', mejor en redondo, porque muchas tejedoras cambian la tensión al tejer al revés'}. Lavala o vaporizala y dejala secar plana. Necesitás ${constraints.gaugeSts10cm} puntos y ${constraints.gaugeRows10cm} vueltas en 10 cm. Si te dan más puntos, usá aguja más gruesa. Si te dan menos, más fina. ${note} Cargá tus números reales en el cuadro de tensión y se recalcula todo.`
    ),
    { techniques: ['gauge_swatch'] }
  );
}

function resultFrom(
  b: PatternBuilder,
  blueprint: KnitBlueprint,
  constraints: KnitUserConstraints,
  parts: {
    title: string;
    finished: CompiledPattern['finishedDimensions'];
    castOn: number;
    area: number;
    materials: string[];
    chart: ChartGrid;
    howItsMade: string[];
    warnings: PatternWarning[];
    inRound: boolean;
  }
): CompiledPattern {
  const lang = constraints.language || 'es';
  const stsPerCm = constraints.gaugeSts10cm / 10;
  const rowsPerCm = constraints.gaugeRows10cm / 10;
  const totalRows = b.allRows.reduce((acc, r) => acc + (r.repeatCount || 0), 0);
  return {
    id: `pattern-${Date.now()}`,
    title: parts.title,
    blueprint,
    constraints,
    finishedDimensions: parts.finished,
    calculatedGauge: {
      stsPerCm: Math.round(stsPerCm * 100) / 100,
      rowsPerCm: Math.round(rowsPerCm * 100) / 100,
      castOnSts: parts.castOn,
      totalRows,
    },
    yarnEstimates: calculateYarnEstimate(blueprint, constraints, parts.area),
    materials: parts.materials,
    abbreviations: getStandardAbbreviations(blueprint, lang, b.used, parts.inRound),
    sections: b.sections,
    chartData: parts.chart,
    allRows: b.allRows,
    howItsMade: parts.howItsMade,
    warnings: parts.warnings,
    compiledAt: new Date().toISOString(),
  };
}

/**
 * Hat compiler: worked bottom-up or top-down, in the round or flat with a seam.
 * Every row is generated stitch by stitch from fabric columns, so a rib stays lined up through
 * the crown and a wrong-side row is the genuine mirror image of what the right side shows.
 */
export function compileBeaniePattern(blueprint: KnitBlueprint, constraints: KnitUserConstraints): CompiledPattern {
  const lang = constraints.language || 'es';
  const es = lang === 'es';
  const t: Tr = (en, esText) => (es ? esText : en);
  const { gaugeSts10cm, gaugeRows10cm, circumferenceCm, lengthCm, easeCm, needleSizeMm } = constraints;
  const stsPerCm = gaugeSts10cm / 10;
  const rowsPerCm = gaugeRows10cm / 10;

  const flat = blueprint.construction === 'bottom_up_flat';
  const topDown = blueprint.construction === 'top_down_round';
  const { stitch: mainStitch } = resolveStitch(blueprint.mainStitch);
  const spec = STITCHES[mainStitch];
  const warnings = baseWarnings(blueprint, constraints, t);

  const hasFolded = blueprint.hasFoldedBrim ?? false;
  let brimStitch: StitchType = blueprint.secondaryStitch && STITCHES[blueprint.secondaryStitch]?.compilable
    ? blueprint.secondaryStitch
    : spec.curls
      ? 'rib_1x1'
      : mainStitch;
  // A folded brim shows its inside, so a one-sided stitch would show its back.
  if (hasFolded && !STITCHES[brimStitch].reversible) {
    warnings.push({
      severity: 'info',
      message: t(
        `A folded brim shows the back of the fabric, so the brim is written in 1x1 rib instead of ${STITCHES[brimStitch].name.en}.`,
        `Un puño doblado muestra el revés del tejido, así que el puño se escribe en elástico 1x1 en lugar de ${STITCHES[brimStitch].name.es}.`
      ),
    });
    brimStitch = 'rib_1x1';
  }
  const brimSpec = STITCHES[brimStitch];

  const wedges = blueprint.crownWedges && blueprint.crownWedges >= 3 ? Math.round(blueprint.crownWedges) : 4;
  const targetCircumference = Math.max(30, circumferenceCm + easeCm);
  const divisor = lcm(lcm(spec.repeatSts, brimSpec.repeatSts), wedges * 2);
  const patternSts = roundToMultiple(targetCircumference * stsPerCm, divisor);
  const seamSts = flat ? 2 : 0;
  const castOnSts = patternSts + seamSts;
  const finishedCircumference = Math.round((patternSts / stsPerCm) * 10) / 10;

  const targetBrimHeight = constraints.brimLengthCm ?? Math.round(lengthCm * 0.33 * 10) / 10;
  const knitBrimHeight = hasFolded ? targetBrimHeight * 2 : targetBrimHeight;
  const brimRows = Math.max(4, Math.round(knitBrimHeight * rowsPerCm));

  const wedgeWidth = patternSts / wedges;
  const shapeSteps = wedgeWidth / 2 - 1; // decrease rounds, down to 2 sts per wedge
  const crownRowsCount = shapeSteps * 2;
  const crownHeightCm = crownRowsCount / rowsPerCm;
  const remainingCm = lengthCm - targetBrimHeight - crownHeightCm;
  const bodyRows = Math.max(flat ? 2 : 1, Math.round(remainingCm * rowsPerCm));
  if (remainingCm < 1.5) {
    warnings.push({
      severity: 'caution',
      message: t(
        `The crown shaping takes ${crownHeightCm.toFixed(1)} cm, which leaves almost no straight section at this length. The hat will come out about ${(targetBrimHeight + crownHeightCm + bodyRows / rowsPerCm).toFixed(0)} cm tall. Use ${wedges === 4 ? '6 wedges for a flatter crown, or ' : ''}a longer length.`,
        `Las disminuciones ocupan ${crownHeightCm.toFixed(1)} cm y casi no queda parte recta con este largo. El gorro va a medir unos ${(targetBrimHeight + crownHeightCm + bodyRows / rowsPerCm).toFixed(0)} cm. Usá ${wedges === 4 ? '6 gajos para una coronilla más plana, o ' : ''}más largo.`
      ),
    });
  }

  const columns = range(patternSts);
  const wedgeCols = (stage: number) =>
    range(wedges).map((w) => columns.slice(w * wedgeWidth + stage, (w + 1) * wedgeWidth - stage));

  const b = new PatternBuilder(lang, flat);
  const stitchName = nameOf(spec, lang);
  const brimName = nameOf(brimSpec, lang);

  b.section('before', t('Before you start', 'Antes de empezar'), t('Swatch and set-up', 'Muestra y preparación'));
  gaugeStep(b, spec, constraints, lang, t, flat);

  const stripes = blueprint.stripes && blueprint.stripes.length > 1 ? blueprint.stripes : null;
  if (stripes && blueprint.colorworkType === 'vertical_stripes') {
    const plan = stripePlanText(stripes, patternSts, t);
    b.prep(plan.text, { techniques: ['stranded_floats'] });
    if (hasFolded) {
      warnings.push({
        severity: 'caution',
        message: t(
          'Vertical stripes leave carried yarn on the inside, and a folded brim turns the inside out. Work the brim in one colour or in a separate piece, or keep stripes narrow and the carried yarn very loose.',
          'Las rayas verticales dejan hebras por dentro, y el puño doblado da vuelta justo esa cara. Tejé el puño en un solo color o por separado, o mantené rayas angostas y las hebras bien flojas.'
        ),
      });
    }
  }
  if (stripes && blueprint.colorworkType === 'horizontal_stripes') {
    const plan = stripes
      .map((s) => `${Math.max(1, s.heightRowsEstimate ?? s.widthStsEstimate)} ${t(flat ? 'rows' : 'rnds', flat ? 'hileras' : 'vueltas')} ${s.colorName}`)
      .join(', ');
    b.prep(
      t(
        `Colour plan: ${plan}. Repeat from the start of the hat to the top. Carry the unused colours up the inside at the start of the round rather than cutting them.`,
        `Plan de color: ${plan}. Repetilo desde el inicio del gorro hasta la punta. Llevá los colores que no usás por dentro al empezar la vuelta, sin cortarlos.`
      ),
      { techniques: flat ? [] : ['jogless_stripes'] }
    );
  }

  const howItsMade: string[] = [];
  howItsMade.push(
    flat
      ? t(
          'Worked flat, back and forth, then sewn up the back. You turn at the end of each row, so you see the right side and the wrong side alternately.',
          'Se teje plano, de ida y vuelta, y al final se cose por atrás. Girás al final de cada hilera, así que ves alternadamente el derecho y el revés.'
        )
      : t(
          'Worked in the round as a seamless tube. You never turn the work, so you are always looking at the right side.',
          'Se teje en redondo, como un tubo sin costura. Nunca girás la labor, así que siempre mirás el lado del derecho.'
        )
  );
  howItsMade.push(
    topDown
      ? t(
          'Starts with a few stitches at the top of the head and grows outward. The brim is the last thing you knit, so you can try it on and stop when it is long enough.',
          'Empieza con pocos puntos en la punta y va creciendo. El puño es lo último que tejés, así que podés probártelo y parar cuando tenga el largo justo.'
        )
      : t(
          'Starts at the brim and works up toward the top of the head. The crown narrows in wedges and closes like a drawstring.',
          'Empieza en el puño y sube hacia la coronilla. La punta se angosta en gajos y se cierra como un cordón.'
        )
  );
  howItsMade.push(
    t(
      `${brimStitch === mainStitch ? `${capitalized(stitchName)} all over` : `${capitalized(brimName)} on the brim, ${stitchName} on the body`}. Shaping uses ${wedges} wedges of ${wedgeWidth} stitches each.`,
      `${brimStitch === mainStitch ? `${capitalized(stitchName)} en toda la prenda` : `${capitalized(brimName)} en el puño, ${stitchName} en el cuerpo`}. La forma se da con ${wedges} gajos de ${wedgeWidth} puntos cada uno.`
    )
  );
  if (hasFolded) {
    howItsMade.push(
      t(
        `The brim is knitted twice as tall as it looks (${knitBrimHeight.toFixed(1)} cm) and then folded up to ${targetBrimHeight.toFixed(1)} cm.`,
        `El puño se teje el doble de alto de lo que se ve (${knitBrimHeight.toFixed(1)} cm) y luego se dobla a ${targetBrimHeight.toFixed(1)} cm.`
      )
    );
  }

  const needleWord = flat
    ? t(`${needleSizeMm} mm straight needles`, `agujas rectas de ${needleSizeMm} mm`)
    : t(`${needleSizeMm}mm (US ${needleToUs(needleSizeMm)}) 40cm circular needle`, `agujas circulares de ${needleSizeMm} mm (cable de 40 cm)`);

  const chartRows: ChartRow[] = [];
  let row = 0;
  const unitWord = t(flat ? 'rows' : 'rounds', flat ? 'hileras' : 'vueltas');

  const workBrim = (startNote?: string) => {
    const brimRowsCycle = cycleRows(columns, flat && brimSpec.flatStartsOnWS ? 0 : 0, brimSpec, flat, flat);
    // In the round, `flat`-only selvedges are skipped by the last argument above.
    b.work(brimRowsCycle, brimRows, 1, {
      note: startNote,
      checkpoint: t(
        `The brim should measure about ${knitBrimHeight.toFixed(1)} cm${hasFolded ? ` before folding, ${targetBrimHeight.toFixed(1)} cm when folded` : ''}. It looks narrower than ${finishedCircumference} cm because rib pulls in: that is correct.`,
        `El puño debe medir unos ${knitBrimHeight.toFixed(1)} cm${hasFolded ? ` antes de doblar, ${targetBrimHeight.toFixed(1)} cm doblado` : ''}. Se ve más angosto que ${finishedCircumference} cm porque el elástico se cierra: está bien.`
      ),
    });
    row = 0;
  };

  const workBody = () => {
    const start = flat && brimRows % 2 === 1 ? 1 : 0; // keep RS and WS alternating across the change
    row = start;
    b.work(cycleRows(columns, row, spec, flat, flat), bodyRows, 1, {
      checkpoint: topDown
        ? t(
            `The hat should measure about ${(crownHeightCm + bodyRows / rowsPerCm).toFixed(1)} cm from the top. Try it on if you can.`,
            `El gorro debe medir unos ${(crownHeightCm + bodyRows / rowsPerCm).toFixed(1)} cm desde la punta. Probátelo si podés.`
          )
        : t(
            `The hat should measure about ${(lengthCm - crownHeightCm).toFixed(1)} cm${hasFolded ? ' from the fold line' : ' from the cast-on edge'}. Knit more or fewer ${unitWord} here if your row gauge differs.`,
            `El gorro debe medir unos ${(lengthCm - crownHeightCm).toFixed(1)} cm${hasFolded ? ' desde la línea de doblez' : ' desde el borde de montaje'}. Tejé más o menos ${unitWord} acá si tu tensión a lo alto es distinta.`
          ),
    });
    row += bodyRows;
    for (let i = 0; i < Math.min(4, cycleLength(spec, false) * 2); i++) {
      chartRows.push(chartRowFromColumns(columns.slice(0, wedgeWidth), i, spec));
    }
  };

  /** Applies the crown stage change to one wedge as worked on the right side. */
  const decreaseWedge = (cols: number[], look: number): StitchOp[] => {
    if (cols.length === 2) return ['k2tog'];
    const appear = (col: number) => spec.appearance(col, look);
    const purled = (a: number, b2: number) => appear(a) === 'P' && appear(b2) === 'P';
    const first: StitchOp = purled(cols[0], cols[1]) ? 'ssp' : 'ssk';
    const last: StitchOp = purled(cols[cols.length - 2], cols[cols.length - 1]) ? 'p2tog' : 'k2tog';
    const inner = cols.slice(2, cols.length - 2).map((col) => opFor(appear(col), 'RS'));
    return [first, ...inner, last];
  };

  const increaseWedge = (cols: number[], look: number): StitchOp[] => {
    const inner = cols.map((col) => opFor(spec.appearance(col, look), 'RS'));
    return ['m1l', ...inner, 'm1r'];
  };

  const withMarkers = (segments: StitchOp[][]): StitchOp[] => {
    const out: StitchOp[] = [];
    segments.forEach((seg) => {
      out.push(...seg, 'sm');
    });
    return out;
  };

  const edge = (ops: StitchOp[], side: RowSide): StitchOp[] => (flat ? [side === 'WS' ? 'p' : 'k', ...ops, side === 'WS' ? 'p' : 'k'] : ops);

  if (!topDown) {
    b.section(
      'brim',
      t('1. Cast On & Brim', '1. Montaje y Puño'),
      t(`${hasFolded ? 'Folded cuff' : 'Brim'} in ${brimName} (${brimRows} ${unitWord})`, `${hasFolded ? 'Puño doblado' : 'Puño'} en ${brimName} (${brimRows} ${unitWord})`)
    );
    const coEn = flat
      ? `Using ${needleWord}, cast on ${castOnSts} sts. The 2 extra stitches are edge stitches for the seam.`
      : `Using ${needleWord} or DPNs, cast on ${castOnSts} sts using a stretchy cast-on. Place a beginning-of-round marker (BOR) and join in the round, taking care not to twist.`;
    const coEs = flat
      ? `Con ${needleWord}, montar ${castOnSts} puntos. Los 2 puntos extra son orillos para la costura.`
      : `Con ${needleWord} o agujas de doble punta, montar ${castOnSts} puntos de manera elástica. Colocar el marcador de inicio de vuelta (MIV) y unir para tejer en redondo con cuidado de no retorcer los puntos.`;
    b.castOn(castOnSts, t(coEn, coEs), flat ? ['long_tail_cast_on'] : ['long_tail_cast_on', 'join_round'], t(
      `Count ${castOnSts} sts. The edge should stretch around the head easily.`,
      `Contá ${castOnSts} puntos. El borde debe estirar fácil alrededor de la cabeza.`
    ));
    workBrim();

    b.section('body', t('2. Hat Body', '2. Cuerpo del Gorro'), t(`${stitchName}, straight (${bodyRows} ${unitWord})`, `${stitchName}, recto (${bodyRows} ${unitWord})`));
    workBody();

    b.section('crown', t('3. Crown Shaping & Finishing', '3. Disminuciones y Cierre'), t(`${wedges} wedges, ${crownRowsCount + 1} ${unitWord}`, `${wedges} gajos, ${crownRowsCount + 1} ${unitWord}`));
    b.prep(
      flat
        ? t(
            `Place markers to divide the ${patternSts} sts between the edge stitches into ${wedges} wedges of ${wedgeWidth} sts.`,
            `Colocá marcadores para dividir los ${patternSts} puntos entre orillos en ${wedges} gajos de ${wedgeWidth} puntos.`
          )
        : t(
            `Set-up: on the next round place ${wedges - 1} markers to divide the sts into ${wedges} wedges of ${wedgeWidth} sts. Use a different colour for the BOR marker. Change to DPNs or Magic Loop when the stitches get tight on the circular needle.`,
            `Preparación: en la próxima vuelta colocá ${wedges - 1} marcadores para dividir los puntos en ${wedges} gajos de ${wedgeWidth} puntos. Usá otro color para el MIV. Pasá a agujas de doble punta o Magic Loop cuando los puntos queden tirantes en la circular.`
          )
    );

    let crownRow = 1;
    const usesPurlDec = new Set<string>(['ssk', 'k2tog']);
    for (let stage = 0; stage < shapeSteps; stage++) {
      // Shaping must land on a row where the stitch pattern allows it.
      if (spec.shapingRowParity !== undefined && row % 2 !== spec.shapingRowParity && !flat) {
        const plainRound = rowFor(wedgeCols(stage).flat(), row, spec, 'round', false);
        b.work([{ side: 'round', ops: plainRound.ops }], 1, crownRow++);
        chartRows.push(chartRowFromColumns(wedgeCols(stage)[0], row, spec));
        row++;
      }
      const side = sideOf(flat, spec, row);
      const decSide: RowSide = flat ? 'RS' : 'round';
      if (flat && side === 'WS') {
        const ws = rowFor(wedgeCols(stage).flat(), row, spec, 'WS', true);
        b.work([ws], 1, crownRow++);
        row++;
      }
      const segments = wedgeCols(stage).map((cols) => decreaseWedge(cols, row));
      const ops = edge(withMarkers(segments), decSide);
      segments[0].forEach((op) => usesPurlDec.add(op));
      const techs = [...new Set(segments[0].filter((op) => op === 'ssk' || op === 'k2tog' || op === 'ssp' || op === 'p2tog') as string[])];
      b.work([{ side: decSide, ops }], 1, crownRow++, {
        note: t(`(${b.sts - wedges * 2} sts remain: ${wedgeCols(stage + 1)[0].length} per wedge.)`, `(Quedan ${b.sts - wedges * 2} puntos: ${wedgeCols(stage + 1)[0].length} por gajo.)`),
        techniques: techs,
      });
      chartRows.push({
        cells: [
          { op: segments[0][0], col: wedgeCols(stage + 1)[0][0] },
          ...wedgeCols(stage + 1)[0].slice(1, -1).map((col) => ({ op: opFor(spec.appearance(col, row), 'RS'), col })),
          { op: segments[0][segments[0].length - 1], col: wedgeCols(stage + 1)[0][wedgeCols(stage + 1)[0].length - 1] },
        ],
      });
      row++;
      const plain = rowFor(wedgeCols(stage + 1).flat(), row, spec, sideOf(flat, spec, row), flat);
      b.work([plain], 1, crownRow++);
      chartRows.push(chartRowFromColumns(wedgeCols(stage + 1)[0], row, spec));
      row++;
    }

    // Last row: every stitch left is decreased, then the hole is drawn closed.
    if (flat && sideOf(flat, spec, row) === 'WS') {
      const ws = rowFor(wedgeCols(shapeSteps).flat(), row, spec, 'WS', true);
      b.work([ws], 1, crownRow++);
      row++;
    }
    const finalSegs = wedgeCols(shapeSteps).map(() => ['k2tog'] as StitchOp[]);
    const finalOps = edge(withMarkers(finalSegs), flat ? 'RS' : 'round');
    b.work([{ side: flat ? 'RS' : 'round', ops: finalOps }], 1, crownRow, { techniques: ['k2tog'] });
    chartRows.push({ cells: [{ op: 'k2tog', col: null }] });
    b.finish(
      flat
        ? t(
            `Cut the yarn leaving 60 cm. Thread it through the remaining ${b.sts} sts twice and pull tight to close the top. Use the same tail to sew the back seam down to the brim with a mattress seam. Weave in all ends on the inside.`,
            `Cortá la hebra dejando 60 cm. Pasala dos veces por los ${b.sts} puntos que quedan y tirá para cerrar la punta. Con la misma hebra cosé la parte de atrás hasta el puño con costura invisible. Escondé todas las hebras por dentro.`
          )
        : t(
            `Break yarn leaving a 20 cm tail. Thread it through the remaining ${b.sts} sts twice, pull tight to close the hole, and secure it on the inside. Weave in all ends.`,
            `Cortá la hebra dejando 20 cm. Pasala dos veces por los ${b.sts} puntos que quedan, tirá firme para cerrar el agujero y aseguralo por dentro. Escondé todas las hebras.`
          ),
      0,
      flat ? ['drawstring_close', 'mattress_seam'] : ['drawstring_close'],
      hasFolded
        ? t(`Fold the brim up to ${targetBrimHeight.toFixed(1)} cm and try it on.`, `Doblá el puño a ${targetBrimHeight.toFixed(1)} cm y probátelo.`)
        : undefined
    );
  } else {
    b.section('crown', t('1. Crown: starting at the top', '1. Coronilla: desde la punta'), t(`${wedges} wedges, growing outward`, `${wedges} gajos, creciendo hacia afuera`));
    const startSts = wedges * 2;
    b.castOn(
      startSts,
      t(
        `Using ${needleSizeMm} mm DPNs or a long circular for Magic Loop, cast on ${startSts} sts. Join in the round, placing a marker after every 2 sts (use a different colour for the BOR marker). Change to the 40 cm circular when the stitches fit around it.`,
        `Con agujas de doble punta de ${needleSizeMm} mm o circular larga para Magic Loop, montá ${startSts} puntos. Uní en redondo y colocá un marcador cada 2 puntos (otro color para el MIV). Pasá a la circular de 40 cm cuando los puntos lleguen a rodearla.`
      ),
      ['long_tail_cast_on', 'join_round'],
      t(`Count ${startSts} sts and ${wedges} markers.`, `Contá ${startSts} puntos y ${wedges} marcadores.`)
    );
    let crownRow = 1;
    for (let stage = shapeSteps; stage > 0; stage--) {
      const plain = rowFor(wedgeCols(stage).flat(), row, spec, 'round', false);
      b.work([{ side: 'round', ops: plain.ops }], 1, crownRow++);
      chartRows.push(chartRowFromColumns(wedgeCols(stage)[0], row, spec));
      row++;
      if (spec.shapingRowParity !== undefined && row % 2 !== spec.shapingRowParity) {
        const extra = rowFor(wedgeCols(stage).flat(), row, spec, 'round', false);
        b.work([{ side: 'round', ops: extra.ops }], 1, crownRow++);
        chartRows.push(chartRowFromColumns(wedgeCols(stage)[0], row, spec));
        row++;
      }
      const segments = wedgeCols(stage).map((cols) => increaseWedge(cols, row));
      b.work([{ side: 'round', ops: withMarkers(segments) }], 1, crownRow++, {
        note: t(`(${wedgeCols(stage - 1)[0].length * wedges} sts now.)`, `(Ahora hay ${wedgeCols(stage - 1)[0].length * wedges} puntos.)`),
        techniques: ['m1l', 'm1r'],
      });
      chartRows.push({
        cells: [
          { op: 'm1l', col: null },
          ...wedgeCols(stage)[0].map((col) => ({ op: opFor(spec.appearance(col, row), 'RS'), col })),
          { op: 'm1r', col: null },
        ],
      });
      row++;
    }
    b.section('body', t('2. Hat Body', '2. Cuerpo del Gorro'), t(`${stitchName}, straight (${bodyRows} ${unitWord})`, `${stitchName}, recto (${bodyRows} ${unitWord})`));
    b.prep(t('Remove the wedge markers as you reach them, and keep the BOR marker.', 'Sacá los marcadores de gajos al llegar a ellos y dejá el MIV.'));
    workBody();
    b.section('brim', t('3. Brim & Bind Off', '3. Puño y Cierre'), t(`${brimName} (${brimRows} ${unitWord})`, `${brimName} (${brimRows} ${unitWord})`));
    workBrim();
    b.work([{ side: 'round', ops: columns.map(() => 'bo' as StitchOp) }], 1, brimRows + 1, {
      note: t('Bind off with a stretchy method.', 'Cerrá con un método elástico.'),
      techniques: ['stretchy_bind_off'],
    });
    b.finish(
      t('Break the yarn and weave in all ends on the inside.', 'Cortá la hebra y escondé las hebras por dentro.'),
      0,
      undefined,
      t('The bound-off edge must stretch over the head without pulling.', 'El borde cerrado debe pasar por la cabeza sin tirar.')
    );
  }

  const materials = es
    ? [
        `${needleWord}`,
        ...(flat ? [] : [`Juego de agujas de doble punta de ${needleSizeMm} mm para la coronilla (o cable largo para Magic Loop)`]),
        `${wedges} marcadores de puntos${flat ? '' : ' (1 de color diferente para el inicio de vuelta)'}`,
        'Aguja lanera sin punta para rematar',
        'Centímetro de sastre para controlar medidas',
      ]
    : [
        needleWord,
        ...(flat ? [] : [`${needleSizeMm}mm double-pointed needles or an 80cm circular for Magic Loop at the crown`]),
        `${wedges} stitch markers${flat ? '' : ' (1 distinct for BOR)'}`,
        'Tapestry needle for weaving ends',
        'Tape measure',
      ];

  const finishedArea = finishedCircumference * (lengthCm + (hasFolded ? targetBrimHeight : 0));
  const pattern = resultFrom(b, blueprint, constraints, {
    title: t(`Hat in ${stitchName}`, `Gorro en ${stitchName}`),
    finished: { circumferenceCm: finishedCircumference, totalLengthCm: lengthCm, brimCm: targetBrimHeight },
    castOn: topDown ? patternSts : castOnSts,
    area: finishedArea,
    materials,
    chart: buildChart(chartRows, lang, chartNote(flat, t), verticalStripeColors(blueprint)),
    howItsMade,
    warnings,
    inRound: !flat,
  });
  const yarn = pattern.yarnEstimates;
  pattern.materials.unshift(
    es
      ? `${yarn.totalGrams} g (${yarn.totalMeters} m) de ${YARN_NAMES_ES[constraints.yarnWeight] || constraints.yarnWeight}`
      : `${yarn.totalGrams}g (${yarn.totalMeters}m) of ${constraints.yarnWeight} yarn`
  );
  return pattern;
}

function verticalStripeColors(blueprint: KnitBlueprint): ((col: number) => string | undefined) | undefined {
  if (blueprint.colorworkType !== 'vertical_stripes' || !blueprint.stripes || blueprint.stripes.length < 2) return undefined;
  const lookup: string[] = [];
  for (const stripe of blueprint.stripes) {
    for (let i = 0; i < Math.max(1, stripe.widthStsEstimate); i++) lookup.push(stripe.hex);
  }
  return (col) => lookup[col % lookup.length];
}

/** Tube worked in the round or flat-and-seamed, with a border when the main stitch would curl. */
export function compileCowlPattern(blueprint: KnitBlueprint, constraints: KnitUserConstraints): CompiledPattern {
  const lang = constraints.language || 'es';
  const es = lang === 'es';
  const t: Tr = (en, esText) => (es ? esText : en);
  const { gaugeSts10cm, gaugeRows10cm, circumferenceCm, lengthCm, needleSizeMm } = constraints;
  const stsPerCm = gaugeSts10cm / 10;
  const rowsPerCm = gaugeRows10cm / 10;
  const flat = blueprint.construction === 'bottom_up_flat';
  const { stitch } = resolveStitch(blueprint.mainStitch);
  const spec = STITCHES[stitch];
  const warnings = baseWarnings(blueprint, constraints, t);

  const border: StitchType = spec.curls ? 'rib_1x1' : stitch;
  const borderSpec = STITCHES[border];
  const divisor = lcm(spec.repeatSts, borderSpec.repeatSts);
  const patternSts = roundToMultiple(circumferenceCm * stsPerCm, divisor);
  const castOn = patternSts + (flat ? 2 : 0);
  const columns = range(patternSts);
  const borderRows = spec.curls ? Math.max(4, Math.round(2.5 * rowsPerCm)) : 0;
  const totalRows = Math.max(4, Math.round(lengthCm * rowsPerCm));
  const bodyRows = Math.max(2, totalRows - borderRows * 2);
  const finished = Math.round((patternSts / stsPerCm) * 10) / 10;
  const unitWord = t(flat ? 'rows' : 'rounds', flat ? 'hileras' : 'vueltas');
  const stitchName = nameOf(spec, lang);

  const b = new PatternBuilder(lang, flat);
  b.section('before', t('Before you start', 'Antes de empezar'), t('Swatch and set-up', 'Muestra y preparación'));
  gaugeStep(b, spec, constraints, lang, t, flat);

  b.section('body', t('1. The Tube', '1. El Tubo'), t(`${stitchName} (${totalRows} ${unitWord})`, `${stitchName} (${totalRows} ${unitWord})`));
  const needle = flat
    ? t(`${needleSizeMm} mm straight needles`, `agujas rectas de ${needleSizeMm} mm`)
    : t(`${needleSizeMm} mm circular needle, about 60 cm long`, `aguja circular de ${needleSizeMm} mm, de unos 60 cm`);
  b.castOn(
    castOn,
    flat
      ? t(`Using ${needle}, cast on ${castOn} sts.`, `Con ${needle}, montá ${castOn} puntos.`)
      : t(
          `Using ${needle}, cast on ${castOn} sts loosely. Place a marker and join in the round without twisting.`,
          `Con ${needle}, montá ${castOn} puntos flojos. Colocá un marcador y uní en redondo sin retorcer.`
        ),
    flat ? ['long_tail_cast_on'] : ['long_tail_cast_on', 'join_round'],
    t(`Count ${castOn} sts.`, `Contá ${castOn} puntos.`)
  );

  let numberNow = 1;
  if (borderRows) {
    b.work(cycleRows(columns, 0, borderSpec, flat, flat), borderRows, numberNow, {
      note: t('This border stops the edge from curling.', 'Este borde evita que se enrolle.'),
    });
    numberNow += borderRows;
  }
  const bodyStart = flat && borderRows % 2 === 1 ? 1 : 0;
  b.work(cycleRows(columns, bodyStart, spec, flat, flat), bodyRows, numberNow, {
    checkpoint: t(`The piece should measure about ${(lengthCm - (borderRows / rowsPerCm)).toFixed(1)} cm.`, `La pieza debe medir unos ${(lengthCm - (borderRows / rowsPerCm)).toFixed(1)} cm.`),
  });
  numberNow += bodyRows;
  if (borderRows) {
    const start = flat && (borderRows + bodyRows) % 2 === 1 ? 1 : 0;
    b.work(cycleRows(columns, start, borderSpec, flat, flat), borderRows, numberNow);
    numberNow += borderRows;
  }
  b.work([{ side: flat ? 'RS' : 'round', ops: Array.from({ length: castOn }, () => 'bo' as StitchOp) }], 1, numberNow, {
    note: t('Bind off loosely so that the edge still stretches.', 'Cerrá flojo para que el borde siga estirando.'),
    techniques: ['stretchy_bind_off'],
  });
  b.finish(
    flat
      ? t('Sew the two short edges together with a mattress seam, then weave in the ends and block gently.', 'Cosé los dos lados cortos con costura invisible, escondé las hebras y bloqueá suave.')
      : t('Weave in the ends and block gently.', 'Escondé las hebras y bloqueá suave.'),
    0,
    flat ? ['mattress_seam'] : undefined
  );

  const chartRows: ChartRow[] = [];
  for (let r = 0; r < Math.max(4, spec.repeatRows * 2); r++) {
    chartRows.push(chartRowFromColumns(columns.slice(0, Math.max(8, spec.repeatSts * 4)), r, spec));
  }
  const pattern = resultFrom(b, blueprint, constraints, {
    title: t(`Cowl in ${stitchName}`, `Cuello en ${stitchName}`),
    finished: { circumferenceCm: finished, totalLengthCm: lengthCm },
    castOn,
    area: finished * lengthCm,
    materials: es ? [needle, 'Marcador de puntos', 'Aguja lanera sin punta'] : [needle, 'Stitch marker', 'Tapestry needle'],
    chart: buildChart(chartRows, lang, chartNote(flat, t)),
    howItsMade: [
      flat
        ? t('A flat rectangle worked back and forth, with the short edges sewn together at the end.', 'Un rectángulo tejido de ida y vuelta, con los lados cortos cosidos al final.')
        : t('A seamless tube. You never turn the work, so you are always looking at the right side.', 'Un tubo sin costura. Nunca girás la labor, así que siempre mirás el lado del derecho.'),
      t(`Worked from the bottom edge to the top edge. There is no shaping: ${castOn} stitches all the way.`, `Se teje del borde de abajo al de arriba. No hay forma: ${castOn} puntos todo el tiempo.`),
    ],
    warnings,
    inRound: !flat,
  });
  const yarn = pattern.yarnEstimates;
  pattern.materials.unshift(es ? `${yarn.totalGrams} g (${yarn.totalMeters} m) de ${YARN_NAMES_ES[constraints.yarnWeight] || constraints.yarnWeight}` : `${yarn.totalGrams}g (${yarn.totalMeters}m) of ${constraints.yarnWeight} yarn`);
  return pattern;
}

/**
 * Flat rectangle, lengthwise. Stitches that curl get a garter frame, because a stockinette scarf
 * rolls into a tube no matter how carefully it is knitted.
 */
export function compileScarfPattern(blueprint: KnitBlueprint, constraints: KnitUserConstraints): CompiledPattern {
  const lang = constraints.language || 'es';
  const es = lang === 'es';
  const t: Tr = (en, esText) => (es ? esText : en);
  const { gaugeSts10cm, gaugeRows10cm, circumferenceCm, lengthCm, needleSizeMm } = constraints;
  const targetWidthCm = circumferenceCm || 24;
  const targetLengthCm = lengthCm || 170;
  const stsPerCm = gaugeSts10cm / 10;
  const rowsPerCm = gaugeRows10cm / 10;
  const { stitch } = resolveStitch(blueprint.mainStitch);
  const spec = STITCHES[stitch];
  const warnings = baseWarnings(blueprint, constraints, t);
  const framed = spec.curls;
  const borderSts = framed ? 3 : 0;
  const borderRows = framed ? 6 : 0;

  const patternSts = roundToMultiple(targetWidthCm * stsPerCm - 2 - borderSts * 2, spec.repeatSts);
  const castOn = patternSts + 2 + borderSts * 2;
  const totalRows = Math.max(4, Math.round(targetLengthCm * rowsPerCm));
  const bodyRows = Math.max(2, totalRows - borderRows * 2);
  const stitchName = nameOf(spec, lang);

  const scarfRow = (row: number, side: RowSide): WorkedRow => {
    const inner = range(patternSts).map((col) => opFor(spec.appearance(col, row), side));
    const order = side === 'WS' ? [...inner].reverse() : inner;
    // A knit border on both sides of every row is garter stitch.
    const frame: StitchOp[] = Array.from({ length: borderSts }, () => 'k');
    return { side, ops: ['sl1wyif', ...frame, ...order, ...frame, 'k'] };
  };
  const garterRow = (side: RowSide): WorkedRow => ({
    side,
    ops: ['sl1wyif', ...Array.from({ length: castOn - 2 }, () => 'k' as StitchOp), 'k'],
  });

  const firstIsWS = spec.flatStartsOnWS === true;
  const body: WorkedRow[] = [];
  for (let i = 0; i < lcm(spec.repeatRows, 2); i++) {
    const side: RowSide = (i % 2 === 0) === firstIsWS ? 'WS' : 'RS';
    body.push(scarfRow(i, side));
  }

  const b = new PatternBuilder(lang, true);
  b.section('before', t('Before you start', 'Antes de empezar'), t('Swatch and set-up', 'Muestra y preparación'));
  gaugeStep(b, spec, constraints, lang, t, true);

  b.section('full-scarf', t('1. The Scarf', '1. La Bufanda'), t(`Flat, ${totalRows} rows`, `Plano, ${totalRows} hileras`));
  b.castOn(
    castOn,
    t(`Using ${needleSizeMm} mm needles, cast on ${castOn} sts loosely.`, `Con agujas de ${needleSizeMm} mm, montá ${castOn} puntos flojos.`),
    ['long_tail_cast_on'],
    t(`Count ${castOn} sts. The piece should be about ${targetWidthCm} cm wide.`, `Contá ${castOn} puntos. La pieza debe medir unos ${targetWidthCm} cm de ancho.`)
  );
  let numberNow = 1;
  if (borderRows) {
    b.work([garterRow('RS'), garterRow('WS')], borderRows, numberNow, {
      note: t('This frame keeps the scarf from curling.', 'Este marco evita que la bufanda se enrolle.'),
      techniques: ['chain_selvedge'],
    });
    numberNow += borderRows;
  }
  b.work(body, bodyRows, numberNow, {
    techniques: ['chain_selvedge', ...(body.some((r) => r.ops.includes('k1b')) ? ['k1b'] : [])],
    checkpoint: t(`Keep going until the scarf is about ${targetLengthCm} cm long. Lay it flat to measure, without stretching.`, `Seguí hasta que mida unos ${targetLengthCm} cm. Medila plana, sin estirar.`),
  });
  numberNow += bodyRows;
  if (borderRows) {
    b.work([garterRow('RS'), garterRow('WS')], borderRows, numberNow);
    numberNow += borderRows;
  }
  b.work([{ side: 'RS', ops: Array.from({ length: castOn }, () => 'bo' as StitchOp) }], 1, numberNow, {
    note: t('Bind off loosely, in pattern.', 'Cerrá flojo, como se presentan.'),
    techniques: ['stretchy_bind_off'],
  });
  b.finish(
    t(`Weave in the ends, then block gently to ${targetWidthCm} × ${targetLengthCm} cm.`, `Escondé las hebras y bloqueá suave a ${targetWidthCm} × ${targetLengthCm} cm.`),
    0
  );

  const chartRows: ChartRow[] = [];
  const sample = range(Math.max(8, spec.repeatSts * 4));
  for (let r = 0; r < Math.max(4, spec.repeatRows * 2); r++) chartRows.push(chartRowFromColumns(sample, r, spec));

  const pattern = resultFrom(b, blueprint, constraints, {
    title: t(`Scarf in ${stitchName}`, `Bufanda en ${stitchName}`),
    finished: { circumferenceCm: targetWidthCm, totalLengthCm: targetLengthCm },
    castOn,
    area: targetWidthCm * targetLengthCm,
    materials: es
      ? [`Agujas rectas o circulares de ${needleSizeMm} mm`, 'Aguja lanera sin punta']
      : [`${needleSizeMm}mm straight or circular needles`, 'Tapestry needle'],
    chart: buildChart(chartRows, lang, chartNote(true, t)),
    howItsMade: [
      t(
        'A flat rectangle worked back and forth from one short end to the other. You turn at the end of every row.',
        'Un rectángulo plano, tejido de ida y vuelta de un extremo corto al otro. Girás al final de cada hilera.'
      ),
      framed
        ? t(`${capitalized(stitchName)} curls, so a garter frame runs around all four edges.`, `El ${stitchName} se enrolla, así que un marco de Santa Clara rodea los cuatro bordes.`)
        : t(`${capitalized(stitchName)} lies flat by itself, so no border is needed.`, `El ${stitchName} queda plano solo, así que no hace falta borde.`),
    ],
    warnings,
    inRound: false,
  });
  const yarn = pattern.yarnEstimates;
  pattern.materials.unshift(es ? `${yarn.totalGrams} g (${yarn.totalMeters} m) de ${YARN_NAMES_ES[constraints.yarnWeight] || constraints.yarnWeight}` : `${yarn.totalGrams}g (${yarn.totalMeters}m) of ${constraints.yarnWeight} yarn`);
  return pattern;
}

/**
 * Sweaters and anything else without a compiler get an honest test piece in the decoded stitch,
 * never a beanie presented as if it were the requested garment.
 */
export function compileSwatchPattern(blueprint: KnitBlueprint, constraints: KnitUserConstraints): CompiledPattern {
  const lang = constraints.language || 'es';
  const es = lang === 'es';
  const t: Tr = (en, esText) => (es ? esText : en);
  const { stitch } = resolveStitch(blueprint.mainStitch);
  const spec = STITCHES[stitch];
  const warnings = baseWarnings(blueprint, constraints, t);
  const stitchName = nameOf(spec, lang);
  const stsPerCm = constraints.gaugeSts10cm / 10;
  const rowsPerCm = constraints.gaugeRows10cm / 10;
  const castOn = Math.max(spec.repeatSts * 6, roundToMultiple(stsPerCm * 15, spec.repeatSts));
  const rows = Math.max(8, Math.round(rowsPerCm * 15));

  if (blueprint.garmentType === 'pullover' || blueprint.garmentType === 'cardigan' || blueprint.garmentType === 'other') {
    warnings.unshift({
      severity: 'caution',
      message: t(
        'The app can decode this garment but cannot write a full row-by-row pattern for it yet. This is a test swatch in the right stitch, so you can check the stitch and gauge before using a garment pattern of this type.',
        'La app puede analizar esta prenda, pero todavía no puede escribir el patrón completo vuelta a vuelta. Esto es una muestra en el punto correcto, para comprobar el punto y la tensión antes de usar un patrón de este tipo de prenda.'
      ),
    });
  }

  const columns = range(castOn);
  const b = new PatternBuilder(lang, true);
  b.section('swatch', t('Test swatch', 'Muestra de prueba'), t(`${stitchName}, about 15 × 15 cm`, `${stitchName}, unos 15 × 15 cm`));
  b.castOn(
    castOn,
    t(`Using ${constraints.needleSizeMm} mm needles, cast on ${castOn} sts.`, `Con agujas de ${constraints.needleSizeMm} mm, montá ${castOn} puntos.`),
    ['long_tail_cast_on'],
    t(`Count ${castOn} sts.`, `Contá ${castOn} puntos.`)
  );
  b.work(cycleRows(columns, 0, spec, true, false), rows, 1, {
    checkpoint: t('Compare it with the photo: the texture should look the same.', 'Comparala con la foto: la textura debe verse igual.'),
  });
  b.work([{ side: 'RS', ops: columns.map(() => 'bo' as StitchOp) }], 1, rows + 1, { techniques: ['stretchy_bind_off'] });
  b.finish(
    t('Wash or steam the swatch, dry it flat and measure it. Type your numbers into the gauge box.', 'Lavá o vaporizá la muestra, secala plana y medila. Cargá tus números en el cuadro de tensión.'),
    0,
    ['gauge_swatch']
  );

  const chartRows: ChartRow[] = [];
  const sample = range(Math.max(8, spec.repeatSts * 4));
  for (let r = 0; r < Math.max(4, spec.repeatRows * 2); r++) chartRows.push(chartRowFromColumns(sample, r, spec));

  return resultFrom(b, blueprint, constraints, {
    // Named for what was decoded: a cable swatch stays a cable swatch even with a plain base written.
    title: t(`Test swatch: ${nameOf(STITCHES[blueprint.mainStitch], lang)}`, `Muestra: ${nameOf(STITCHES[blueprint.mainStitch], lang)}`),
    finished: { circumferenceCm: Math.round((castOn / stsPerCm) * 10) / 10, totalLengthCm: Math.round((rows / rowsPerCm) * 10) / 10 },
    castOn,
    area: 15 * 15,
    materials: es ? [`Agujas de ${constraints.needleSizeMm} mm`, 'Un poco del hilado elegido'] : [`${constraints.needleSizeMm} mm needles`, 'A little of your chosen yarn'],
    chart: buildChart(chartRows, lang, chartNote(true, t)),
    howItsMade: [t('A small flat square, worked back and forth, to test stitch and gauge.', 'Un cuadrado plano y chico, tejido de ida y vuelta, para probar el punto y la tensión.')],
    warnings,
    inRound: false,
  });
}

/**
 * Universal Pattern Compiler Router
 */
export function compilePattern(blueprint: KnitBlueprint, constraints: KnitUserConstraints): CompiledPattern {
  switch (blueprint.garmentType) {
    case 'beanie':
      return compileBeaniePattern(blueprint, constraints);
    case 'cowl':
      return compileCowlPattern(blueprint, constraints);
    case 'scarf':
      return compileScarfPattern(blueprint, constraints);
    default:
      return compileSwatchPattern(blueprint, constraints);
  }
}

/**
 * Knits the finished pattern back through a stitch counter. Independent of the builder's own
 * check, so it catches mistakes in step ordering too. Returns a list of problems, empty if clean.
 */
export function verifyPattern(pattern: CompiledPattern): string[] {
  const problems: string[] = [];
  let live: number | null = null;
  let previousSide: RowSide | null = null;
  for (const step of pattern.allRows) {
    if (step.kind !== 'work' || !step.rows) {
      if (step.stitchCountAfter > 0 && step.techniques?.includes('long_tail_cast_on')) live = step.stitchCountAfter;
      continue;
    }
    const count = step.repeatCount ?? 1;
    for (let i = 0; i < count; i++) {
      const row = step.rows[i % step.rows.length];
      const { consumed, produced } = countRow(row.ops);
      if (live === null) {
        problems.push(`Step ${step.stepNumber}: worked before casting on`);
        live = consumed;
      }
      if (consumed !== live) {
        problems.push(`Step ${step.stepNumber} row ${i + 1}: uses ${consumed} sts but ${live} are on the needle`);
      }
      if (previousSide && row.side !== 'round' && previousSide === row.side && !row.ops.every((op) => op === 'bo')) {
        problems.push(`Step ${step.stepNumber} row ${i + 1}: two ${row.side} rows in a row`);
      }
      previousSide = row.side === 'round' ? null : row.side;
      live = produced;
    }
    if (live !== step.stitchCountAfter) {
      problems.push(`Step ${step.stepNumber}: ends with ${live} sts, text says ${step.stitchCountAfter}`);
    }
  }
  if (live !== 0 && live !== null && pattern.allRows[pattern.allRows.length - 1]?.stitchCountAfter !== 0) {
    problems.push(`Pattern ends with ${live} sts still on the needle`);
  }
  return problems;
}
