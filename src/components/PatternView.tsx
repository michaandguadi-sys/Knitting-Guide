import React, { useState } from 'react';
import {
  Copy,
  Check,
  Package,
  Ruler,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react';
import { CompiledPattern } from '../types/knit';
import { Language, TRANSLATIONS } from '../i18n/translations';

interface PatternViewProps {
  pattern: CompiledPattern;
  onOpenRowTracker: () => void;
  lang: Language;
}

export const PatternView: React.FC<PatternViewProps> = ({
  pattern,
  onOpenRowTracker,
  lang,
}) => {
  const [completedSteps, setCompletedSteps] = useState<Record<number, boolean>>({});
  const [copied, setCopied] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    brim: true,
    body: true,
    crown: true,
    'full-scarf': true,
  });

  const t = TRANSLATIONS[lang];
  const isEs = lang === 'es';

  const toggleStep = (stepNumber: number) => {
    setCompletedSteps((prev) => ({
      ...prev,
      [stepNumber]: !prev[stepNumber],
    }));
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  const handleCopyText = () => {
    let text = `${pattern.title.toUpperCase()}\n`;
    text += `${isEs ? 'Calculado con KnitVision Motor Matemático' : 'Compiled by KnitVision Deterministic Engine'}\n\n`;
    text += `${isEs ? 'MEDIDAS FINALES:' : 'FINISHED MEASUREMENTS:'}\n`;
    text += `${isEs ? 'Contorno:' : 'Circumference:'} ${pattern.finishedDimensions.circumferenceCm} cm\n`;
    text += `${isEs ? 'Largo total:' : 'Total Length:'} ${pattern.finishedDimensions.totalLengthCm} cm\n\n`;
    text += `${isEs ? 'MUESTRA DE TENSIÓN:' : 'GAUGE:'}\n`;
    text += `${pattern.constraints.gaugeSts10cm} ${isEs ? 'puntos' : 'sts'} & ${pattern.constraints.gaugeRows10cm} ${isEs ? 'vueltas' : 'rows'} = 10 cm\n\n`;
    text += `${isEs ? 'MATERIALES:' : 'MATERIALS:'}\n`;
    pattern.materials.forEach((m) => (text += `• ${m}\n`));
    text += `\n${isEs ? 'INSTRUCCIONES:' : 'INSTRUCTIONS:'}\n\n`;

    pattern.sections.forEach((section) => {
      text += `=== ${section.title} ===\n`;
      section.instructions.forEach((i) => {
        text += `${i.instruction}\n`;
      });
      text += `\n`;
    });

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const totalSteps = pattern.allRows.length;
  const completedCount = Object.values(completedSteps).filter(Boolean).length;
  const progressPercent = Math.round((completedCount / (totalSteps || 1)) * 100);

  return (
    <div className="bg-white rounded-3xl border border-[#E8E3DC] shadow-xs p-4 sm:p-7 space-y-6">
      {/* Pattern Header */}
      <div className="border-b border-[#F0ECE6] pb-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#2D5A43] bg-[#E4ECE7] px-3 py-1 rounded-full">
                {pattern.blueprint.difficulty}
              </span>
              <span className="text-xs text-[#6F756F]">
                {t.compiledOn} {new Date(pattern.compiledAt).toLocaleDateString(isEs ? 'es-AR' : 'en-US')}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-[#1F2421] tracking-tight mt-1">
              {pattern.title}
            </h2>
            <p className="text-xs sm:text-sm text-[#6F756F] leading-relaxed">
              {t.patternDesc}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleCopyText}
              className="px-3.5 py-2 rounded-xl border border-[#DDD7CD] bg-[#FAF8F5] text-xs font-semibold text-[#1F2421] hover:bg-[#F3EFEA] transition flex items-center gap-1.5 shadow-2xs active:scale-95"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{t.copiedText}</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-[#2D5A43]" />
                  <span>{t.btnCopy}</span>
                </>
              )}
            </button>

            <button
              onClick={onOpenRowTracker}
              className="px-4 py-2 rounded-xl bg-[#2D5A43] text-xs font-bold text-white hover:bg-[#234734] transition flex items-center gap-1.5 shadow-xs active:scale-95"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{t.tabCounter}</span>
            </button>
          </div>
        </div>

        {/* Specs Pill Matrix */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          <div className="bg-[#FAF8F5] p-3.5 rounded-2xl border border-[#E8E3DC]">
            <span className="text-[11px] text-[#6F756F] block font-medium">{t.castOn}</span>
            <span className="text-base sm:text-lg font-extrabold text-[#1F2421] font-mono">
              {pattern.calculatedGauge.castOnSts} {isEs ? 'puntos' : 'sts'}
            </span>
          </div>

          <div className="bg-[#FAF8F5] p-3.5 rounded-2xl border border-[#E8E3DC]">
            <span className="text-[11px] text-[#6F756F] block font-medium">{t.finishedSize}</span>
            <span className="text-base sm:text-lg font-extrabold text-[#1F2421]">
              {pattern.finishedDimensions.circumferenceCm} × {pattern.finishedDimensions.totalLengthCm} cm
            </span>
          </div>

          <div className="bg-[#FAF8F5] p-3.5 rounded-2xl border border-[#E8E3DC]">
            <span className="text-[11px] text-[#6F756F] block font-medium">{t.gauge}</span>
            <span className="text-base sm:text-lg font-extrabold text-[#1F2421]">
              {pattern.constraints.gaugeSts10cm} {isEs ? 'p = 10 cm' : 'sts = 10 cm'}
            </span>
          </div>

          <div className="bg-[#FAF8F5] p-3.5 rounded-2xl border border-[#E8E3DC]">
            <span className="text-[11px] text-[#6F756F] block font-medium">{t.yarnRequired}</span>
            <span className="text-base sm:text-lg font-extrabold text-[#1F2421]">
              ~{pattern.yarnEstimates.totalGrams} g ({pattern.yarnEstimates.totalMeters} m)
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-xs text-[#6F756F]">
            <span>
              {t.knittingProgress}: {completedCount} / {totalSteps} {isEs ? 'pasos realizados' : 'steps completed'}
            </span>
            <span className="font-bold text-[#2D5A43]">{progressPercent}% {t.completed}</span>
          </div>
          <div className="w-full h-2.5 rounded-full bg-[#EFECE6] overflow-hidden">
            <div
              className="h-full bg-[#2D5A43] transition-all duration-300 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Materials & Yarn breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-[#FAF8F5] p-4 sm:p-5 rounded-2xl border border-[#E8E3DC] space-y-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#1F2421] flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5 text-[#2D5A43]" />
            {t.materialsTitle}
          </h3>
          <ul className="text-xs sm:text-sm text-[#4A504A] space-y-2 list-disc list-inside">
            {pattern.materials.map((m, idx) => (
              <li key={idx} className="leading-relaxed">
                {m}
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-[#FAF8F5] p-4 sm:p-5 rounded-2xl border border-[#E8E3DC] space-y-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#1F2421] flex items-center gap-1.5">
            <Ruler className="w-3.5 h-3.5 text-[#2D5A43]" />
            {t.colorwayTitle}
          </h3>
          {pattern.yarnEstimates.colorBreakdown ? (
            <div className="space-y-2">
              {pattern.yarnEstimates.colorBreakdown.map((color, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs sm:text-sm">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-black/10 shadow-xs"
                      style={{ backgroundColor: color.hex }}
                    />
                    <span className="font-medium text-[#1F2421]">{color.colorName}</span>
                  </div>
                  <span className="font-mono text-[#6F756F]">
                    {color.grams} g ({color.percentage}%)
                  </span>
                </div>
              ))}
              <div className="text-[11px] text-[#6F756F] border-t border-[#E8E3DC] pt-1.5">
                {t.totalSkeinsNote}: ~{pattern.yarnEstimates.skeinsApprox} {isEs ? 'madejas de 100g' : 'skeins of 100g'}
              </div>
            </div>
          ) : (
            <div className="text-xs sm:text-sm text-[#4A504A]">
              {t.singleColorNote}: {pattern.yarnEstimates.totalGrams} g ({pattern.yarnEstimates.totalMeters} m). ~{pattern.yarnEstimates.skeinsApprox} {isEs ? 'madejas' : 'skeins'}.
            </div>
          )}
        </div>
      </div>

      {/* Row-by-Row Written Instructions */}
      <div className="space-y-4">
        <h3 className="text-lg sm:text-xl font-bold text-[#1F2421]">
          {t.rowByRowTitle}
        </h3>

        {pattern.sections.map((section) => {
          const isExpanded = expandedSections[section.id] ?? true;
          return (
            <div
              key={section.id}
              className="border border-[#E8E3DC] rounded-2xl overflow-hidden bg-white shadow-2xs"
            >
              <button
                type="button"
                onClick={() => toggleSection(section.id)}
                className="w-full px-4 sm:px-5 py-3.5 bg-[#FAF8F5] hover:bg-[#F3EFEA] flex items-center justify-between border-b border-[#E8E3DC] text-left transition"
              >
                <div>
                  <h4 className="text-sm sm:text-base font-bold text-[#1F2421]">{section.title}</h4>
                  <span className="text-xs text-[#6F756F]">{section.subtitle}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-[#6F756F]">
                  <span className="hidden sm:inline">{t.endsWidth}: {section.endingStitchCount} {isEs ? 'p.' : 'sts'}</span>
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </button>

              {isExpanded && (
                <div className="divide-y divide-[#F4F1EA]">
                  {section.instructions.map((inst) => {
                    const isDone = completedSteps[inst.stepNumber];
                    return (
                      <div
                        key={inst.stepNumber}
                        onClick={() => toggleStep(inst.stepNumber)}
                        className={`p-4 sm:p-5 flex items-start gap-3.5 transition cursor-pointer select-none active:bg-[#EFECE6] ${
                          isDone ? 'bg-[#F9FAF8] text-[#8C938C]' : 'hover:bg-[#FAF8F5]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(isDone)}
                          onChange={() => toggleStep(inst.stepNumber)}
                          className="w-5 h-5 mt-0.5 rounded-md text-[#2D5A43] focus:ring-[#2D5A43] cursor-pointer"
                        />
                        <div className="flex-1 space-y-1.5">
                          <p className={`text-sm sm:text-base leading-relaxed ${isDone ? 'line-through text-[#8C938C]' : 'text-[#1F2421] font-medium'}`}>
                            {inst.instruction}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-[#6F756F] flex-wrap">
                            <span className="font-mono bg-[#EFECE6] px-2 py-0.5 rounded-md font-semibold text-[#1F2421]">
                              {t.stitchCountLabel}: {inst.stitchCountAfter} {isEs ? 'p.' : 'sts'}
                            </span>
                            {inst.repeatCount && (
                              <span className="bg-[#E4ECE7] text-[#2D5A43] px-2 py-0.5 rounded-md font-bold">
                                {inst.repeatCount} {t.repeatRounds}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Standard Abbreviations Guide */}
      <div className="bg-[#FAF8F5] p-4 sm:p-5 rounded-2xl border border-[#E8E3DC] space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-[#1F2421]">
          {t.abbreviationsTitle}
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 text-xs text-[#4A504A]">
          {pattern.abbreviations.map((item, idx) => (
            <div key={idx} className="flex gap-2 bg-white p-2.5 rounded-xl border border-[#E8E3DC]">
              <span className="font-bold font-mono text-[#2D5A43]">{item.abbr}:</span>
              <span>{item.definition}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
