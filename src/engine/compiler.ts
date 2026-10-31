import {
  CompiledPattern,
  KnitBlueprint,
  KnitUserConstraints,
  PatternRowInstruction,
  PatternSection,
  ChartGrid,
  ChartCell,
  YarnEstimate,
} from '../types/knit';

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

/**
 * Find greatest common divisor
 */
function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/**
 * Find least common multiple
 */
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
  // Add 12% safety margin for swatching, tension variance, and finishing tails
  const baseGrams = finishedAreaCm2 * spec.gramPerCm2 * 1.12;
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

/**
 * Generate standard abbreviation glossary in specified language
 */
export function getStandardAbbreviations(
  blueprint: KnitBlueprint,
  lang: 'en' | 'es' = 'es'
): { abbr: string; definition: string }[] {
  if (lang === 'es') {
    const common = [
      { abbr: 'M', definition: 'Montar puntos en la aguja de forma elástica' },
      { abbr: 'D', definition: 'Punto del derecho' },
      { abbr: 'R', definition: 'Punto del revés' },
      { abbr: '2pjD', definition: '2 puntos juntos al derecho (disminución hacia la derecha / k2tog)' },
      { abbr: 'SS', definition: 'Surjete simple: deslizar 1 punto, tejer 1 punto derecho, montar el deslizado sobre él (disminución hacia la izquierda / ssk)' },
      { abbr: 'MIV', definition: 'Marcador de inicio de vuelta' },
      { abbr: 'SM', definition: 'Deslizar marcador de una aguja a la otra' },
      { abbr: 'Vta(s)', definition: 'Vuelta(s) tejidas en redondo' },
      { abbr: 'LD / LR', definition: 'Lado del derecho / Lado del revés del tejido' },
      { abbr: 'p.', definition: 'Punto(s)' },
      { abbr: 'Cerrar', definition: 'Cerrar puntos flojo como se presentan' },
    ];
    return common;
  }

  const common = [
    { abbr: 'CO', definition: 'Cast on stitches using preferred stretchy method' },
    { abbr: 'BO', definition: 'Bind off stitches loosely in pattern' },
    { abbr: 'K', definition: 'Knit stitch' },
    { abbr: 'P', definition: 'Purl stitch' },
    { abbr: 'PM', definition: 'Place stitch marker' },
    { abbr: 'SM', definition: 'Slip stitch marker from left to right needle' },
    { abbr: 'BOR', definition: 'Beginning of round marker' },
    { abbr: 'Rnd(s)', definition: 'Round(s) in circular knitting' },
    { abbr: 'RS / WS', definition: 'Right Side / Wrong Side of fabric' },
    { abbr: 'st(s)', definition: 'Stitch(es)' },
    { abbr: 'k2tog', definition: 'Knit 2 stitches together (right-leaning single decrease)' },
    { abbr: 'ssk', definition: 'Slip, slip, knit slipped stitches together through back loop (left-leaning single decrease)' },
  ];

  if (blueprint.mainStitch === 'brioche') {
    common.push(
      { abbr: 'brk', definition: 'Brioche knit stitch (knit st together with yarnover)' },
      { abbr: 'brp', definition: 'Brioche purl stitch (purl st together with yarnover)' },
      { abbr: 'sl1yo', definition: 'Slip 1 stitch purlwise while creating a yarnover' }
    );
  }

  return common;
}

/**
 * Generates an interactive stitch chart for beanie repeat / crown shaping
 */
export function generateBeanieChart(
  castOnSts: number,
  wedges: number,
  mainStitch: KnitBlueprint['mainStitch'],
  stripes?: KnitBlueprint['stripes'],
  lang: 'en' | 'es' = 'es'
): ChartGrid {
  const isEs = lang === 'es';
  const wedgeWidth = Math.min(24, Math.floor(castOnSts / wedges));
  const rows = 12;
  const cols = wedgeWidth;

  const cells: ChartCell[][] = [];
  const rowLabels: number[] = [];

  for (let r = 0; r < rows; r++) {
    const rowNum = rows - r; // knitting charts read bottom-up
    rowLabels.push(rowNum);
    const rowCells: ChartCell[] = [];

    const activeCols = Math.max(2, Math.floor(cols - r * 1.5));
    const padLeft = Math.floor((cols - activeCols) / 2);

    for (let c = 0; c < cols; c++) {
      const colNum = cols - c; // charts read right-to-left for RS
      if (c < padLeft || c >= padLeft + activeCols) {
        rowCells.push({
          row: rowNum,
          col: colNum,
          stitchType: 'no_stitch',
          symbol: ' ',
          name: isEs ? 'Sin punto' : 'No stitch',
        });
      } else if (c === padLeft && r > 0 && r % 2 === 1) {
        rowCells.push({
          row: rowNum,
          col: colNum,
          stitchType: 'ssk',
          symbol: '\\',
          name: isEs ? 'Surjete Simple (Disminución Izq.)' : 'SSK (Left decrease)',
        });
      } else if (c === padLeft + activeCols - 1 && r > 0 && r % 2 === 1) {
        rowCells.push({
          row: rowNum,
          col: colNum,
          stitchType: 'k2tog',
          symbol: '/',
          name: isEs ? '2 Puntos Juntos al Der. (Disminución Der.)' : 'k2tog (Right decrease)',
        });
      } else {
        const isKnit = mainStitch === 'stockinette' || (colNum % 2 === 1);
        const stripeColor = stripes && stripes.length > 0 ? stripes[colNum % stripes.length]?.hex : undefined;
        rowCells.push({
          row: rowNum,
          col: colNum,
          stitchType: isKnit ? 'K' : 'P',
          colorHex: stripeColor,
          symbol: isKnit ? '|' : '–',
          name: isKnit ? (isEs ? 'Derecho' : 'Knit') : (isEs ? 'Revés' : 'Purl'),
        });
      }
    }
    cells.push(rowCells);
  }

  return {
    rows,
    cols,
    cells,
    rowLabels,
    legend: isEs
      ? [
          { symbol: '|', name: 'Punto Derecho', description: 'Tejer del derecho por delante en la vuelta' },
          { symbol: '–', name: 'Punto Revés', description: 'Tejer del revés con hebra adelante' },
          { symbol: '/', name: '2 Puntos Juntos Derecho', description: 'Disminución con inclinación hacia la derecha' },
          { symbol: '\\', name: 'Surjete Simple (SS)', description: 'Disminución con inclinación hacia la izquierda' },
        ]
      : [
          { symbol: '|', name: 'Knit', description: 'Knit stitch on RS / in the round' },
          { symbol: '–', name: 'Purl', description: 'Purl stitch on RS / in the round' },
          { symbol: '/', name: 'k2tog', description: 'Knit 2 together (right-slanting decrease)' },
          { symbol: '\\', name: 'ssk', description: 'Slip, slip, knit (left-slanting decrease)' },
        ],
  };
}

/**
 * Deterministic Beanie Pattern Compiler
 */
export function compileBeaniePattern(
  blueprint: KnitBlueprint,
  constraints: KnitUserConstraints
): CompiledPattern {
  const lang = constraints.language || 'es';
  const isEs = lang === 'es';
  const { gaugeSts10cm, gaugeRows10cm, circumferenceCm, lengthCm, easeCm, needleSizeMm } = constraints;
  const stsPerCm = gaugeSts10cm / 10;
  const rowsPerCm = gaugeRows10cm / 10;

  // Hat circumference target with negative ease for snug fit
  const targetCircumference = Math.max(38, circumferenceCm + easeCm);
  const rawSts = targetCircumference * stsPerCm;

  const wedges = blueprint.crownWedges && blueprint.crownWedges > 0 ? blueprint.crownWedges : 4;

  let stitchRepeat = 2; // 1x1 rib
  if (blueprint.mainStitch === 'rib_2x2') stitchRepeat = 4;
  else if (blueprint.mainStitch === 'brioche') stitchRepeat = 2;

  const requiredDivisor = lcm(stitchRepeat, wedges * 2);
  const castOnSts = roundToMultiple(rawSts, requiredDivisor);
  const finishedCircumference = Math.round((castOnSts / stsPerCm) * 10) / 10;

  const hasFolded = blueprint.hasFoldedBrim ?? true;
  const targetBrimHeight = constraints.brimLengthCm || Math.round(lengthCm * 0.35 * 10) / 10;
  const knitBrimHeight = hasFolded ? targetBrimHeight * 2 : targetBrimHeight;
  const brimRows = Math.max(8, Math.round(knitBrimHeight * rowsPerCm));

  const decsPerRound = wedges * 2;
  const minCrownSts = wedges * 2;
  const totalStsToDecrease = castOnSts - minCrownSts;
  const decRoundsCount = Math.floor(totalStsToDecrease / decsPerRound);
  
  const crownRows = decRoundsCount * 2;
  const crownHeightCm = crownRows / rowsPerCm;

  const remainingHeightCm = Math.max(2, lengthCm - (targetBrimHeight + crownHeightCm));
  const bodyRows = Math.max(6, Math.round(remainingHeightCm * rowsPerCm));
  const totalRows = brimRows + bodyRows + crownRows;

  const finishedArea = finishedCircumference * (lengthCm + (hasFolded ? targetBrimHeight : 0));
  const yarnEstimates = calculateYarnEstimate(blueprint, constraints, finishedArea);

  const sections: PatternSection[] = [];
  const allRows: PatternRowInstruction[] = [];
  let stepCounter = 1;

  // Section 1: Cast On & Brim
  const brimInstructions: PatternRowInstruction[] = [];
  const coText = isEs
    ? `Con agujas circulares de ${needleSizeMm} mm (cable de 40 cm) o agujas de doble punta, montar ${castOnSts} puntos de manera elástica (método hebra larga o tubular). Colocar marcador de inicio de vuelta (MIV) y unir para tejer en redondo con cuidado de no retorcer los puntos.`
    : `Using ${needleSizeMm}mm (US ${needleToUs(needleSizeMm)}) 40cm circular needles or DPNs, cast on ${castOnSts} sts using a stretchy cast-on (German Twisted or Long-Tail). Place marker (BOR) for beginning of round and join in the round, taking care not to twist stitches.`;

  const coInstruction: PatternRowInstruction = {
    stepNumber: stepCounter++,
    sectionName: isEs ? 'Montaje y Puño Elástico' : 'Cast On & Brim',
    roundOrRow: isEs ? 'Rnd' : 'Rnd',
    number: 0,
    instruction: coText,
    stitchCountAfter: castOnSts,
  };
  brimInstructions.push(coInstruction);
  allRows.push(coInstruction);

  const ribPatternText = isEs
    ? (blueprint.mainStitch === 'rib_2x2' ? '*2 puntos derecho, 2 puntos revés; repetir desde * hasta MIV' : '*1 punto derecho, 1 punto revés; repetir desde * hasta MIV')
    : (blueprint.mainStitch === 'rib_2x2' ? '*K2, P2; rep from * to BOR' : '*K1, P1; rep from * to BOR');

  const brimRowText = isEs
    ? `Vtas 1–${brimRows}: Tejer en punto elástico ${blueprint.mainStitch === 'rib_2x2' ? '2x2' : '1x1'}: ${ribPatternText}. Deslizar marcador (SM). Tejer durante ${brimRows} vueltas (aprox. ${knitBrimHeight.toFixed(1)} cm${hasFolded ? ', lo que brinda un puño doblado de ' + targetBrimHeight.toFixed(1) + ' cm' : ''}).`
    : `Rnds 1–${brimRows}: Work in ${blueprint.mainStitch === 'rib_2x2' ? '2x2' : '1x1'} ribbing: ${ribPatternText}. Slip marker (SM) at BOR. Work for ${brimRows} rnds (approx. ${knitBrimHeight.toFixed(1)} cm${hasFolded ? ', giving a folded double-cuff height of ' + targetBrimHeight.toFixed(1) + ' cm' : ''}).`;

  const brimRowInst: PatternRowInstruction = {
    stepNumber: stepCounter++,
    sectionName: isEs ? 'Montaje y Puño Elástico' : 'Cast On & Brim',
    roundOrRow: 'Rnd',
    number: 1,
    instruction: brimRowText,
    stitchCountAfter: castOnSts,
    repeatCount: brimRows,
  };
  brimInstructions.push(brimRowInst);
  allRows.push(brimRowInst);

  sections.push({
    id: 'brim',
    title: isEs ? '1. Montaje de Puntos y Puño Elástico' : '1. Cast On & Ribbed Brim',
    subtitle: isEs
      ? `${hasFolded ? 'Puño Doblado Doble Grosor' : 'Puño Simple'} (${brimRows} vueltas)`
      : `${hasFolded ? 'Folded Double-Cuff' : 'Standard Brim'} (${brimRows} rounds)`,
    instructions: brimInstructions,
    totalRows: brimRows,
    endingStitchCount: castOnSts,
  });

  // Section 2: Hat Body
  const bodyInstructions: PatternRowInstruction[] = [];
  let bodyDesc = isEs
    ? `Continuar en el punto establecido durante ${bodyRows} vueltas`
    : `Continue in established pattern for ${bodyRows} rounds`;

  if (blueprint.stripes && blueprint.stripes.length > 1) {
    const stripeSummary = blueprint.stripes.map((s) => `${s.colorName} (${s.hex})`).join(', ');
    bodyDesc += isEs
      ? ` siguiendo el esquema de rayas verticales: ${stripeSummary}`
      : ` following vertical stripe color scheme: ${stripeSummary}`;
  }

  const bodyRowText = isEs
    ? `Vtas 1–${bodyRows}: ${bodyDesc}. Tejer hasta que la labor mida aprox. ${(lengthCm - crownHeightCm).toFixed(1)} cm desde la línea de doblado del puño.`
    : `Rnds 1–${bodyRows}: ${bodyDesc}. Work until hat measures approx. ${(lengthCm - crownHeightCm).toFixed(1)} cm from fold line (or cast-on edge).`;

  const bodyRowInst: PatternRowInstruction = {
    stepNumber: stepCounter++,
    sectionName: isEs ? 'Cuerpo del Gorro' : 'Hat Body',
    roundOrRow: 'Rnd',
    number: 1,
    instruction: bodyRowText,
    stitchCountAfter: castOnSts,
    repeatCount: bodyRows,
  };
  bodyInstructions.push(bodyRowInst);
  allRows.push(bodyRowInst);

  sections.push({
    id: 'body',
    title: isEs ? '2. Cuerpo del Gorro' : '2. Hat Body',
    subtitle: isEs ? `Sección Recta (${bodyRows} vueltas)` : `Straight Section (${bodyRows} rounds)`,
    instructions: bodyInstructions,
    totalRows: bodyRows,
    endingStitchCount: castOnSts,
  });

  // Section 3: Crown Shaping
  const crownInstructions: PatternRowInstruction[] = [];
  const prepText = isEs
    ? `Vuelta de Preparación: Dividir los puntos en ${wedges} gajos iguales (${castOnSts / wedges} puntos por gajo). Colocar ${wedges - 1} marcadores auxiliares para marcar las líneas de disminución. Pasar a agujas de doble punta a medida que disminuyan los puntos.`
    : `Set-up Round: Divide stitches into ${wedges} equal wedges (${castOnSts / wedges} sts per wedge). Place ${wedges - 1} additional stitch markers between sections to mark decrease lines. Switch to DPNs or Magic Loop as stitch count decreases.`;

  const prepInst: PatternRowInstruction = {
    stepNumber: stepCounter++,
    sectionName: isEs ? 'Disminuciones de Coronilla' : 'Crown Shaping',
    roundOrRow: 'Rnd',
    number: 0,
    instruction: prepText,
    stitchCountAfter: castOnSts,
  };
  crownInstructions.push(prepInst);
  allRows.push(prepInst);

  let currentSts = castOnSts;
  let crownRoundNumber = 1;

  for (let decIdx = 0; decIdx < decRoundsCount; decIdx++) {
    const stsPerWedgeNow = currentSts / wedges;
    const innerSts = stsPerWedgeNow - 2;
    currentSts -= decsPerRound;

    const decText = isEs
      ? `Vta ${crownRoundNumber} (Vuelta de Disminución): *1 surjete simple (SS), tejer en punto sobre los siguientes ${Math.max(0, innerSts - 2)} puntos, 2 puntos juntos al derecho (2pjD), deslizar marcador (SM); repetir desde * ${wedges} veces hasta MIV. (Quedan ${currentSts} puntos: ${currentSts / wedges} puntos por gajo).`
      : `Rnd ${crownRoundNumber} (Dec Rnd): *SSK, work in pattern across next ${Math.max(0, innerSts - 2)} sts, k2tog, SM; repeat from * ${wedges} times to BOR. (${currentSts} sts remain: ${currentSts / wedges} sts per wedge).`;

    const decInst: PatternRowInstruction = {
      stepNumber: stepCounter++,
      sectionName: isEs ? 'Disminuciones de Coronilla' : 'Crown Shaping',
      roundOrRow: 'Rnd',
      number: crownRoundNumber++,
      instruction: decText,
      stitchCountAfter: currentSts,
    };
    crownInstructions.push(decInst);
    allRows.push(decInst);

    const plainText = isEs
      ? `Vta ${crownRoundNumber} (Vuelta de Reposo): Tejer todos los puntos como se presentan sin disminuciones hasta MIV.`
      : `Rnd ${crownRoundNumber} (Plain Rnd): Work even in established stitch pattern across all stitches to BOR.`;

    const plainInst: PatternRowInstruction = {
      stepNumber: stepCounter++,
      sectionName: isEs ? 'Disminuciones de Coronilla' : 'Crown Shaping',
      roundOrRow: 'Rnd',
      number: crownRoundNumber++,
      instruction: plainText,
      stitchCountAfter: currentSts,
    };
    crownInstructions.push(plainInst);
    allRows.push(plainInst);
  }

  const finishText = isEs
    ? `Vuelta Final de Cierre: *2 puntos juntos al derecho; repetir desde * hasta MIV. (Quedan ${Math.floor(currentSts / 2)} puntos). Cortar la hebra dejando 20 cm. Enhebrar en la aguja lanera y pasar dos veces por los puntos restantes. Tirar firmemente como un cordón para cerrar el orificio superior, asegurar con nudo prolijo por el revés y esconder todas las hebras.`
    : `Final Round: *k2tog; repeat from * to BOR. (${Math.floor(currentSts / 2)} sts remain). Break yarn leaving a 20 cm (8") tail. Thread tail onto tapestry needle, thread through remaining stitches twice, pull tight like a drawstring to close hole, and secure firmly inside WS. Weave in all yarn tails.`;

  const finishInst: PatternRowInstruction = {
    stepNumber: stepCounter++,
    sectionName: isEs ? 'Disminuciones de Coronilla' : 'Crown Shaping',
    roundOrRow: 'Rnd',
    number: crownRoundNumber,
    instruction: finishText,
    stitchCountAfter: Math.floor(currentSts / 2),
  };
  crownInstructions.push(finishInst);
  allRows.push(finishInst);

  sections.push({
    id: 'crown',
    title: isEs ? '3. Disminuciones y Cierre de Coronilla' : '3. Crown Shaping & Finishing',
    subtitle: isEs
      ? `Disminuciones en ${wedges} Gajos Simétricos (${crownRows + 1} vueltas)`
      : `${wedges}-Wedge Symmetric Decrease Lines (${crownRows + 1} rounds)`,
    instructions: crownInstructions,
    totalRows: crownRows + 1,
    endingStitchCount: Math.floor(currentSts / 2),
  });

  const chartData = generateBeanieChart(castOnSts, wedges, blueprint.mainStitch, blueprint.stripes, lang);

  const yarnNameDisplay = isEs
    ? (YARN_NAMES_ES[constraints.yarnWeight] || constraints.yarnWeight)
    : `${constraints.yarnWeight} yarn`;

  const materials = isEs
    ? [
        `${yarnEstimates.totalGrams} g (${yarnEstimates.totalMeters} m) de ${yarnNameDisplay}`,
        `Agujas circulares de ${needleSizeMm} mm con cable de 40 cm`,
        `Juego de agujas de doble punta de ${needleSizeMm} mm para el cierre de la coronilla (o cable largo para Magic Loop)`,
        `${wedges} marcadores de puntos (1 de color diferente para el inicio de vuelta)`,
        'Aguja lanera sin punta para coser y rematar',
        'Centímetro de sastre para controlar medidas',
      ]
    : [
        `${yarnEstimates.totalGrams}g (${yarnEstimates.totalMeters}m) of ${constraints.yarnWeight} yarn`,
        `${needleSizeMm}mm (US ${needleToUs(needleSizeMm)}) 40cm (16") circular knitting needles`,
        `${needleSizeMm}mm Double Pointed Needles (DPNs) or 80cm circular needle for Magic Loop crown decrease`,
        `${wedges} stitch markers (1 distinct for BOR)`,
        'Tapestry yarn needle for weaving ends and closing crown',
        'Tape measure & row counter',
      ];

  const title = isEs
    ? (blueprint.title.includes('North Face')
        ? 'Gorro The North Face a Rayas y Punto Elástico'
        : `Patrón de ${blueprint.title}`)
    : (blueprint.title || 'Compiled Ribbed Beanie Pattern');

  return {
    id: `pattern-${Date.now()}`,
    title,
    blueprint,
    constraints,
    finishedDimensions: {
      circumferenceCm: finishedCircumference,
      totalLengthCm: lengthCm,
      brimCm: targetBrimHeight,
    },
    calculatedGauge: {
      stsPerCm: Math.round(stsPerCm * 100) / 100,
      rowsPerCm: Math.round(rowsPerCm * 100) / 100,
      castOnSts,
      totalRows,
    },
    yarnEstimates,
    materials,
    abbreviations: getStandardAbbreviations(blueprint, lang),
    sections,
    chartData,
    allRows,
    compiledAt: new Date().toISOString(),
  };
}

/**
 * Deterministic Scarf Pattern Compiler
 */
export function compileScarfPattern(
  blueprint: KnitBlueprint,
  constraints: KnitUserConstraints
): CompiledPattern {
  const lang = constraints.language || 'es';
  const isEs = lang === 'es';
  const { gaugeSts10cm, gaugeRows10cm, circumferenceCm, lengthCm, needleSizeMm } = constraints;
  const targetWidthCm = circumferenceCm || 22;
  const targetLengthCm = lengthCm || 160;
  const stsPerCm = gaugeSts10cm / 10;
  const rowsPerCm = gaugeRows10cm / 10;

  let repeat = 2;
  if (blueprint.mainStitch === 'rib_2x2' || blueprint.mainStitch === 'seed_stitch') repeat = 4;
  const rawSts = targetWidthCm * stsPerCm;
  const patternSts = roundToMultiple(rawSts - 4, repeat);
  const castOnSts = patternSts + 4;
  const totalRows = Math.round(targetLengthCm * rowsPerCm);

  const area = targetWidthCm * targetLengthCm;
  const yarnEstimates = calculateYarnEstimate(blueprint, constraints, area);

  const rows: PatternRowInstruction[] = [
    {
      stepNumber: 1,
      sectionName: isEs ? 'Montaje' : 'Cast On',
      roundOrRow: 'Row',
      number: 0,
      instruction: isEs
        ? `Con agujas de ${needleSizeMm} mm, montar ${castOnSts} puntos de manera floja.`
        : `Using ${needleSizeMm}mm needles, cast on ${castOnSts} sts loosely.`,
      stitchCountAfter: castOnSts,
    },
    {
      stepNumber: 2,
      sectionName: isEs ? 'Cuerpo' : 'Body',
      roundOrRow: 'Row',
      number: 1,
      instruction: isEs
        ? `Hilera 1 (LD): Deslizar 1 punto revés con hebra adelante, 1 derecho, tejer en punto sobre los siguientes ${patternSts} puntos, 1 derecho, 1 revés.`
        : `Row 1 (RS): Sl 1 purlwise with yarn in front, K1, work ${blueprint.mainStitch} across next ${patternSts} sts, K1, P1.`,
      stitchCountAfter: castOnSts,
    },
    {
      stepNumber: 3,
      sectionName: isEs ? 'Cuerpo' : 'Body',
      roundOrRow: 'Row',
      number: 2,
      instruction: isEs
        ? `Hilera 2 (LR): Deslizar 1 punto revés con hebra adelante, 1 derecho, tejer como se presenta hasta los últimos 2 puntos, 1 derecho, 1 revés.`
        : `Row 2 (WS): Sl 1 purlwise with yarn in front, K1, work in pattern to last 2 sts, K1, P1.`,
      stitchCountAfter: castOnSts,
    },
    {
      stepNumber: 4,
      sectionName: isEs ? 'Cuerpo' : 'Body',
      roundOrRow: 'Row',
      number: 3,
      instruction: isEs
        ? `Repetir las Hileras 1–2 por un total de ${totalRows} hileras (aprox. ${targetLengthCm} cm).`
        : `Repeat Rows 1–2 for a total of ${totalRows} rows (approx. ${targetLengthCm} cm).`,
      stitchCountAfter: castOnSts,
      repeatCount: totalRows - 2,
    },
    {
      stepNumber: 5,
      sectionName: isEs ? 'Cierre' : 'Bind Off',
      roundOrRow: 'Row',
      number: totalRows + 1,
      instruction: isEs
        ? `Cerrar los ${castOnSts} puntos flojamente como se presentan. Bloquear suavemente con vapor a las medidas finales (${targetWidthCm} x ${targetLengthCm} cm).`
        : `Bind off all ${castOnSts} sts loosely in pattern. Block fabric gently to finished measurements (${targetWidthCm} x ${targetLengthCm} cm).`,
      stitchCountAfter: 0,
    },
  ];

  return {
    id: `scarf-${Date.now()}`,
    title: isEs ? 'Bufanda Tejida en Punto Plano' : (blueprint.title || 'Compiled Handknit Scarf Pattern'),
    blueprint,
    constraints,
    finishedDimensions: {
      circumferenceCm: targetWidthCm,
      totalLengthCm: targetLengthCm,
    },
    calculatedGauge: {
      stsPerCm: Math.round(stsPerCm * 100) / 100,
      rowsPerCm: Math.round(rowsPerCm * 100) / 100,
      castOnSts,
      totalRows,
    },
    yarnEstimates,
    materials: isEs
      ? [
          `${yarnEstimates.totalGrams} g (${yarnEstimates.totalMeters} m) de hilado`,
          `Agujas rectas o circulares de ${needleSizeMm} mm`,
          'Aguja lanera sin punta',
        ]
      : [
          `${yarnEstimates.totalGrams}g (${yarnEstimates.totalMeters}m) of ${constraints.yarnWeight} yarn`,
          `${needleSizeMm}mm straight or circular needles`,
          'Tapestry needle',
        ],
    abbreviations: getStandardAbbreviations(blueprint, lang),
    sections: [
      {
        id: 'full-scarf',
        title: isEs ? 'Instrucciones de la Bufanda' : 'Scarf Instructions',
        subtitle: isEs ? `Tejido Plano (${totalRows} hileras)` : `Straight Flat Knitting (${totalRows} rows)`,
        instructions: rows,
        totalRows,
        endingStitchCount: castOnSts,
      },
    ],
    chartData: generateBeanieChart(castOnSts, 2, blueprint.mainStitch, blueprint.stripes, lang),
    allRows: rows,
    compiledAt: new Date().toISOString(),
  };
}

/**
 * Universal Pattern Compiler Router
 */
export function compilePattern(
  blueprint: KnitBlueprint,
  constraints: KnitUserConstraints
): CompiledPattern {
  switch (blueprint.garmentType) {
    case 'beanie':
    case 'cowl':
      return compileBeaniePattern(blueprint, constraints);
    case 'scarf':
      return compileScarfPattern(blueprint, constraints);
    default:
      return compileBeaniePattern(blueprint, constraints);
  }
}

/**
 * Helper to convert metric mm needle to US size
 */
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
