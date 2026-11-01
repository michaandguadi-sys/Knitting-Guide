import React, { useState, useEffect } from 'react';
import {
  Plus,
  Minus,
  RotateCcw,
  BookmarkCheck,
  CheckCircle2,
  Sun,
  SunMedium,
  Check,
} from 'lucide-react';
import { CompiledPattern, PatternRowInstruction } from '../types/knit';
import { Language, TRANSLATIONS } from '../i18n/translations';

interface RowTrackerProps {
  pattern: CompiledPattern;
  lang: Language;
}

export const RowTracker: React.FC<RowTrackerProps> = ({ pattern, lang }) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [wakeLockSentinel, setWakeLockSentinel] = useState<any>(null);
  const t = TRANSLATIONS[lang];
  const isEs = lang === 'es';

  const steps = pattern.allRows;
  const currentStep: PatternRowInstruction = steps[currentStepIndex] || steps[0];

  // Screen Wake Lock API to prevent phone screen from turning off while knitting
  useEffect(() => {
    let sentinel: any = null;
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          sentinel = await (navigator as any).wakeLock.request('screen');
          setWakeLockSentinel(sentinel);
          setWakeLockActive(true);
          sentinel.addEventListener('release', () => {
            setWakeLockActive(false);
          });
        }
      } catch (err) {
        // WakeLock may fail if low battery or tab in background
        console.log('WakeLock not granted:', err);
      }
    };

    requestWakeLock();

    return () => {
      if (sentinel) {
        sentinel.release().catch(() => {});
      }
    };
  }, []);

  const triggerHaptic = () => {
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(30);
      }
    } catch {
      // Haptics ignore if unsupported
    }
  };

  const handleNext = () => {
    if (currentStepIndex < steps.length - 1) {
      triggerHaptic();
      setCurrentStepIndex(currentStepIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      triggerHaptic();
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const handleReset = () => {
    triggerHaptic();
    setCurrentStepIndex(0);
  };

  const progressPercent = Math.round(((currentStepIndex + 1) / steps.length) * 100);

  return (
    <div className="bg-white rounded-3xl border border-[#E8E3DC] shadow-xs p-4 sm:p-7 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#F0ECE6] pb-3">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[#2D5A43]">
            {t.counterTag}
          </span>
          <h3 className="text-xl sm:text-2xl font-black text-[#1F2421]">
            {t.counterTitle}
          </h3>
          <p className="text-xs sm:text-sm text-[#6F756F]">
            {t.counterSubtitle}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Wake Lock Status Pill */}
          {wakeLockActive && (
            <span
              className="px-2.5 py-1.5 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-semibold flex items-center gap-1 shadow-2xs"
              title="Tu pantalla no se apagará mientras tejés"
            >
              <Sun className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
              <span>{isEs ? 'Pantalla Activa' : 'Screen Awake'}</span>
            </span>
          )}

          <button
            onClick={handleReset}
            className="px-3.5 py-2 text-xs font-semibold text-[#4A504A] hover:text-[#1F2421] bg-[#FAF8F5] border border-[#DDD7CD] hover:bg-[#F3EFEA] rounded-xl transition flex items-center gap-1.5 active:scale-95 cursor-pointer touch-manipulation min-h-[38px]"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{t.resetToRow1}</span>
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs sm:text-sm text-[#6F756F]">
          <span className="font-medium">
            {t.stepOf} {currentStepIndex + 1} {t.of} {steps.length} • {currentStep?.sectionName}
          </span>
          <span className="font-bold text-[#2D5A43]">{progressPercent}% {t.completed}</span>
        </div>
        <div className="w-full h-3 rounded-full bg-[#EFECE6] overflow-hidden">
          <div
            className="h-full bg-[#2D5A43] transition-all duration-300 rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Hero Active Step Spotlight Card (Ultra readable for Phone with yarn in hands) */}
      <div className="bg-gradient-to-br from-[#FAF8F5] to-[#F3EFEA] rounded-3xl p-5 sm:p-8 border border-[#DFD8CC] shadow-inner text-center space-y-5">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-bold bg-[#E4ECE7] text-[#2D5A43]">
          <BookmarkCheck className="w-3.5 h-3.5" />
          <span>{currentStep?.sectionName}</span>
        </div>

        <div className="max-w-2xl mx-auto space-y-3">
          <p className="text-xl sm:text-2xl md:text-3xl font-black text-[#1F2421] leading-snug">
            {currentStep?.instruction}
          </p>

          <div className="inline-flex items-center gap-2 bg-white px-4 py-2 rounded-2xl border border-[#DDD7CD] shadow-xs">
            <span className="text-xs text-[#6F756F] font-semibold">
              {t.expectedOnNeedles}
            </span>
            <span className="text-base sm:text-lg font-black text-[#2D5A43] font-mono">
              {currentStep?.stitchCountAfter} {isEs ? 'puntos' : 'sts'}
            </span>
          </div>
        </div>

        {/* Giant Mobile Touch Buttons (Designed for thumbs!) */}
        <div className="flex items-center justify-center gap-3 sm:gap-5 pt-2">
          {/* Previous Step Button */}
          <button
            onClick={handlePrev}
            disabled={currentStepIndex === 0}
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl border border-[#DDD7CD] bg-white hover:bg-[#F8F6F1] text-[#1F2421] flex items-center justify-center transition shadow-xs disabled:opacity-30 disabled:cursor-not-allowed active:scale-90 touch-manipulation cursor-pointer flex-shrink-0"
            title="Paso Anterior"
            aria-label="Paso Anterior"
          >
            <Minus className="w-7 h-7 sm:w-8 sm:h-8" />
          </button>

          {/* Giant Next Step Button */}
          <button
            onClick={handleNext}
            disabled={currentStepIndex >= steps.length - 1}
            className="flex-1 max-w-md h-16 sm:h-20 rounded-3xl bg-[#2D5A43] hover:bg-[#234734] active:bg-[#1C3A2B] text-white font-black text-base sm:text-xl flex items-center justify-center gap-2 sm:gap-3 transition shadow-md active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed px-4 touch-manipulation cursor-pointer select-none"
          >
            <span>{currentStepIndex >= steps.length - 1 ? (isEs ? '¡Prenda Terminada!' : 'Project Finished!') : t.nextStepBtn}</span>
            <Plus className="w-6 h-6 sm:w-7 sm:h-7 flex-shrink-0" />
          </button>
        </div>
      </div>

      {/* Quick Section Jump Drawer */}
      <div className="space-y-2 pt-1">
        <h4 className="text-xs font-bold uppercase tracking-wider text-[#1F2421]">
          {t.jumpToSection}
        </h4>
        <div className="flex flex-wrap gap-2">
          {pattern.sections.map((sec) => {
            const isCurrent = steps[currentStepIndex]?.sectionName.toLowerCase().includes(sec.id);

            return (
              <button
                key={sec.id}
                onClick={() => {
                  triggerHaptic();
                  const idx = steps.findIndex(
                    (s) => s.sectionName.toLowerCase().includes(sec.id) || sec.title.includes(s.sectionName)
                  );
                  if (idx >= 0) setCurrentStepIndex(idx);
                }}
                className={`px-3.5 py-2 rounded-2xl text-xs sm:text-sm font-semibold border transition active:scale-95 touch-manipulation cursor-pointer ${
                  isCurrent
                    ? 'bg-[#2D5A43] text-white border-[#2D5A43] shadow-xs'
                    : 'bg-[#FAF8F5] text-[#4A504A] border-[#DDD7CD] hover:bg-[#F3EFEA]'
                }`}
              >
                {sec.title}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
