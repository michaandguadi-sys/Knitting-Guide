import { RowSide, StitchOp, StitchType, WorkedRow } from '../types/knit';

export type Appearance = 'K' | 'P' | 'K1B';

export interface StitchSpec {
  /** Stitch multiple the pattern needs across a round or row. */
  repeatSts: number;
  /** Rows before the fabric pattern starts again. */
  repeatRows: number;
  /** What a stitch looks like from the right side at column `col`, row `row` (0 = first row). */
  appearance: (col: number, row: number) => Appearance;
  /** Curls at the edges unless given a border. */
  curls: boolean;
  /** Looks the same from both sides, so it can show on a folded brim. */
  reversible: boolean;
  /** Rows on which shaping sits cleanly, when not every row suits it. */
  shapingRowParity?: 0 | 1;
  /** The first flat row is a wrong-side row, because the plain set-up row is that one. */
  flatStartsOnWS?: boolean;
  /** Yarn use compared with stockinette. */
  yarnFactor: number;
  /** Rows taller or shorter than stockinette at the same needle. */
  gaugeNote: { en: string; es: string };
  name: { en: string; es: string };
  /** True when the app can write this stitch out row by row. */
  compilable: boolean;
}

const rib = (knits: number, purls: number) => (col: number): Appearance =>
  col % (knits + purls) < knits ? 'K' : 'P';

export const STITCHES: Record<StitchType, StitchSpec> = {
  stockinette: {
    repeatSts: 1,
    repeatRows: 1,
    appearance: () => 'K',
    curls: true,
    reversible: false,
    yarnFactor: 1,
    gaugeNote: {
      en: 'The reference fabric: most ball-band gauges are measured in it.',
      es: 'Es el tejido de referencia: casi todas las etiquetas miden la muestra en este punto.',
    },
    name: { en: 'Stockinette', es: 'Punto jersey' },
    compilable: true,
  },
  reverse_stockinette: {
    repeatSts: 1,
    repeatRows: 1,
    appearance: () => 'P',
    curls: true,
    reversible: false,
    yarnFactor: 1,
    gaugeNote: {
      en: 'Same gauge as stockinette: it is the same fabric seen from the back.',
      es: 'Misma muestra que el jersey: es el mismo tejido visto del revés.',
    },
    name: { en: 'Reverse stockinette', es: 'Punto jersey revés' },
    compilable: true,
  },
  garter: {
    repeatSts: 1,
    repeatRows: 2,
    appearance: (_col, row) => (row % 2 === 0 ? 'K' : 'P'),
    curls: false,
    reversible: true,
    shapingRowParity: 0,
    yarnFactor: 1.15,
    gaugeNote: {
      en: 'Rows pack tightly: about twice as many rows per cm as stitches.',
      es: 'Las vueltas quedan muy juntas: cerca del doble de vueltas por cm que de puntos.',
    },
    name: { en: 'Garter stitch', es: 'Punto Santa Clara' },
    compilable: true,
  },
  rib_1x1: {
    repeatSts: 2,
    repeatRows: 1,
    appearance: rib(1, 1),
    curls: false,
    reversible: true,
    yarnFactor: 1.2,
    gaugeNote: {
      en: 'Pulls in by itself: measure the swatch relaxed, or it will look looser than it knits.',
      es: 'Se cierra sola: medí la muestra sin estirar, si no parece más floja de lo que queda.',
    },
    name: { en: '1x1 rib', es: 'Elástico 1x1' },
    compilable: true,
  },
  rib_2x2: {
    repeatSts: 4,
    repeatRows: 1,
    appearance: rib(2, 2),
    curls: false,
    reversible: true,
    yarnFactor: 1.25,
    gaugeNote: {
      en: 'Pulls in more than 1x1: measure the swatch relaxed.',
      es: 'Se cierra más que el 1x1: medí la muestra sin estirar.',
    },
    name: { en: '2x2 rib', es: 'Elástico 2x2' },
    compilable: true,
  },
  seed_stitch: {
    repeatSts: 2,
    repeatRows: 2,
    appearance: (col, row) => ((col + row) % 2 === 0 ? 'K' : 'P'),
    curls: false,
    reversible: true,
    yarnFactor: 1.2,
    gaugeNote: {
      en: 'Slightly wider stitches than stockinette at the same needle.',
      es: 'Puntos algo más anchos que el jersey con la misma aguja.',
    },
    name: { en: 'Seed stitch', es: 'Punto arroz' },
    compilable: true,
  },
  moss_stitch: {
    repeatSts: 2,
    repeatRows: 4,
    appearance: (col, row) => ((col + Math.floor(row / 2)) % 2 === 0 ? 'K' : 'P'),
    curls: false,
    reversible: true,
    yarnFactor: 1.2,
    gaugeNote: {
      en: 'Behaves like seed stitch, with a blockier look.',
      es: 'Se comporta como el punto arroz, con un aspecto más de bloques.',
    },
    name: { en: 'Moss stitch', es: 'Punto arroz doble' },
    compilable: true,
  },
  fishermans_rib: {
    repeatSts: 2,
    repeatRows: 2,
    appearance: (col, row) => (col % 2 === 0 ? (row % 2 === 1 ? 'K1B' : 'K') : 'P'),
    curls: false,
    reversible: true,
    shapingRowParity: 0,
    flatStartsOnWS: true,
    yarnFactor: 1.5,
    gaugeNote: {
      en: 'Very stretchy and much wider than stockinette: a swatch is essential.',
      es: 'Muy elástico y bastante más ancho que el jersey: la muestra es imprescindible.',
    },
    name: { en: "Fisherman's rib", es: 'Elástico inglés' },
    compilable: true,
  },
  brioche: {
    // Written as fisherman's rib: same look and stretch, without tracking yarn-overs.
    repeatSts: 2,
    repeatRows: 2,
    appearance: (col, row) => (col % 2 === 0 ? (row % 2 === 1 ? 'K1B' : 'K') : 'P'),
    curls: false,
    reversible: true,
    shapingRowParity: 0,
    flatStartsOnWS: true,
    yarnFactor: 1.5,
    gaugeNote: {
      en: "Written as fisherman's rib, which looks nearly the same and is easier to fix.",
      es: 'Se escribe como elástico inglés, que se ve casi igual y es más fácil de corregir.',
    },
    name: { en: "Brioche (written as fisherman's rib)", es: 'Punto inglés (escrito como elástico inglés)' },
    compilable: true,
  },
  cable: {
    repeatSts: 1,
    repeatRows: 1,
    appearance: () => 'K',
    curls: false,
    reversible: false,
    yarnFactor: 1.3,
    gaugeNote: {
      en: 'Cables pull the fabric in. Swatch the cable itself, not plain stockinette.',
      es: 'Las trenzas cierran el tejido. Hacé la muestra con la trenza, no en jersey liso.',
    },
    name: { en: 'Cables', es: 'Trenzas' },
    compilable: false,
  },
  lace: {
    repeatSts: 1,
    repeatRows: 1,
    appearance: () => 'K',
    curls: false,
    reversible: false,
    yarnFactor: 0.8,
    gaugeNote: {
      en: 'Lace only shows its size after blocking: measure the swatch wet-blocked.',
      es: 'El calado muestra su tamaño recién después del bloqueo: medí la muestra bloqueada.',
    },
    name: { en: 'Lace', es: 'Calado' },
    compilable: false,
  },
};

/** Which op makes a stitch look like `look` from the right side, given the side being worked. */
export function opFor(look: Appearance, side: RowSide): StitchOp {
  if (side === 'WS') return look === 'P' ? 'k' : 'p';
  if (look === 'K1B') return 'k1b';
  return look === 'K' ? 'k' : 'p';
}

/** The stitches a row consumes and leaves. Markers and slips count as they should. */
const OP_COUNTS: Record<StitchOp, [number, number]> = {
  k: [1, 1],
  p: [1, 1],
  k1b: [1, 1],
  sl1wyif: [1, 1],
  ssk: [2, 1],
  k2tog: [2, 1],
  ssp: [2, 1],
  p2tog: [2, 1],
  m1l: [0, 1],
  m1r: [0, 1],
  sm: [0, 0],
  bo: [1, 0],
};

export function countRow(ops: StitchOp[]): { consumed: number; produced: number } {
  let consumed = 0;
  let produced = 0;
  for (const op of ops) {
    consumed += OP_COUNTS[op][0];
    produced += OP_COUNTS[op][1];
  }
  return { consumed, produced };
}

export interface RowLabels {
  k: string;
  p: string;
  k1b: string;
  ssk: string;
  k2tog: string;
  ssp: string;
  p2tog: string;
  m1l: string;
  m1r: string;
  sl1wyif: string;
  sm: string;
  bo: string;
  repeatTail: (first: boolean) => string;
  repeatTimes: (times: number) => string;
}

export const ROW_LABELS: Record<'en' | 'es', RowLabels> = {
  en: {
    k: 'K',
    p: 'P',
    k1b: 'K1b',
    ssk: 'ssk',
    k2tog: 'k2tog',
    ssp: 'ssp',
    p2tog: 'p2tog',
    m1l: 'M1L',
    m1r: 'M1R',
    sl1wyif: 'Sl1 wyif',
    sm: 'sm',
    bo: 'BO',
    repeatTail: () => 'rep from * to end',
    repeatTimes: (t) => `rep from * ${t} more ${t === 1 ? 'time' : 'times'}`,
  },
  es: {
    k: 'D',
    p: 'R',
    k1b: 'D1A',
    ssk: 'SS',
    k2tog: '2pjD',
    ssp: 'SSR',
    p2tog: '2pjR',
    m1l: 'A1I',
    m1r: 'A1D',
    sl1wyif: 'Desl1 hebra adel.',
    sm: 'pasar marcador',
    bo: 'Cerrar',
    repeatTail: () => 'repetir desde * hasta el final',
    repeatTimes: (t) => `repetir desde * ${t} ${t === 1 ? 'vez' : 'veces'} más`,
  },
};

const COUNTED: StitchOp[] = ['k', 'p', 'bo'];

function tokenize(ops: StitchOp[], labels: RowLabels): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < ops.length) {
    const op = ops[i];
    let run = 1;
    while (i + run < ops.length && ops[i + run] === op) run++;
    if (COUNTED.includes(op)) {
      out.push(op === 'bo' ? `${labels.bo} ${run}` : `${labels[op]}${run}`);
    } else {
      for (let r = 0; r < run; r++) out.push(labels[op]);
    }
    i += run;
  }
  return out;
}

/** Splits into identical repeated stretches: returns the shortest period that covers the list. */
function findRepeat<T>(items: T[], same: (a: T, b: T) => boolean): number | null {
  for (let period = 1; period <= items.length / 2; period++) {
    if (items.length % period !== 0) continue;
    let matches = true;
    for (let i = period; i < items.length; i++) {
      if (!same(items[i], items[i % period])) {
        matches = false;
        break;
      }
    }
    if (matches) return period;
  }
  return null;
}

/**
 * Writes a row the way a knitter reads one, with repeats folded into "*...; rep".
 * Text comes from the same ops the simulator checks, so words and stitch counts cannot drift.
 */
export function rowToText(ops: StitchOp[], lang: 'en' | 'es'): string {
  const labels = ROW_LABELS[lang];
  const list = ops;

  // Marker-separated wedges first: the natural reading for shaped rounds.
  const segments: StitchOp[][] = [];
  let current: StitchOp[] = [];
  for (const op of list) {
    if (op === 'sm') {
      segments.push(current);
      current = [];
    } else {
      current.push(op);
    }
  }
  if (current.length) segments.push(current);

  if (segments.length > 1) {
    const same = segments.every((s) => s.join() === segments[0].join());
    if (same) {
      return `*${describeRun(segments[0], labels)}, ${labels.sm}; ${labels.repeatTimes(segments.length - 1)}`.replace(/\*\*/g, '[');
    }
    return segments.map((s) => describeRun(s, labels)).join(`, ${labels.sm}, `);
  }

  return describeRun(list, labels);
}

/** Folds the longest repeated block: "Sl1 wyif, K3, *K1, P1; rep 40 more times, K4". */
function describeRun(list: StitchOp[], labels: RowLabels): string {
  const whole = findRepeat(list, (a, b) => a === b);
  if (whole && !list.slice(0, whole).every((u) => u === list[0])) {
    return `*${tokenize(list.slice(0, whole), labels).join(', ')}; ${labels.repeatTail(true)}`;
  }
  let bestStart = -1;
  let bestPeriod = 0;
  let bestCopies = 0;
  for (let period = 2; period <= 8; period++) {
    // Row prefixes are short (edge stitches, a border), so only the first few starts matter.
    for (let start = 0; start <= 12 && start + period * 3 <= list.length; start++) {
      if (list.slice(start, start + period).every((u) => u === list[start])) continue;
      let copies = 1;
      while (start + (copies + 1) * period <= list.length) {
        const offset = start + copies * period;
        let same = true;
        for (let i = 0; i < period; i++) {
          if (list[offset + i] !== list[start + i]) {
            same = false;
            break;
          }
        }
        if (!same) break;
        copies++;
      }
      if (copies >= 3 && copies * period > bestCopies * bestPeriod) {
        bestStart = start;
        bestPeriod = period;
        bestCopies = copies;
      }
    }
  }
  if (bestStart < 0) return tokenize(list, labels).join(', ');
  const before = tokenize(list.slice(0, bestStart), labels);
  const unit = tokenize(list.slice(bestStart, bestStart + bestPeriod), labels);
  const after = tokenize(list.slice(bestStart + bestPeriod * bestCopies), labels);
  const middle = `*${unit.join(', ')}; ${labels.repeatTimes(bestCopies - 1)}`;
  return [...before, middle, ...after].join(", ");
}
