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
  ArrowRight,
  BookmarkCheck,
} from 'lucide-react';
import { CompiledPattern } from '../types/knit';
import { Language, TRANSLATIONS } from '../i18n/translations';
import { PatternSearchBar } from './PatternSearchBar';
import { StitchChart } from './StitchChart';

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
  const [showDetailedCrownRows, setShowDetailedCrownRows] = useState(false);
  const [showChart, setShowChart] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    brim: true,
    body: true,
    crown: true,
    'full-scarf': true,
  });

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

      {/* 3 Digestable Stages (The entire piece at a glance in 30 seconds!) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wider text-[#1F2421] flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-[#2D5A43]" />
            {isEs ? 'Resumen Rápido: El Gorro en 3 Etapas' : 'Quick Summary: The Hat in 3 Stages'}
          </h3>
          <span className="text-xs text-[#6F756F]">
            {isEs ? 'Para entender toda la labor de un vistazo' : 'The entire project at a glance'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {/* Stage 1 */}
          <div className="bg-[#FAF8F5] p-4 rounded-2xl border border-[#E8E3DC] space-y-1.5 relative overflow-hidden">
            <span className="w-6 h-6 rounded-full bg-[#2D5A43] text-white text-xs font-bold flex items-center justify-center">
              1
            </span>
            <h4 className="font-bold text-sm text-[#1F2421]">
              {isEs ? 'Puño Doblado (15 cm)' : 'Folded Cuff (15 cm)'}
            </h4>
            <p className="text-xs text-[#4A504A] leading-relaxed">
              {isEs
                ? `Montar ${pattern.calculatedGauge.castOnSts} puntos en elástico 1x1. Tejer durante 36 vueltas (15 cm) y doblar al medio para tener puño de 7.5 cm.`
                : `Cast on ${pattern.calculatedGauge.castOnSts} sts in 1x1 rib. Knit for 36 rounds (15 cm) and fold in half for 7.5 cm cuff.`}
            </p>
          </div>

          {/* Stage 2 */}
          <div className="bg-[#FAF8F5] p-4 rounded-2xl border border-[#E8E3DC] space-y-1.5">
            <span className="w-6 h-6 rounded-full bg-[#2D5A43] text-white text-xs font-bold flex items-center justify-center">
              2
            </span>
            <h4 className="font-bold text-sm text-[#1F2421]">
              {isEs ? 'Cuerpo con Rayas (17 cm)' : 'Body with Stripes (17 cm)'}
            </h4>
            <p className="text-xs text-[#4A504A] leading-relaxed">
              {isEs
                ? `Continuar recto en elástico 1x1 con los 3 colores (Verde, Blanco, Oliva) durante 13 vueltas hasta que el gorro mida 17 cm desde el doblez.`
                : `Continue straight in 1x1 rib with 3 stripe colors for 13 rounds until total hat measures 17 cm from fold line.`}
            </p>
          </div>

          {/* Stage 3 */}
          <div className="bg-[#FAF8F5] p-4 rounded-2xl border border-[#E8E3DC] space-y-1.5">
            <span className="w-6 h-6 rounded-full bg-[#2D5A43] text-white text-xs font-bold flex items-center justify-center">
              3
            </span>
            <h4 className="font-bold text-sm text-[#1F2421]">
              {isEs ? 'Disminuciones Coronilla' : 'Crown Shaping'}
            </h4>
            <p className="text-xs text-[#4A504A] leading-relaxed">
              {isEs
                ? 'Dividir en 4 gajos. Disminuir 8 puntos cada 2 vueltas (1 surjete simple y 2 juntos por gajo). Al quedar 8 puntos, cerrar como una bolsita.'
                : 'Divide into 4 wedges. Decrease 8 sts every 2nd round (ssk and k2tog per wedge). At 8 sts, pull yarn tight like drawstring.'}
            </p>
          </div>
        </div>
      </div>

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
          {pattern.blueprint.garmentType === 'beanie' && (
            <button
              type="button"
              onClick={() => setShowDetailedCrownRows(!showDetailedCrownRows)}
              className="text-xs font-semibold text-[#2D5A43] hover:underline cursor-pointer"
            >
              {showDetailedCrownRows
                ? (isEs ? 'Ver coronilla condensada' : 'Condense crown decrease rows')
                : (isEs ? 'Desglosar cada vuelta de disminución' : 'Expand all decrease rows')}
            </button>
          )}
        </div>

        {filteredSections.map((section) => {
          const isExpanded = expandedSections[section.id] ?? true;
          const isCrown = section.id === 'crown';

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
                  <span className="hidden sm:inline">{t.endsWidth}: {section.endingStitchCount} {isEs ? 'p.' : 'sts'}</span>
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </button>

              {isExpanded && (
                <div className="divide-y divide-[#F4F1EA]">
                  {/* If Crown and not expanded to all 22 rows, show the clean condensed digestable view */}
                  {isCrown && !showDetailedCrownRows && !searchQuery ? (
                    <div className="p-4 sm:p-5 space-y-3 bg-[#FAF8F5]/50">
                      <div className="p-4 rounded-2xl bg-white border border-[#E8E3DC] space-y-2">
                        <div className="font-bold text-xs sm:text-sm text-[#1F2421]">
                          {isEs ? '📐 Esquema de Disminución de Coronilla:' : '📐 Crown Decrease Sequence:'}
                        </div>
                        <ul className="text-xs sm:text-sm text-[#4A504A] space-y-1.5 list-disc list-inside">
                          <li>
                            <strong>{isEs ? 'Vuelta de Preparación:' : 'Set-up Round:'}</strong> {isEs ? `Dividir los ${pattern.calculatedGauge.castOnSts} puntos en 4 gajos (${pattern.calculatedGauge.castOnSts / 4} puntos por gajo) colocando marcadores.` : `Divide ${pattern.calculatedGauge.castOnSts} sts into 4 wedges (${pattern.calculatedGauge.castOnSts / 4} sts per wedge).`}
                          </li>
                          <li>
                            <strong>{isEs ? 'Vuelta de Disminución:' : 'Decrease Round:'}</strong> {isEs ? '*1 surjete simple, tejer en punto hasta 2 puntos antes del marcador, 2 puntos juntos al derecho, deslizar marcador; repetir 4 veces (se restan 8 puntos en total).' : '*SSK, work in pattern to 2 sts before marker, k2tog, SM; repeat 4 times (8 sts decreased).'}
                          </li>
                          <li>
                            <strong>{isEs ? 'Vuelta de Reposo:' : 'Plain Round:'}</strong> {isEs ? 'Tejer todos los puntos como se presentan sin hacer disminuciones.' : 'Work even in established pattern without decreases.'}
                          </li>
                          <li>
                            <strong>{isEs ? 'Repetición:' : 'Repetition:'}</strong> {isEs ? `Alternar estas 2 vueltas durante 11 veces hasta que queden 8 puntos en total.` : `Alternate these 2 rounds 11 times until 8 sts remain.`}
                          </li>
                          <li>
                            <strong>{isEs ? 'Vuelta Final y Remate:' : 'Final Drawstring Round:'}</strong> {isEs ? 'Tejer *2 puntos juntos al derecho*. Cortar hebra de 20 cm, enhebrar en aguja lanera, pasar por los puntos dos veces y tirar firmemente para cerrar el centro sin dejar agujero.' : 'Work *k2tog*. Cut 20cm tail, thread through remaining sts twice, pull tight like drawstring.'}
                          </li>
                        </ul>

                        <div className="pt-2 flex justify-end">
                          <button
                            type="button"
                            onClick={() => setShowDetailedCrownRows(true)}
                            className="text-xs font-bold text-[#2D5A43] hover:underline"
                          >
                            {isEs ? 'Ver el detalle fila por fila con casillas de verificación ➔' : 'View all 22 rounds with checkboxes ➔'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    section.instructions.map((inst) => {
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
                            className="w-5 h-5 mt-0.5 rounded-md text-[#2D5A43] focus:ring-[#2D5A43] cursor-pointer"
                          />
                          <div className="flex-1 space-y-1">
                            <p className={`text-xs sm:text-sm leading-relaxed ${isDone ? 'line-through text-[#8C938C]' : 'text-[#1F2421] font-medium'}`}>
                              {inst.instruction}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-[#6F756F]">
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
                    })
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
