import React, { useState, useMemo } from 'react';
import {
  Copy,
  Check,
  Package,
  Ruler,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Layers,
  AlertTriangle,
  BookmarkCheck,
} from 'lucide-react';
import { CompiledPattern } from '../types/knit';
import { Language, TRANSLATIONS } from '../i18n/translations';
import { PatternSearchBar } from './PatternSearchBar';
import { StitchChart } from './StitchChart';
import { TechniqueHelp } from './TechniqueHelp';

interface PatternViewProps {
  pattern: CompiledPattern;
  onOpenRowTracker: () => void;
  lang: Language;
  onToggleStep: (stepNumber: number) => void;
  completedSteps: Record<number, boolean>;
}

export const PatternView: React.FC<PatternViewProps> = ({
  pattern,
  onOpenRowTracker,
  lang,
  onToggleStep,
  completedSteps,
}) => {
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [fullSections, setFullSections] = useState<Record<string, boolean>>({});
  const [showChart, setShowChart] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const t = TRANSLATIONS[lang];
  const isEs = lang === 'es';

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  const handleCopyText = () => {
    let text = `${pattern.title.toUpperCase()}\n`;
    text += `${isEs ? 'Calculado con KnitVision Motor Matemático' : 'Compiled by KnitVision Engine'}\n\n`;
    text += `${isEs ? 'MEDIDAS:' : 'MEASUREMENTS:'} ${pattern.finishedDimensions.circumferenceCm} × ${pattern.finishedDimensions.totalLengthCm} cm\n`;
    text += `${isEs ? 'PUNTOS A MONTAR:' : 'CAST ON:'} ${pattern.calculatedGauge.castOnSts} ${isEs ? 'puntos con aguja' : 'sts with needle'} ${pattern.constraints.needleSizeMm} mm\n\n`;
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

  // Filter instructions based on search query
  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return pattern.sections;
    const q = searchQuery.toLowerCase();

    return pattern.sections
      .map((sec) => {
        const matchingInstructions = sec.instructions.filter(
          (inst) =>
            inst.instruction.toLowerCase().includes(q) ||
            inst.sectionName.toLowerCase().includes(q)
        );
        return {
          ...sec,
          instructions: matchingInstructions,
        };
      })
      .filter((sec) => sec.instructions.length > 0);
  }, [pattern.sections, searchQuery]);

  const totalResultsCount = filteredSections.reduce(
    (acc, sec) => acc + sec.instructions.length,
    0
  );

  const totalSteps = pattern.allRows.length;
  const completedCount = Object.values(completedSteps).filter(Boolean).length;
  const progressPercent = Math.round((completedCount / (totalSteps || 1)) * 100);

  return (
    <div className="bg-white rounded-3xl border border-[#E8E3DC] shadow-xs p-4 sm:p-7 space-y-7">
      {/* Pattern Header Title & Copy Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#F0ECE6] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#2D5A43] bg-[#E4ECE7] px-2.5 py-0.5 rounded-full">
              {pattern.blueprint.difficulty}
            </span>
            <span className="text-xs text-[#6F756F]">
              {t.compiledOn} {new Date(pattern.compiledAt).toLocaleDateString(isEs ? 'es-AR' : 'en-US')}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-[#1F2421] mt-1">
            {pattern.title}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyText}
            className="px-3.5 py-2 rounded-xl border border-[#DDD7CD] bg-[#FAF8F5] text-xs font-semibold text-[#1F2421] hover:bg-[#F3EFEA] transition flex items-center gap-1.5 active:scale-95 cursor-pointer shadow-2xs"
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
            className="px-4 py-2 rounded-xl bg-[#2D5A43] text-xs font-bold text-white hover:bg-[#234734] transition flex items-center gap-1.5 shadow-xs active:scale-95 cursor-pointer"
          >
            <BookmarkCheck className="w-3.5 h-3.5" />
            <span>{isEs ? 'Modo Tejedora (Vuelta a Vuelta)' : 'Live Row Counter'}</span>
          </button>
        </div>
      </div>

      {/* How it is built, in plain language, before any instructions */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-[#1F2421] flex items-center gap-1.5">
          <Layers className="w-4 h-4 text-[#2D5A43]" />
          {isEs ? 'Cómo se construye' : 'How it is built'}
        </h3>
        <ul className="space-y-1.5 text-xs sm:text-sm text-[#4A504A] list-disc list-inside bg-[#FAF8F5] p-4 rounded-2xl border border-[#E8E3DC]">
          {pattern.howItsMade.map((line, idx) => (
            <li key={idx} className="leading-relaxed">{line}</li>
          ))}
        </ul>
        {pattern.warnings.map((warning, idx) => (
          <div
            key={idx}
            role={warning.severity === 'caution' ? 'alert' : undefined}
            className={`p-3 rounded-2xl border text-xs sm:text-sm flex gap-2 leading-relaxed ${
              warning.severity === 'caution' ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-[#F4F6F5] border-[#D5E3DC] text-[#1C3A2B]'
            }`}
          >
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{warning.message}</span>
          </div>
        ))}
        <div className={`grid grid-cols-1 gap-3.5 ${pattern.sections.length >= 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
          {pattern.sections.map((section, idx) => (
            <div key={section.id} className="bg-[#FAF8F5] p-4 rounded-2xl border border-[#E8E3DC] space-y-1.5">
              <span className="w-6 h-6 rounded-full bg-[#2D5A43] text-white text-xs font-bold flex items-center justify-center">
                {idx + 1}
              </span>
              <h4 className="font-bold text-sm text-[#1F2421]">{section.title}</h4>
              <p className="text-xs text-[#4A504A] leading-relaxed">{section.subtitle}</p>
              {section.endingStitchCount > 0 && (
                <p className="text-[11px] font-mono text-[#6F756F]">
                  {t.endsWidth}: {section.endingStitchCount} {isEs ? 'p.' : 'sts'}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {pattern.blueprint.aiSteps && pattern.blueprint.aiSteps.length > 0 && (
        <div className="space-y-3 bg-[#F4F6F5] p-4 sm:p-5 rounded-2xl border border-[#D5E3DC]">
          <div>
            <h3 className="text-sm sm:text-base font-black text-[#1F2421]">
              {isEs ? 'Cómo hacer lo que muestra la foto' : 'How to make what the picture shows'}
            </h3>
            <p className="text-xs text-[#6F756F]">
              {isEs
                ? 'Lo escribió la IA mirando tu foto. No pasó por el control de puntos como el resto, y los números pueden ser estimados, así que probalo primero en una muestra.'
                : 'Written by the AI from your picture. It has not been through the stitch check like the rest, and numbers may be estimates, so try it on a swatch first.'}
            </p>
          </div>
          <ol className="space-y-2 list-decimal list-inside text-xs sm:text-sm text-[#1F2421]">
            {pattern.blueprint.aiSteps.map((step, idx) => (
              <li key={idx} className="leading-relaxed">{step}</li>
            ))}
          </ol>
        </div>
      )}

      {/* Quick Search Bar */}
      <PatternSearchBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        lang={lang}
        resultsCount={totalResultsCount}
      />

      {/* Progress Bar */}
      <div className="space-y-1.5 bg-[#FAF8F5] p-3.5 rounded-2xl border border-[#E8E3DC]">
        <div className="flex items-center justify-between text-xs text-[#6F756F]">
          <span>
            {t.knittingProgress}: {completedCount} / {totalSteps} {isEs ? 'pasos completados' : 'steps completed'}
          </span>
          <span className="font-bold text-[#2D5A43]">{progressPercent}% {t.completed}</span>
        </div>
        <div className="w-full h-2 rounded-full bg-[#EFECE6] overflow-hidden">
          <div
            className="h-full bg-[#2D5A43] transition-all duration-300 rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Materials Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#FAF8F5] p-4 rounded-2xl border border-[#E8E3DC] space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#1F2421] flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5 text-[#2D5A43]" />
            {t.materialsTitle}
          </h4>
          <ul className="text-xs sm:text-sm text-[#4A504A] space-y-1.5 list-disc list-inside">
            {pattern.materials.map((m, idx) => (
              <li key={idx} className="leading-relaxed">
                {m}
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-[#FAF8F5] p-4 rounded-2xl border border-[#E8E3DC] space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#1F2421] flex items-center gap-1.5">
            <Ruler className="w-3.5 h-3.5 text-[#2D5A43]" />
            {t.colorwayTitle}
          </h4>
          {pattern.yarnEstimates.colorBreakdown ? (
            <div className="space-y-1.5">
              {pattern.yarnEstimates.colorBreakdown.map((color, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs sm:text-sm">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full border border-black/10 shadow-xs"
                      style={{ backgroundColor: color.hex }}
                    />
                    <span className="font-medium text-[#1F2421]">{color.colorName}</span>
                  </div>
                  <span className="font-mono text-[#6F756F]">
                    {color.grams} g ({color.percentage}%)
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[#4A504A]">
              ~{pattern.yarnEstimates.totalGrams} g ({pattern.yarnEstimates.totalMeters} m).
            </p>
          )}
        </div>
      </div>

      {/* Section-by-Section Instructions */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-[#1F2421]">
            {t.rowByRowTitle}
          </h3>
        </div>

        {filteredSections.map((section) => {
          const isExpanded = expandedSections[section.id] ?? true;
          // Long shaped sections stay short until asked for: the row counter walks them anyway.
          const isLong = section.instructions.length > 8;
          const showAll = fullSections[section.id] || Boolean(searchQuery);
          const visible = isLong && !showAll ? section.instructions.slice(0, 5) : section.instructions;

          return (
            <div
              key={section.id}
              className="border border-[#E8E3DC] rounded-2xl overflow-hidden bg-white shadow-2xs"
            >
              <button
                type="button"
                onClick={() => toggleSection(section.id)}
                className="w-full px-4 sm:px-5 py-3.5 bg-[#FAF8F5] hover:bg-[#F3EFEA] flex items-center justify-between border-b border-[#E8E3DC] text-left transition cursor-pointer"
              >
                <div>
                  <h4 className="text-sm sm:text-base font-bold text-[#1F2421]">{section.title}</h4>
                  <span className="text-xs text-[#6F756F]">{section.subtitle}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-[#6F756F]">
                  {section.endingStitchCount > 0 && (
                    <span className="hidden sm:inline">{t.endsWidth}: {section.endingStitchCount} {isEs ? 'p.' : 'sts'}</span>
                  )}
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </button>

              {isExpanded && (
                <div className="divide-y divide-[#F4F1EA]">
                  {visible.map((inst) => {
                    const isDone = completedSteps[inst.stepNumber];
                    return (
                      <div
                        key={inst.stepNumber}
                        onClick={() => onToggleStep(inst.stepNumber)}
                        className={`p-4 sm:p-5 flex items-start gap-3.5 transition cursor-pointer select-none active:bg-[#EFECE6] ${
                          isDone ? 'bg-[#F9FAF8] text-[#8C938C]' : 'hover:bg-[#FAF8F5]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(isDone)}
                          onChange={() => onToggleStep(inst.stepNumber)}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={isEs ? `Paso ${inst.stepNumber} hecho` : `Step ${inst.stepNumber} done`}
                          className="w-5 h-5 mt-0.5 rounded-md text-[#2D5A43] focus:ring-[#2D5A43] cursor-pointer"
                        />
                        <div className="flex-1 space-y-2">
                          <p className={`text-xs sm:text-sm leading-relaxed ${isDone ? 'line-through text-[#8C938C]' : 'text-[#1F2421] font-medium'}`}>
                            {inst.instruction}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-[#6F756F] flex-wrap">
                            {inst.stitchCountAfter > 0 && (
                              <span className="font-mono bg-[#EFECE6] px-2 py-0.5 rounded-md font-semibold text-[#1F2421]">
                                {t.stitchCountLabel}: {inst.stitchCountAfter} {isEs ? 'p.' : 'sts'}
                              </span>
                            )}
                            {inst.repeatCount && inst.repeatCount > 1 && (
                              <span className="bg-[#E4ECE7] text-[#2D5A43] px-2 py-0.5 rounded-md font-bold">
                                {inst.repeatCount} {inst.roundOrRow === 'Row' ? (isEs ? 'hileras en total' : 'rows in total') : t.repeatRounds}
                              </span>
                            )}
                            {inst.side && inst.side !== 'round' && (
                              <span className="bg-white border border-[#DDD7CD] px-2 py-0.5 rounded-md font-bold text-[#1F2421]">
                                {inst.side === 'RS' ? (isEs ? 'Lado del derecho' : 'Right side') : isEs ? 'Lado del revés' : 'Wrong side'}
                              </span>
                            )}
                          </div>
                          {inst.checkpoint && !isDone && (
                            <p className="text-xs font-semibold text-[#2D5A43]">
                              {isEs ? 'Comprobá: ' : 'Check: '}{inst.checkpoint}
                            </p>
                          )}
                          {!isDone && <TechniqueHelp ids={inst.techniques} lang={lang} />}
                        </div>
                      </div>
                    );
                  })}
                  {isLong && !searchQuery && (
                    <button
                      type="button"
                      onClick={() => setFullSections((prev) => ({ ...prev, [section.id]: !prev[section.id] }))}
                      className="w-full min-h-[44px] p-3 text-xs font-bold text-[#2D5A43] hover:bg-[#FAF8F5] cursor-pointer"
                    >
                      {showAll
                        ? (isEs ? 'Mostrar menos' : 'Show less')
                        : isEs
                          ? `Mostrar los ${section.instructions.length} pasos`
                          : `Show all ${section.instructions.length} steps`}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Stitch Chart Section */}
      <div className="bg-[#FAF8F5] p-4 rounded-2xl border border-[#E8E3DC] space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-[#1F2421]">
              {isEs ? 'Gráfico de Puntos Interactivo' : 'Interactive Stitch Chart'}
            </h4>
            <p className="text-[11px] text-[#6F756F]">
              {isEs ? 'Visualizá la cuadrícula vuelta por vuelta con símbolos' : 'Grid view with standard stitch symbols'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowChart(!showChart)}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white border border-[#DDD7CD] hover:bg-[#F3EFEA] text-[#2D5A43] transition active:scale-95 cursor-pointer touch-manipulation min-h-[38px]"
          >
            {showChart ? (isEs ? 'Ocultar Gráfico' : 'Hide Chart') : (isEs ? 'Ver Gráfico' : 'View Chart')}
          </button>
        </div>

        {showChart && (
          <div className="pt-2 animate-in fade-in">
            <StitchChart chartData={pattern.chartData} title={pattern.title} lang={lang} />
          </div>
        )}
      </div>

      {/* Abbreviations Guide */}
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
