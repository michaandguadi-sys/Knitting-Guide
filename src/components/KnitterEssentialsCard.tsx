import React, { useState } from 'react';
import {
  Ruler,
  Scissors,
  Check,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Sliders,
} from 'lucide-react';
import { CompiledPattern, KnitUserConstraints, YarnWeightCategory } from '../types/knit';
import { Language } from '../i18n/translations';
import { YARN_NAMES_ES, sizePresetsFor } from '../engine/compiler';
import { STITCHES } from '../engine/stitches';

interface KnitterEssentialsCardProps {
  pattern: CompiledPattern;
  constraints: KnitUserConstraints;
  onUpdateConstraints: (updated: KnitUserConstraints) => void;
  lang: Language;
}

export const KnitterEssentialsCard: React.FC<KnitterEssentialsCardProps> = ({
  pattern,
  constraints,
  onUpdateConstraints,
  lang,
}) => {
  const [showAdvancedTension, setShowAdvancedTension] = useState(false);
  const isEs = lang === 'es';

  const garment = pattern.blueprint.garmentType;
  const sizeOptions = sizePresetsFor(garment, lang);
  const stitch = STITCHES[pattern.blueprint.mainStitch];
  const stitchName = isEs ? stitch.name.es : stitch.name.en;
  const inRound = pattern.allRows.some((r) => r.side === 'round');
  const sizeUnits = garment === 'scarf' ? 'width × length' : 'around × tall';

  const handleSelectSize = (opt: (typeof sizeOptions)[number]) => {
    onUpdateConstraints({
      ...constraints,
      targetSize: opt.id,
      circumferenceCm: opt.circ,
      lengthCm: opt.len,
      brimLengthCm: 'brim' in opt ? (opt.brim as number) : constraints.brimLengthCm,
    });
  };

  return (
    <div className="bg-white rounded-3xl border border-[#E8E3DC] shadow-xs p-4 sm:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#F0ECE6] pb-3">
        <div>
          <h2 className="text-lg sm:text-xl font-black text-[#1F2421]">
            {isEs ? 'Lo que necesitás para tejer' : 'What you need to knit this'}
          </h2>
          <p className="text-xs sm:text-sm text-[#6F756F]">
            {isEs
              ? 'Se recalcula al cambiar el tamaño o tu muestra.'
              : 'Recalculates when you change the size or your swatch.'}
          </p>
        </div>

        {/* Quick Size Switcher: Big, easy touch buttons */}
        <div className="flex items-center gap-1.5 bg-[#FAF8F5] p-1 rounded-2xl border border-[#DDD7CD]">
          {sizeOptions.map((opt) => {
            const isSelected = constraints.targetSize === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleSelectSize(opt)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer ${
                  isSelected
                    ? 'bg-[#2D5A43] text-white shadow-xs'
                    : 'text-[#4A504A] hover:bg-white'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4 Big Essential Highlights (The 4 things every mum knitter asks) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Card 1: Needles */}
        <div className="bg-[#FAF8F5] p-4 rounded-3xl border border-[#E8E3DC] space-y-1">
          <span className="text-[11px] font-bold text-[#6F756F] uppercase tracking-wider block">
            🥢 {isEs ? 'Agujas' : 'Needles'}
          </span>
          <div className="text-xl sm:text-2xl font-black text-[#1F2421]">
            {constraints.needleSizeMm} mm
          </div>
          <span className="text-[11px] text-[#6F756F] block leading-tight">
            {inRound ? (isEs ? 'Circulares' : 'Circular needles') : isEs ? 'Rectas o circulares' : 'Straight or circular'}
          </span>
        </div>

        {/* Card 2: Cast On */}
        <div className="bg-[#EBF2EE] p-4 rounded-3xl border border-[#D2E2D7] space-y-1">
          <span className="text-[11px] font-bold text-[#2D5A43] uppercase tracking-wider block">
            🧵 {isEs ? 'Puntos a Montar' : 'Cast On'}
          </span>
          <div className="text-xl sm:text-2xl font-black text-[#2D5A43] font-mono">
            {pattern.calculatedGauge.castOnSts} {isEs ? 'puntos' : 'sts'}
          </div>
          <span className="text-[11px] text-[#2D5A43] font-semibold block leading-tight">
            {stitchName}
          </span>
        </div>

        {/* Card 3: Yarn */}
        <div className="bg-[#FAF8F5] p-4 rounded-3xl border border-[#E8E3DC] space-y-1">
          <span className="text-[11px] font-bold text-[#6F756F] uppercase tracking-wider block">
            🧶 {isEs ? 'Lana necesaria' : 'Yarn amount'}
          </span>
          <div className="text-xl sm:text-2xl font-black text-[#1F2421]">
            ~{pattern.yarnEstimates.totalGrams} g
          </div>
          <span className="text-[11px] text-[#6F756F] block leading-tight">
            {pattern.yarnEstimates.skeinsApprox} {isEs ? 'ovillo(s) de 100 g' : '100 g skein(s)'}
          </span>
        </div>

        {/* Card 4: Size */}
        <div className="bg-[#FAF8F5] p-4 rounded-3xl border border-[#E8E3DC] space-y-1">
          <span className="text-[11px] font-bold text-[#6F756F] uppercase tracking-wider block">
            📏 {isEs ? 'Tamaño final' : 'Finished Size'}
          </span>
          <div className="text-xl sm:text-2xl font-black text-[#1F2421]">
            {pattern.finishedDimensions.circumferenceCm} × {pattern.finishedDimensions.totalLengthCm} cm
          </div>
          <span className="text-[11px] text-[#6F756F] block leading-tight">
            {pattern.blueprint.hasFoldedBrim && garment === 'beanie'
              ? isEs ? `Con puño doblado de ${pattern.finishedDimensions.brimCm} cm` : `With ${pattern.finishedDimensions.brimCm} cm folded brim`
              : isEs ? (garment === 'scarf' ? 'Ancho × largo' : 'Contorno × alto') : sizeUnits}
          </span>
        </div>
      </div>

      {/* Advanced Tension & Needle Adjustment (Accordion: collapsed by default so it doesn't scare her!) */}
      <div className="border border-[#E8E3DC] rounded-2xl overflow-hidden bg-[#FAF8F5]">
        <button
          type="button"
          onClick={() => setShowAdvancedTension(!showAdvancedTension)}
          className="w-full px-4 py-3 bg-[#FAF8F5] hover:bg-[#F3EFEA] flex items-center justify-between text-left transition cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-[#2D5A43]" />
            <span className="text-xs sm:text-sm font-bold text-[#1F2421]">
              {isEs ? '¿Querés ajustar tu muestra de tensión o el número de aguja?' : 'Want to adjust your gauge swatch or needle size?'}
            </span>
          </div>
          <div className="flex items-center gap-1 text-xs text-[#2D5A43] font-semibold">
            <span>{showAdvancedTension ? (isEs ? 'Ocultar' : 'Hide') : (isEs ? 'Ver opciones' : 'View options')}</span>
            {showAdvancedTension ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {showAdvancedTension && (
          <div className="p-4 sm:p-5 border-t border-[#E8E3DC] bg-white space-y-4 animate-in fade-in">
            <p className="text-xs text-[#6F756F]">
              {isEs
                ? 'Si tejés más apretado o más suelto, podés cambiar los puntos que te entran en 10 cm. El patrón recalcula todo automáticamente.'
                : 'If your tension differs from standard, adjust your 10cm swatch count here. The pattern recalculates automatically.'}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#1F2421] mb-1">
                  {isEs ? 'Puntos en 10 cm' : 'Stitches in 10 cm'}
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={constraints.gaugeSts10cm}
                  onChange={(e) =>
                    onUpdateConstraints({
                      ...constraints,
                      gaugeSts10cm: Math.max(4, parseFloat(e.target.value) || 18),
                    })
                  }
                  className="w-full text-sm font-bold p-2.5 bg-[#FAF8F5] border border-[#DDD7CD] rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1F2421] mb-1">
                  {isEs ? 'Vueltas en 10 cm' : 'Rows in 10 cm'}
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={constraints.gaugeRows10cm}
                  onChange={(e) =>
                    onUpdateConstraints({
                      ...constraints,
                      gaugeRows10cm: Math.max(4, parseFloat(e.target.value) || 24),
                    })
                  }
                  className="w-full text-sm font-bold p-2.5 bg-[#FAF8F5] border border-[#DDD7CD] rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1F2421] mb-1">
                  {isEs ? 'Número de Aguja' : 'Needle Size'}
                </label>
                <select
                  value={constraints.needleSizeMm}
                  onChange={(e) =>
                    onUpdateConstraints({
                      ...constraints,
                      needleSizeMm: parseFloat(e.target.value) || 4.5,
                    })
                  }
                  className="w-full text-xs font-medium p-2.5 bg-[#FAF8F5] border border-[#DDD7CD] rounded-xl"
                >
                  {[2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 7.0, 8.0, 9.0, 10.0, 12.0].map((mm) => (
                    <option key={mm} value={mm}>
                      {mm} mm
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1F2421] mb-1">
                  {isEs ? 'Grosor de Lana' : 'Yarn Weight'}
                </label>
                <select
                  value={constraints.yarnWeight}
                  onChange={(e) =>
                    onUpdateConstraints({
                      ...constraints,
                      yarnWeight: e.target.value as YarnWeightCategory,
                    })
                  }
                  className="w-full text-xs font-medium p-2.5 bg-[#FAF8F5] border border-[#DDD7CD] rounded-xl"
                >
                  {Object.keys(YARN_NAMES_ES).map((k) => (
                    <option key={k} value={k}>
                      {isEs ? YARN_NAMES_ES[k] : k}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
