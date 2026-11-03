import { YARN_SPECS } from '../engine/compiler';
import { STITCHES } from '../engine/stitches';
import { ColorworkType, GarmentType, KnitBlueprint, StitchType, StripeDefinition, YarnWeightCategory } from '../types/knit';
import { ColorLayout } from '../vision/colors';
import { FabricReading } from '../vision/pipeline';
import { TextureFamily } from '../vision/texture';
import { Deduction } from './analysis';
import { CANT_TELL, Decoded, DecodeQuestion, Finding, PhotoSlot, constructionFrom } from './types';

type Lang = 'en' | 'es';
const tr = (lang: Lang) => (en: string, es: string) => (lang === 'es' ? es : en);

/** Stitches that can produce each measured texture. */
export const FAMILY_STITCHES: Record<TextureFamily, StitchType[]> = {
  vertical_columns: ['rib_1x1', 'rib_2x2', 'fishermans_rib', 'brioche'],
  horizontal_ridges: ['garter', 'reverse_stockinette'],
  vee_lattice: ['stockinette'],
  bump_lattice: ['seed_stitch', 'moss_stitch', 'reverse_stockinette', 'fishermans_rib'],
  irregular: ['cable', 'lace'],
  unresolved: [],
};

/**
 * Model confidence is self-reported and tends to run high, so it is capped and scaled by photo
 * quality before it is believed.
 */
const AI_CONFIDENCE_CAP = 0.9;
const scaleAi = (value: number, quality: number) => Math.min(AI_CONFIDENCE_CAP, value) * (0.6 + 0.4 * quality);

/** Measurement alone got 4 of 14 labelled real photos confidently wrong, so it stays below "sure". */
const MEASURED_CONFIDENCE_CAP = 0.55;
export const CONFIRM_BELOW = 0.6;

function measuredStitch(reading: FabricReading): StitchType | null {
  const { family, ribRepeatSts } = reading.texture;
  switch (family) {
    case 'vertical_columns':
      return ribRepeatSts && ribRepeatSts >= 4 ? 'rib_2x2' : 'rib_1x1';
    case 'horizontal_ridges':
      return 'garter';
    case 'vee_lattice':
      return 'stockinette';
    case 'bump_lattice':
      return 'seed_stitch';
    default:
      return null;
  }
}

const LAYOUT_TO_COLORWORK: Record<ColorLayout, ColorworkType> = {
  solid: 'solid',
  vertical_stripes: 'vertical_stripes',
  horizontal_stripes: 'horizontal_stripes',
  motif: 'stranded_motif',
  variegated: 'variegated',
  color_block: 'color_block',
};

function stitchWord(stitch: StitchType, lang: Lang): string {
  return lang === 'es' ? STITCHES[stitch].name.es : STITCHES[stitch].name.en;
}

function familyWord(family: TextureFamily, lang: Lang): string {
  const t = tr(lang);
  switch (family) {
    case 'vertical_columns':
      return t('columns running up the fabric', 'columnas que suben por el tejido');
    case 'horizontal_ridges':
      return t('ridges running across the fabric', 'relieves horizontales');
    case 'vee_lattice':
      return t('a grid of stacked Vs', 'una grilla de Vs apiladas');
    case 'bump_lattice':
      return t('offset rows of bumps', 'hileras de bolitas desplazadas');
    case 'irregular':
      return t('no single repeat, which may mean cables, lace or a motif', 'sin una sola repetición, lo que puede indicar trenzas, calado o un motivo');
    default:
      return t('stitches too small or blurred to measure', 'puntos muy chicos o borrosos para medir');
  }
}

/** One plain sentence about what the measurements show, for the progress screen. */
export function describeTexture(reading: FabricReading, lang: Lang): string {
  const t = tr(lang);
  const { texture, segment } = reading;
  const shape = familyWord(texture.family, lang);
  const across = texture.pxPerStitch ? Math.round(segment.box.width / texture.pxPerStitch) : null;
  const opening = t(`The fabric shows ${shape}.`, `El tejido muestra ${shape}.`);
  return across
    ? `${opening} ${t(`About ${across} stitches across.`, `Unos ${across} puntos de ancho.`)}`
    : opening;
}

export function pickStitchReading(readings: { slot: PhotoSlot; reading: FabricReading }[]): FabricReading {
  // A close-up shows stitches best, so it wins unless it could not be read at all.
  const rank = (r: { slot: PhotoSlot; reading: FabricReading }) =>
    r.reading.textureConfidence + (r.slot === 'closeup' ? 0.25 : 0) - (r.slot === 'inside' ? 0.5 : 0);
  return [...readings].sort((a, b) => rank(b) - rank(a))[0].reading;
}

export function reconcile(
  readings: { slot: PhotoSlot; reading: FabricReading }[],
  ai: Deduction | null,
  lang: Lang
): Decoded {
  const t = tr(lang);
  const best = pickStitchReading(readings);
  const front = readings.find((r) => r.slot === 'front')?.reading ?? best;
  const quality = best.quality.score;
  const notes: string[] = [...(ai?.notes ?? [])];

  // What is it
  const measured = measuredStitch(best);
  const family = best.texture.family;
  const cvStrength = best.textureConfidence;
  let stitch: Finding<StitchType>;
  if (ai) {
    const compatible = FAMILY_STITCHES[family].includes(ai.main_stitch);
    let confidence = scaleAi(ai.main_stitch_confidence, quality);
    const alternatives = [...ai.main_stitch_lookalikes];
    if (compatible && cvStrength >= 0.5) {
      confidence = Math.min(0.95, confidence + 0.1);
    } else if (!compatible && measured && cvStrength >= 0.6) {
      confidence *= 0.75;
      alternatives.unshift(measured);
      notes.push(
        t(
          `The AI read ${stitchWord(ai.main_stitch, lang)}, but the measurements show ${familyWord(family, lang)}. Check this one yourself.`,
          `La IA leyó ${stitchWord(ai.main_stitch, lang)}, pero las mediciones muestran ${familyWord(family, lang)}. Revisá este dato vos.`
        )
      );
    }
    stitch = {
      value: ai.main_stitch,
      confidence,
      source: 'ai',
      evidence: ai.main_stitch_evidence,
      alternatives: [...new Set(alternatives)].filter((s) => s !== ai.main_stitch),
    };
  } else if (measured) {
    stitch = {
      value: measured,
      confidence: Math.min(MEASURED_CONFIDENCE_CAP, cvStrength * 0.7),
      source: 'measured',
      evidence: t(`The photo shows ${familyWord(family, lang)}.`, `La foto muestra ${familyWord(family, lang)}.`),
      alternatives: FAMILY_STITCHES[family].filter((s) => s !== measured),
    };
  } else {
    stitch = {
      value: 'stockinette',
      confidence: 0.1,
      source: 'assumed',
      evidence: t(
        `Could not read the stitch: ${familyWord(family, lang)}. A close-up in daylight would help most.`,
        `No se pudo leer el punto: ${familyWord(family, lang)}. Lo que más ayuda es una foto de cerca con luz de día.`
      ),
      alternatives: ['rib_1x1', 'garter', 'seed_stitch', 'cable'],
    };
  }

  let edgeStitch: Finding<StitchType | 'same'>;
  if (ai) {
    edgeStitch = {
      value: ai.edge_stitch,
      confidence: scaleAi(ai.edge_stitch_confidence || 0.5, quality),
      source: 'ai',
      evidence: '',
    };
  } else {
    // The lowest zone of a hat or sweater is its brim or hem.
    const bottom = front.texture.zones.find((z) => z.zone === 'bottom');
    const middle = front.texture.zones.find((z) => z.zone === 'middle');
    const differs = bottom && middle && bottom.family !== middle.family && bottom.family === 'vertical_columns';
    edgeStitch = differs
      ? {
          value: 'rib_1x1',
          confidence: 0.4,
          source: 'measured',
          evidence: t('The lower part of the piece shows columns that the body does not.', 'La parte de abajo muestra columnas que el cuerpo no tiene.'),
        }
      : { value: 'same', confidence: 0.3, source: 'assumed', evidence: '' };
  }

  const garment: Finding<GarmentType> = ai
    ? { value: ai.garment, confidence: scaleAi(ai.garment_confidence, quality), source: 'ai', evidence: '' }
    : {
        value: front.segment.fullFrame ? 'swatch' : 'beanie',
        confidence: 0.15,
        source: 'assumed',
        evidence: t('Photos alone cannot name a garment without the AI. Please choose it.', 'Sin la IA, las fotos solas no pueden nombrar la prenda. Elegila vos.'),
      };

  const colorsFinding: Finding<ColorworkType> = ai
    ? { value: ai.colorwork, confidence: scaleAi(ai.colorwork_confidence, quality), source: 'ai', evidence: '' }
    : {
        value: LAYOUT_TO_COLORWORK[front.colors.layout],
        confidence: Math.min(MEASURED_CONFIDENCE_CAP, front.colors.layoutConfidence),
        source: 'measured',
        evidence: t(`${front.colors.colors.length} yarn colour(s) measured.`, `${front.colors.colors.length} color(es) de lana medidos.`),
      };

  // How it is made
  const defaultMethod = garment.value === 'scarf' ? 'flat' : garment.value === 'beanie' || garment.value === 'cowl' ? 'round' : 'flat';
  let method: Finding<Decoded['method']['value']> = ai && ai.method !== 'unknown'
    ? { value: ai.method, confidence: scaleAi(ai.method_confidence, quality), source: 'ai', evidence: ai.method_evidence }
    : {
        value: defaultMethod,
        confidence: 0.3,
        source: 'assumed',
        evidence: t('No seam or edge clue was visible, so this follows the usual way to make this item.', 'No se ve costura ni borde que lo indique, así que sigue la forma habitual de tejer esta prenda.'),
      };
  if (garment.value === 'scarf' && method.value === 'round') {
    method = { ...method, confidence: Math.min(method.confidence, 0.4) };
  }

  const direction: Finding<Decoded['direction']['value']> = ai && ai.direction !== 'unknown'
    ? { value: ai.direction, confidence: scaleAi(ai.direction_confidence, quality), source: 'ai', evidence: ai.direction_evidence }
    : {
        value: 'bottom_up',
        confidence: 0.3,
        source: 'assumed',
        evidence: t('Not visible in this photo. A photo of the very top and the edge settles it.', 'No se ve en esta foto. Una foto de la punta y del borde lo define.'),
      };

  const foldedBrim: Finding<boolean> = ai
    ? { value: ai.folded_brim, confidence: scaleAi(ai.folded_brim_confidence || 0.5, quality), source: 'ai', evidence: '' }
    : { value: false, confidence: 0.25, source: 'assumed', evidence: '' };

  const crownWedges: Finding<number | null> = ai && ai.crown_wedges
    ? { value: ai.crown_wedges, confidence: scaleAi(ai.crown_confidence, quality), source: 'ai', evidence: '' }
    : { value: null, confidence: 0.2, source: 'assumed', evidence: '' };

  const madeBy: Finding<Decoded['madeBy']['value']> = ai
    ? { value: ai.made_by, confidence: scaleAi(ai.made_by_confidence, quality), source: 'ai', evidence: ai.made_by_evidence }
    : { value: 'unknown', confidence: 0.2, source: 'assumed', evidence: '' };

  if (ai && ai.garment === 'beanie' && ai.direction === 'side_to_side') {
    notes.push(t('Side-to-side hats are written here as bottom-up, which gives the same size.', 'Los gorros de lado a lado se escriben acá de abajo hacia arriba, con el mismo tamaño.'));
  }

  return {
    inputKind: ai
      ? { value: ai.input_kind, confidence: 0.8, source: 'ai', evidence: '' }
      : { value: 'knitted_item', confidence: 0.3, source: 'assumed', evidence: '' },
    garment,
    stitch,
    edgeStitch,
    method,
    direction,
    foldedBrim,
    crownWedges,
    colorwork: colorsFinding,
    madeBy,
    yarnWeight: ai
      ? { value: ai.yarn_weight, confidence: scaleAi(ai.yarn_confidence, quality) * 0.7, source: 'ai', evidence: '' }
      : { value: 'Worsted / Aran', confidence: 0.2, source: 'assumed', evidence: '' },
    needleMm: ai
      ? { value: ai.needle_mm, confidence: scaleAi(ai.yarn_confidence, quality) * 0.7, source: 'ai', evidence: '' }
      : { value: 4.5, confidence: 0.2, source: 'assumed', evidence: '' },
    features: ai?.features ?? [],
    title: ai?.title ?? '',
    notes,
    reply: ai?.reply_to_knitter ?? '',
    nextPhoto:
      ai && ai.best_next_photo !== 'none' ? { slot: ai.best_next_photo, reason: ai.best_next_photo_reason } : null,
    howTo: ai?.how_to_steps ?? [],
  };
}

const SETTLED_FIELDS = ['garment', 'stitch', 'edgeStitch', 'method', 'direction', 'foldedBrim', 'crownWedges', 'colorwork', 'madeBy', 'yarnWeight', 'needleMm'] as const;

/** What the knitter has settled, in the words the AI is told. */
export function knownFacts(decoded: Decoded): string[] {
  const names: Record<(typeof SETTLED_FIELDS)[number], string> = {
    garment: 'The piece is',
    stitch: 'The main stitch is',
    edgeStitch: 'The brim or edge stitch is',
    method: 'It was worked',
    direction: 'It was worked in the direction',
    foldedBrim: 'Folded brim',
    crownWedges: 'Crown wedges',
    colorwork: 'The colour layout is',
    madeBy: 'It was made by',
    yarnWeight: 'The yarn weight is',
    needleMm: 'The needle in mm is',
  };
  return SETTLED_FIELDS.flatMap((field) => {
    const finding = decoded[field] as Finding<unknown>;
    return finding.source === 'you' ? [`${names[field]}: ${String(finding.value)}`] : [];
  });
}

/** A new AI reading can never overrule an answer the knitter gave about the real piece. */
export function keepYourAnswers(previous: Decoded, next: Decoded): Decoded {
  const merged: Decoded = { ...next };
  for (const field of SETTLED_FIELDS) {
    const old = previous[field] as Finding<unknown>;
    if (old.source === 'you') (merged as unknown as Record<string, unknown>)[field] = old;
  }
  return merged;
}

export interface DecodedChange {
  field: string;
  from: string;
  to: string;
}

/** Plain list of what a correction changed, so that the knitter can see the effect. */
export function describeChanges(previous: Decoded, next: Decoded, lang: Lang): DecodedChange[] {
  const t = tr(lang);
  const stitch = (v: unknown) => (v === 'same' ? t('same as main', 'igual al principal') : stitchWord(v as StitchType, lang));
  const garments: Record<GarmentType, string> = {
    beanie: t('Hat', 'Gorro'),
    scarf: t('Scarf', 'Bufanda'),
    cowl: t('Cowl', 'Cuello'),
    pullover: t('Sweater', 'Pulóver'),
    cardigan: t('Cardigan', 'Saco'),
    swatch: t('Just fabric', 'Solo tejido'),
    other: t('Something else', 'Otra cosa'),
  };
  const methods: Record<string, string> = { round: t('In the round', 'En redondo'), flat: t('Flat', 'Plano'), unknown: t('Unknown', 'Sin saber') };
  const directions: Record<string, string> = {
    bottom_up: t('From the brim up', 'Desde el puño'),
    top_down: t('From the top down', 'Desde la punta'),
    side_to_side: t('Side to side', 'De lado a lado'),
    unknown: t('Unknown', 'Sin saber'),
  };
  const yesNo = (v: unknown) => (v ? t('Yes', 'Sí') : t('No', 'No'));
  const rows: [string, unknown, unknown, (v: unknown) => string][] = [
    [t('Piece', 'Prenda'), previous.garment.value, next.garment.value, (v) => garments[v as GarmentType]],
    [t('Main stitch', 'Punto principal'), previous.stitch.value, next.stitch.value, stitch],
    [t('Brim or edge stitch', 'Punto del puño o borde'), previous.edgeStitch.value, next.edgeStitch.value, stitch],
    [t('Method', 'Método'), previous.method.value, next.method.value, (v) => methods[v as string]],
    [t('Direction', 'Dirección'), previous.direction.value, next.direction.value, (v) => directions[v as string]],
    [t('Folded brim', 'Puño doblado'), previous.foldedBrim.value, next.foldedBrim.value, yesNo],
    [t('Crown wedges', 'Gajos'), previous.crownWedges.value, next.crownWedges.value, (v) => (v === null ? '-' : String(v))],
  ];
  return rows.flatMap(([field, from, to, show]) => (from === to ? [] : [{ field, from: show(from), to: show(to) }]));
}

/** Stitch names with what to look for, in the words a knitter would use at the table. */
export function stitchHint(stitch: StitchType, lang: Lang): string {
  const t = tr(lang);
  const hints: Record<StitchType, string> = {
    stockinette: t('Smooth columns of little Vs. The back is all bumps.', 'Columnas lisas de Vs chiquitas. Por atrás, todo bolitas.'),
    reverse_stockinette: t('Rows of bumps on the front, smooth Vs on the back.', 'Hileras de bolitas al frente, Vs lisas por atrás.'),
    garter: t('Thick horizontal ridges. Looks the same on both sides.', 'Relieves horizontales gruesos. Igual de los dos lados.'),
    rib_1x1: t('One raised column, one sunken column, stretchy.', 'Una columna alta, una hundida, elástico.'),
    rib_2x2: t('Two raised columns, two sunken columns.', 'Dos columnas altas, dos hundidas.'),
    seed_stitch: t('Grainy checkerboard of tiny bumps.', 'Damero granulado de bolitas chiquitas.'),
    moss_stitch: t('Like seed stitch, but in little blocks of two rows.', 'Como el punto arroz, pero en bloquecitos de dos vueltas.'),
    fishermans_rib: t('Plump, thick columns with deep channels and stacked bumps.', 'Columnas gorditas, con canales hondos y bolitas apiladas.'),
    brioche: t('Very plump, squishy, deep rib. Thick and spongy.', 'Elástico muy gordito y hondo. Grueso y esponjoso.'),
    cable: t('Raised ropes crossing over each other.', 'Cordones en relieve que se cruzan.'),
    lace: t('A pattern of deliberate little holes.', 'Un dibujo de agujeritos a propósito.'),
  };
  return hints[stitch];
}

export function buildQuestions(decoded: Decoded, lang: Lang): DecodeQuestion[] {
  const t = tr(lang);
  const out: DecodeQuestion[] = [];
  const open = <T,>(f: Finding<T>) => f.source !== 'you' && f.confidence < CONFIRM_BELOW;
  const cantTell = {
    value: CANT_TELL,
    label: t('I only have the picture: use the best guess', 'Solo tengo la foto: usá lo más probable'),
    hint: '',
  };

  if (open(decoded.garment)) {
    const garments: [GarmentType, string][] = [
      ['beanie', t('Hat', 'Gorro')],
      ['scarf', t('Scarf', 'Bufanda')],
      ['cowl', t('Cowl', 'Cuello')],
      ['pullover', t('Sweater', 'Pulóver')],
      ['cardigan', t('Cardigan', 'Saco')],
      ['swatch', t('Just a piece of fabric', 'Solo un pedazo de tejido')],
    ];
    out.push({
      field: 'garment',
      prompt: t('What is this piece?', '¿Qué es esta prenda?'),
      where: t('Look at the whole picture.', 'Mirá la foto entera.'),
      why: t('The steps depend on it.', 'Los pasos dependen de esto.'),
      options: [...garments.map(([value, label]) => ({ value, label, hint: '' })), cantTell],
    });
  }
  if (open(decoded.stitch)) {
    const first = [decoded.stitch.value, ...(decoded.stitch.alternatives ?? [])];
    const rest: StitchType[] = ['stockinette', 'rib_1x1', 'rib_2x2', 'garter', 'seed_stitch', 'fishermans_rib', 'reverse_stockinette', 'cable', 'lace'];
    const ordered = [...new Set([...first, ...rest])].slice(0, 8);
    out.push({
      field: 'stitch',
      prompt: t('Which of these matches the fabric?', '¿Cuál de estos se parece al tejido?'),
      where: t('Look at the marked spot, and try the stitch map too.', 'Mirá el lugar marcado, y probá también el mapa de puntos.'),
      why: t('This is the hardest thing to read from a photo, and every row depends on it. Compare with the picture, or with the piece if you have it.', 'Es lo más difícil de leer en una foto, y de esto depende cada vuelta. Comparalo con la foto, o con la prenda si la tenés.'),
      options: [...ordered.map((value) => ({ value, label: stitchWord(value, lang), hint: stitchHint(value, lang) })), cantTell],
    });
  }
  if (open(decoded.method) && methodMatters(decoded.garment.value)) {
    out.push({
      field: 'method',
      prompt: t('Is there a seam?', '¿Tiene costura?'),
      where: t('Look for a straight vertical line, especially at the side or back.', 'Buscá una línea vertical recta, sobre todo al costado o atrás.'),
      why: t('A seam means it was worked flat, turning at each row. No seam means in the round, always on the front. This changes which stitches you make.', 'Con costura se tejió plano, girando en cada hilera. Sin costura, en redondo, siempre del derecho. Esto cambia qué puntos hacés.'),
      options: [
        { value: 'round', label: t('No seam: in the round', 'Sin costura: en redondo'), hint: t('The fabric goes all the way around without a join.', 'El tejido da toda la vuelta sin unión.') },
        { value: 'flat', label: t('Has a seam: flat', 'Con costura: plano'), hint: t('A vertical line where two edges were sewn.', 'Una línea vertical donde se cosieron dos bordes.') },
        cantTell,
      ],
    });
  }
  if (open(decoded.edgeStitch) && decoded.garment.value === 'beanie') {
    const brims: StitchType[] = ['rib_1x1', 'rib_2x2', 'garter'];
    out.push({
      field: 'edgeStitch',
      prompt: t('Is the brim a different stitch from the body?', '¿El puño es de otro punto que el cuerpo?'),
      where: t('Compare the marked brim with the fabric above it.', 'Compará el puño marcado con el tejido de arriba.'),
      why: t('A brim is often rib, even when the body is not. Getting it right also sets which needle you use for it.', 'El puño suele ser elástico aunque el cuerpo no lo sea. Esto también define qué aguja usás para hacerlo.'),
      options: [
        { value: 'same', label: t('No, the same all over', 'No, igual en toda la prenda'), hint: '' },
        ...brims.map((value) => ({ value, label: stitchWord(value, lang), hint: stitchHint(value, lang) })),
        cantTell,
      ],
    });
  }
  if (open(decoded.foldedBrim) && decoded.garment.value === 'beanie') {
    out.push({
      field: 'foldedBrim',
      prompt: t('Is the brim folded up?', '¿El puño está doblado?'),
      where: t('Look at the marked brim: is there a fold along its edge?', 'Mirá el puño marcado: ¿hay un doblez en el borde?'),
      why: t('A folded brim is knitted twice as tall.', 'Un puño doblado se teje el doble de alto.'),
      options: [
        { value: 'true', label: t('Yes, double thickness', 'Sí, doble grosor'), hint: '' },
        { value: 'false', label: t('No, single layer', 'No, una sola capa'), hint: '' },
        cantTell,
      ],
    });
  }
  if (open(decoded.crownWedges) && decoded.garment.value === 'beanie') {
    const ribbed = ['rib_1x1', 'rib_2x2'].includes(decoded.stitch.value);
    out.push({
      field: 'crownWedges',
      prompt: t('How does the top of the hat come together?', '¿Cómo se junta la punta del gorro?'),
      where: t('Look at the marked top.', 'Mirá la punta marcada.'),
      why: t('This decides how the crown is shaped, and it shows on the finished hat.', 'Esto define cómo se da forma a la coronilla, y se nota en el gorro terminado.'),
      options: [
        ...(ribbed
          ? [{ value: 'null', label: t('The ribs run into the centre', 'Los elásticos llegan al centro'), hint: t('Columns meet at the top with no separate lines.', 'Las columnas se juntan arriba, sin líneas aparte.') }]
          : []),
        ...[4, 6, 8].map((n) => ({
          value: String(n),
          label: t(`${n} lines of decreases`, `${n} líneas de disminuciones`),
          hint: t('Count the lines where the fabric narrows toward the top.', 'Contá las líneas donde el tejido se angosta hacia arriba.'),
        })),
        cantTell,
      ],
    });
  }
  if (open(decoded.madeBy) && decoded.garment.value !== 'swatch') {
    out.push({
      field: 'madeBy',
      prompt: t('Does it look handmade or machine-made?', '¿Parece hecho a mano o a máquina?'),
      where: t('Look at how even the stitches are, and at the edge if it shows.', 'Mirá qué tan parejos son los puntos, y el borde si se ve.'),
      why: t('Machines use finer yarn and stitches hands cannot match. If so, you will get the closest hand-knit version.', 'Las máquinas usan hilos más finos y puntos que no se pueden igualar a mano. En ese caso te doy la versión a mano más parecida.'),
      options: [
        { value: 'hand', label: t('Handmade', 'A mano'), hint: t('Slightly uneven stitches and a soft edge.', 'Puntos algo desparejos y borde suave.') },
        { value: 'machine', label: t('Machine-made', 'A máquina'), hint: t('Perfectly even, very fine, with a sewn or cut edge or a label.', 'Muy parejo y fino, con borde cosido o cortado, o con etiqueta.') },
        cantTell,
      ],
    });
  }
  if (open(decoded.colorwork)) {
    const choices: [ColorworkType, string, string][] = [
      ['solid', t('One colour', 'Un color'), ''],
      ['vertical_stripes', t('Vertical stripes', 'Rayas verticales'), ''],
      ['horizontal_stripes', t('Horizontal stripes', 'Rayas horizontales'), ''],
      ['stranded_motif', t('A motif, with two colours in a row', 'Un motivo, con dos colores en la vuelta'), t('Like Fair Isle. The colours follow the stitch grid.', 'Como el Fair Isle. Los colores siguen la grilla de puntos.')],
      ['color_block', t('Big blocks of colour', 'Grandes bloques de color'), ''],
      ['variegated', t('One multicoloured yarn', 'Una lana matizada'), t('The colour changes by itself, in small flecks.', 'El color cambia solo, en pintitas.')],
    ];
    out.push({
      field: 'colorwork',
      prompt: t('How are the colours arranged?', '¿Cómo están los colores?'),
      where: t('Look where one colour meets another.', 'Mirá donde un color se junta con otro.'),
      why: t('Each arrangement is knitted a different way.', 'Cada disposición se teje de otra forma.'),
      options: [...choices.map(([value, label, hint]) => ({ value, label, hint })), cantTell],
    });
  }
  if (open(decoded.yarnWeight)) {
    const sizes: [YarnWeightCategory, string][] = [
      ['Super Bulky', t('About 2', 'Unos 2')],
      ['Chunky / Bulky', t('About 3', 'Unos 3')],
      ['Worsted / Aran', t('About 4', 'Unos 4')],
      ['Sport', t('About 5', 'Unos 5')],
      ['Fingering / 4-ply', t('6 or more', '6 o más')],
    ];
    out.push({
      field: 'yarnWeight',
      prompt: t('How many stitches fit across a finger?', '¿Cuántos puntos entran en el ancho de un dedo?'),
      where: t('Only if you have the piece, or a hand or coin is in the picture.', 'Solo si tenés la prenda, o si hay una mano o una moneda en la foto.'),
      why: t('A photo has no scale. This tells me the yarn and needle.', 'Una foto no tiene escala. Esto me dice la lana y la aguja.'),
      options: [...sizes.map(([value, label]) => ({ value, label, hint: '' })), cantTell],
    });
  }
  return out;
}

/** Applies a knitter's answer. Their eyes on the real piece outrank any model or measurement. */
export function applyAnswer(decoded: Decoded, field: DecodeQuestion['field'], value: string): Decoded {
  if (value === CANT_TELL) {
    // With only a picture this cannot be checked, so the most likely answer stands.
    const current = decoded[field] as Finding<unknown>;
    return { ...decoded, [field]: { ...current, confidence: Math.max(current.confidence, CONFIRM_BELOW) } };
  }
  const you = <T,>(v: T): Finding<T> => ({ value: v, confidence: 1, source: 'you', evidence: '' });
  switch (field) {
    case 'stitch':
      return { ...decoded, stitch: { ...you(value as StitchType), alternatives: decoded.stitch.alternatives } };
    case 'garment':
      return { ...decoded, garment: you(value as GarmentType) };
    case 'edgeStitch':
      return { ...decoded, edgeStitch: you(value as StitchType | 'same') };
    case 'colorwork':
      return { ...decoded, colorwork: you(value as ColorworkType) };
    case 'yarnWeight': {
      const yarn = value as YarnWeightCategory;
      return { ...decoded, yarnWeight: you(yarn), needleMm: you(YARN_SPECS[yarn].defaultNeedle) };
    }
    case 'method':
      return { ...decoded, method: you(value as Decoded['method']['value']) };
    case 'direction':
      return { ...decoded, direction: you(value as Decoded['direction']['value']) };
    case 'foldedBrim':
      return { ...decoded, foldedBrim: you(value === 'true') };
    case 'madeBy':
      return { ...decoded, madeBy: you(value as Decoded['madeBy']['value']) };
    case 'crownWedges':
      return { ...decoded, crownWedges: you(value === 'null' ? null : parseInt(value, 10)) };
  }
}

/** A scarf or test swatch is always written flat, so how the original was worked changes nothing. */
export function methodMatters(garment: GarmentType): boolean {
  return garment !== 'swatch' && garment !== 'scarf';
}

export function overallConfidence(decoded: Decoded): number {
  return Math.min(decoded.stitch.confidence, decoded.garment.confidence);
}

export function isReadyToCompile(decoded: Decoded): boolean {
  // How the original was worked is often invisible in a picture and either way gives the same look,
  // so it is asked about but never holds the pattern back.
  return (
    decoded.inputKind.value !== 'crochet' &&
    decoded.stitch.confidence >= CONFIRM_BELOW &&
    decoded.garment.confidence >= CONFIRM_BELOW
  );
}

/** Craft Yarn Council bands: stockinette stitches per 10 cm to yarn weight and needle. */
export function yarnFromGauge(stsPer10cm: number): { weight: YarnWeightCategory; needle: number } {
  if (stsPer10cm >= 27) return { weight: 'Fingering / 4-ply', needle: 3 };
  if (stsPer10cm >= 23) return { weight: 'Sport', needle: 3.5 };
  if (stsPer10cm >= 20) return { weight: 'DK / Light Worsted', needle: 4 };
  if (stsPer10cm >= 16) return { weight: 'Worsted / Aran', needle: 4.5 };
  if (stsPer10cm >= 12) return { weight: 'Chunky / Bulky', needle: 6 };
  return { weight: 'Super Bulky', needle: 9 };
}

/**
 * A photo has no scale, so gauge needs one real measurement. With the width of the piece in cm
 * and the stitches counted across it in pixels, the stitch size in the photo becomes real.
 */
export function gaugeFromWidth(reading: FabricReading, widthCm: number) {
  const { pxPerStitch, pxPerRow } = reading.texture;
  if (!pxPerStitch || widthCm <= 0) return null;
  const stitchesAcross = reading.segment.box.width / pxPerStitch;
  const stsPer10cm = (stitchesAcross / widthCm) * 10;
  const rowsPer10cm = pxPerRow ? stsPer10cm * (pxPerStitch / pxPerRow) : null;
  if (stsPer10cm < 4 || stsPer10cm > 60) return null;
  return {
    stsPer10cm: Math.round(stsPer10cm * 2) / 2,
    rowsPer10cm: rowsPer10cm ? Math.round(rowsPer10cm * 2) / 2 : null,
    stitchesAcross: Math.round(stitchesAcross),
  };
}

export function stripesFromReading(reading: FabricReading, colorwork: ColorworkType, lang: Lang): StripeDefinition[] {
  const { colors, stripeWidthPx, stripeHeightPx } = reading.colors;
  const stitch = reading.texture.pxPerStitch;
  const row = reading.texture.pxPerRow;
  const accentShare = Math.max(0.01, 1 - (colors[0]?.share ?? 1));
  const accentCount = Math.max(1, colors.length - 1);
  const avgWidth = stripeWidthPx && stitch ? Math.max(1, Math.round(stripeWidthPx / stitch)) : 2;
  const avgHeight = stripeHeightPx && row ? Math.max(1, Math.round(stripeHeightPx / row)) : 2;
  return colors.map((color, i) => {
    const widthAccent = Math.max(1, Math.round((avgWidth * color.share * accentCount) / accentShare));
    const widthBase = Math.max(1, Math.round((avgWidth * (colors[0]?.share ?? 1) * accentCount) / accentShare));
    const heightBase = Math.max(1, Math.round((avgHeight * (colors[0]?.share ?? 1)) / accentShare));
    return {
      colorName: lang === 'es' ? color.name.es : color.name.en,
      hex: color.hex,
      widthStsEstimate: colorwork === 'solid' ? 1 : i === 0 ? widthBase : widthAccent,
      heightRowsEstimate: i === 0 ? heightBase : avgHeight,
      role: i === 0 ? 'base' : i === 1 ? 'stripe' : 'accent',
    };
  });
}

/** Turns the conclusions into the compiler's input. Unknowns stay visible as low confidence. */
export function toBlueprint(decoded: Decoded, reading: FabricReading | null, lang: Lang): KnitBlueprint {
  const t = tr(lang);
  const edge = decoded.edgeStitch.value;
  const colorwork = decoded.colorwork.value;
  const stripes = reading ? stripesFromReading(reading, colorwork, lang) : undefined;
  return {
    garmentType: decoded.garment.value,
    title: decoded.title || t('My piece', 'Mi prenda'),
    description: '',
    construction: constructionFrom(decoded.method.value, decoded.direction.value, decoded.garment.value),
    mainStitch: decoded.stitch.value,
    secondaryStitch: edge === 'same' ? undefined : edge,
    hasFoldedBrim: decoded.foldedBrim.value,
    crownWedges: decoded.crownWedges.value ?? undefined,
    // Decrease lines only count once someone is sure of them. Otherwise ribs run to the centre.
    crownStyle:
      decoded.crownWedges.value !== null && (decoded.crownWedges.source === 'you' || decoded.crownWedges.confidence >= CONFIRM_BELOW)
        ? 'wedges'
        : 'ribs',
    colorworkType: colorwork,
    stripes,
    features: decoded.features,
    suggestedYarnWeight: decoded.yarnWeight.value,
    suggestedNeedleMm: decoded.needleMm.value,
    difficulty: difficultyOf(decoded),
    confidenceScore: overallConfidence(decoded),
    madeBy: decoded.madeBy.value,
    visionNotes: decoded.notes.join(' '),
    // Where the compiler can write every row, its checked steps are the ones to follow.
    aiSteps:
      !STITCHES[decoded.stitch.value].compilable ||
      !['beanie', 'scarf', 'cowl'].includes(decoded.garment.value) ||
      decoded.colorwork.value === 'stranded_motif'
        ? decoded.howTo
        : undefined,
  };
}

function difficultyOf(decoded: Decoded): KnitBlueprint['difficulty'] {
  const stitch = decoded.stitch.value;
  if (stitch === 'cable' || stitch === 'lace' || stitch === 'brioche' || decoded.colorwork.value === 'stranded_motif') return 'Advanced';
  if (stitch === 'fishermans_rib' || decoded.colorwork.value === 'vertical_stripes') return 'Intermediate';
  if (decoded.garment.value === 'beanie' || decoded.garment.value === 'cowl') return 'Advanced Beginner';
  return 'Beginner';
}

/** A blank slate for knitters who already know the stitch, or who have no photo at all. */
export function manualDecoded(lang: Lang): Decoded {
  const t = tr(lang);
  const pick = <T,>(value: T, confidence = 0.2): Finding<T> => ({ value, confidence, source: 'assumed', evidence: '' });
  return {
    inputKind: { value: 'knitted_item', confidence: 1, source: 'you', evidence: '' },
    garment: pick<GarmentType>('beanie'),
    stitch: pick<StitchType>('rib_1x1'),
    edgeStitch: pick<StitchType | 'same'>('same'),
    method: pick<Decoded['method']['value']>('round', 0.3),
    direction: pick<Decoded['direction']['value']>('bottom_up', 0.3),
    foldedBrim: pick(false, 0.25),
    crownWedges: pick<number | null>(null),
    colorwork: { value: 'solid', confidence: 1, source: 'you', evidence: '' },
    madeBy: { value: 'unknown', confidence: 1, source: 'you', evidence: '' },
    yarnWeight: pick<YarnWeightCategory>('Worsted / Aran'),
    needleMm: pick(4.5),
    features: [],
    title: t('My piece', 'Mi prenda'),
    notes: [],
    reply: '',
    nextPhoto: null,
    howTo: [],
  };
}
