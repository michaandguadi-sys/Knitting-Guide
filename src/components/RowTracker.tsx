import React, { useEffect, useState } from 'react';
import { BookmarkCheck, CheckCircle2, Minus, Plus, RotateCcw, Ruler, Sun } from 'lucide-react';
import { CompiledPattern, RowSide, TrackerPosition } from '../types/knit';
import { Language, TRANSLATIONS } from '../i18n/translations';
import { TechniqueHelp } from './TechniqueHelp';

interface RowTrackerProps {
  pattern: CompiledPattern;
  lang: Language;
  position: TrackerPosition;
  /** Called on every tap so that progress is saved before the phone can sleep. */
  onChange: (position: TrackerPosition) => void;
}

/** Rows or rounds a step takes: read-through steps count as one tap. */
const rowsIn = (step: CompiledPattern['allRows'][number]) => (step.kind === 'work' ? step.repeatCount ?? 1 : 1);

/** Pure position arithmetic, exported so that the counter's maths can be tested without a screen. */
export function advance(pattern: CompiledPattern, pos: TrackerPosition): TrackerPosition {
  const step = pattern.allRows[pos.stepIndex];
  if (!step) return pos;
  if (pos.rowInStep + 1 < rowsIn(step)) return { stepIndex: pos.stepIndex, rowInStep: pos.rowInStep + 1 };
  if (pos.stepIndex + 1 < pattern.allRows.length) return { stepIndex: pos.stepIndex + 1, rowInStep: 0 };
  return pos;
}

export function retreat(pattern: CompiledPattern, pos: TrackerPosition): TrackerPosition {
  if (pos.rowInStep > 0) return { stepIndex: pos.stepIndex, rowInStep: pos.rowInStep - 1 };
  if (pos.stepIndex === 0) return pos;
  const previous = pattern.allRows[pos.stepIndex - 1];
  return { stepIndex: pos.stepIndex - 1, rowInStep: rowsIn(previous) - 1 };
}

export const RowTracker: React.FC<RowTrackerProps> = ({ pattern, lang, position, onChange }) => {
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const t = TRANSLATIONS[lang];
  const es = lang === 'es';

  const steps = pattern.allRows;
  const stepIndex = Math.min(position.stepIndex, steps.length - 1);
  const step = steps[stepIndex];
  const total = rowsIn(step);
  const rowInStep = Math.min(position.rowInStep, total - 1);
  const isLast = stepIndex === steps.length - 1 && rowInStep === total - 1;

  // Browsers release the wake lock whenever the tab is hidden, so it has to be taken again.
  useEffect(() => {
    let sentinel: { release: () => Promise<void>; addEventListener: (e: string, f: () => void) => void } | null = null;
    let cancelled = false;
    const request = async () => {
      try {
        if ('wakeLock' in navigator && document.visibilityState === 'visible') {
          const lock = await (navigator as unknown as { wakeLock: { request: (type: string) => Promise<typeof sentinel> } }).wakeLock.request('screen');
          if (cancelled) {
            void lock?.release();
            return;
          }
          sentinel = lock;
          setWakeLockActive(true);
          sentinel?.addEventListener('release', () => setWakeLockActive(false));
        }
      } catch {
        // Denied on low battery, or unsupported. The counter still works without it.
      }
    };
    void request();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void request();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      void sentinel?.release().catch(() => {});
    };
  }, []);

  const haptic = () => {
    try {
      navigator.vibrate?.(30);
    } catch {
      // Not available on every phone.
    }
  };

  const go = (next: TrackerPosition) => {
    haptic();
    setConfirmReset(false);
    onChange(next);
  };

  const doneRows = steps.slice(0, stepIndex).reduce((acc, s) => acc + rowsIn(s), 0) + rowInStep;
  const totalRows = steps.reduce((acc, s) => acc + rowsIn(s), 0);
  const progressPercent = Math.round((doneRows / Math.max(1, totalRows)) * 100);

  const cycleIndex = step.rows ? rowInStep % step.rows.length : 0;
  const currentRow = step.rows?.[cycleIndex];
  const currentText = step.rowTexts?.[cycleIndex];
  const side: RowSide | undefined = currentRow?.side;
  const rowWord = step.roundOrRow === 'Rnd' ? (es ? 'Vuelta' : 'Round') : es ? 'Hilera' : 'Row';
  const rowLabelNumber = step.number + rowInStep;

  const sideText = () => {
    if (side === 'round') return es ? 'En redondo: siempre mirás el derecho' : 'In the round: right side always facing you';
    if (side === 'RS') return es ? 'Lado del DERECHO mirándote' : 'RIGHT side facing you';
    if (side === 'WS') return es ? 'Lado del REVÉS mirándote' : 'WRONG side facing you';
    return null;
  };

  return (
    <div className="bg-white rounded-3xl border border-[#E8E3DC] shadow-xs p-4 sm:p-7 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#F0ECE6] pb-3">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[#2D5A43]">{t.counterTag}</span>
          <h3 className="text-xl sm:text-2xl font-black text-[#1F2421]">{t.counterTitle}</h3>
          <p className="text-xs sm:text-sm text-[#6F756F]">
            {es ? 'Cada toque se guarda: podés cerrar la app y seguir donde estabas.' : 'Every tap is saved, so you can close the app and pick up where you left off.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {wakeLockActive && (
            <span className="px-2.5 py-1.5 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-semibold flex items-center gap-1 shadow-2xs">
              <Sun className="w-3.5 h-3.5 text-amber-600" />
              <span>{es ? 'Pantalla Activa' : 'Screen Awake'}</span>
            </span>
          )}
          <button
            onClick={() => {
              if (confirmReset) go({ stepIndex: 0, rowInStep: 0 });
              else setConfirmReset(true);
            }}
            className={`px-3.5 py-2 text-xs font-semibold border rounded-xl transition flex items-center gap-1.5 active:scale-95 cursor-pointer touch-manipulation min-h-[38px] ${
              confirmReset ? 'bg-red-50 text-red-800 border-red-300' : 'text-[#4A504A] bg-[#FAF8F5] border-[#DDD7CD]'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{confirmReset ? (es ? 'Tocá de nuevo para borrar' : 'Tap again to erase') : t.resetToRow1}</span>
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs sm:text-sm text-[#6F756F]">
          <span className="font-medium">{step.sectionName}</span>
          <span className="font-bold text-[#2D5A43]">{progressPercent}% {t.completed}</span>
        </div>
        <div className="w-full h-3 rounded-full bg-[#EFECE6] overflow-hidden">
          <div className="h-full bg-[#2D5A43] transition-all duration-300 rounded-full" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      <div className="bg-gradient-to-br from-[#FAF8F5] to-[#F3EFEA] rounded-3xl p-5 sm:p-8 border border-[#DFD8CC] shadow-inner text-center space-y-4">
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-bold bg-[#E4ECE7] text-[#2D5A43]">
            <BookmarkCheck className="w-3.5 h-3.5" />
            {step.kind === 'work'
              ? `${rowWord} ${rowLabelNumber}${total > 1 ? ` · ${rowInStep + 1} ${es ? 'de' : 'of'} ${total}` : ''}`
              : step.sectionName}
          </span>
          {sideText() && (
            <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold ${side === 'WS' ? 'bg-amber-100 text-amber-900' : 'bg-white text-[#1F2421] border border-[#DDD7CD]'}`}>
              {sideText()}
            </span>
          )}
        </div>

        <p className="max-w-2xl mx-auto text-xl sm:text-2xl md:text-3xl font-black text-[#1F2421] leading-snug">
          {currentText ?? step.instruction}
        </p>

        {step.colorNote && <p className="text-sm font-semibold text-[#2D5A43]">{step.colorNote}</p>}

        <div className="inline-flex items-center gap-2 bg-white px-4 py-2 rounded-2xl border border-[#DDD7CD] shadow-xs">
          <span className="text-xs text-[#6F756F] font-semibold">{t.expectedOnNeedles}</span>
          <span className="text-base sm:text-lg font-black text-[#2D5A43] font-mono">
            {step.stitchCountAfter} {es ? 'puntos' : 'sts'}
          </span>
        </div>

        {step.checkpoint && rowInStep === total - 1 && (
          <div className="max-w-xl mx-auto flex items-start gap-2 text-left p-3 rounded-2xl bg-white border border-[#C2DEC8] text-xs sm:text-sm text-[#1C3A2B] font-semibold">
            <Ruler className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{es ? 'Comprobá antes de seguir: ' : 'Check before moving on: '}{step.checkpoint}</span>
          </div>
        )}

        <div className="max-w-xl mx-auto">
          <TechniqueHelp ids={step.techniques} lang={lang} />
        </div>

        <div className="flex items-center justify-center gap-3 sm:gap-5 pt-1">
          <button
            onClick={() => go(retreat(pattern, { stepIndex, rowInStep }))}
            disabled={stepIndex === 0 && rowInStep === 0}
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl border border-[#DDD7CD] bg-white text-[#1F2421] flex items-center justify-center transition shadow-xs disabled:opacity-30 disabled:cursor-not-allowed active:scale-90 touch-manipulation cursor-pointer flex-shrink-0"
            aria-label={es ? 'Volver una vuelta' : 'Back one row'}
          >
            <Minus className="w-7 h-7 sm:w-8 sm:h-8" />
          </button>
          <button
            onClick={() => go(advance(pattern, { stepIndex, rowInStep }))}
            disabled={isLast}
            className="flex-1 max-w-md h-16 sm:h-20 rounded-3xl bg-[#2D5A43] hover:bg-[#234734] active:bg-[#1C3A2B] text-white font-black text-base sm:text-xl flex items-center justify-center gap-2 sm:gap-3 transition shadow-md active:scale-95 disabled:opacity-60 px-4 touch-manipulation cursor-pointer select-none"
          >
            {isLast ? (
              <>
                <CheckCircle2 className="w-6 h-6" />
                <span>{es ? '¡Prenda Terminada!' : 'Project Finished!'}</span>
              </>
            ) : (
              <>
                <span>{step.kind === 'work' ? (es ? `Terminé esta ${rowWord.toLowerCase()}` : `${rowWord} done`) : es ? 'Listo, seguir' : 'Done, next'}</span>
                <Plus className="w-6 h-6 sm:w-7 sm:h-7 flex-shrink-0" />
              </>
            )}
          </button>
        </div>
      </div>

      <div className="space-y-2 pt-1">
        <h4 className="text-xs font-bold uppercase tracking-wider text-[#1F2421]">{t.jumpToSection}</h4>
        <div className="flex flex-wrap gap-2">
          {pattern.sections.map((section) => {
            const first = section.instructions[0];
            const firstIndex = first ? steps.findIndex((s) => s.stepNumber === first.stepNumber) : -1;
            const isCurrent = section.instructions.some((i) => i.stepNumber === step.stepNumber);
            return (
              <button
                key={section.id}
                onClick={() => firstIndex >= 0 && go({ stepIndex: firstIndex, rowInStep: 0 })}
                className={`px-3.5 py-2 min-h-[40px] rounded-2xl text-xs sm:text-sm font-semibold border transition active:scale-95 touch-manipulation cursor-pointer ${
                  isCurrent ? 'bg-[#2D5A43] text-white border-[#2D5A43] shadow-xs' : 'bg-[#FAF8F5] text-[#4A504A] border-[#DDD7CD]'
                }`}
              >
                {section.title}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
