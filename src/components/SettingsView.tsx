import React from 'react';
import {
  Globe,
  Ruler,
  Sliders,
  RotateCcw,
  BookOpen,
  Info,
  Check,
} from 'lucide-react';
import { KnitUserConstraints, YarnWeightCategory } from '../types/knit';
import { Language } from '../i18n/translations';
import { YARN_SPECS, YARN_NAMES_ES } from '../engine/compiler';

interface SettingsViewProps {
  constraints: KnitUserConstraints;
  onUpdateConstraints: (updated: KnitUserConstraints) => void;
  lang: Language;
  onToggleLang: () => void;
  onOpenCraftNotes: () => void;
  onResetAll: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  constraints,
  onUpdateConstraints,
  lang,
  onToggleLang,
  onOpenCraftNotes,
  onResetAll,
}) => {
  const isEs = lang === 'es';

  return (
    <div className="bg-white rounded-3xl border border-[#E8E3DC] shadow-xs p-5 sm:p-8 space-y-7 max-w-3xl mx-auto">
      <div className="border-b border-[#F0ECE6] pb-4">
        <h2 className="text-xl sm:text-2xl font-black text-[#1F2421]">
          {isEs ? 'Ajustes y Preferencias' : 'Settings & Preferences'}
        </h2>
        <p className="text-xs sm:text-sm text-[#6F756F] mt-1">
          {isEs
            ? 'Personalizá el idioma, tu muestra de tensión y preferencias de tejido.'
            : 'Customize language, gauge swatch density, and needle preferences.'}
        </p>
      </div>

      {/* 1. Language Setting */}
      <div className="bg-[#FAF8F5] p-5 rounded-2xl border border-[#E8E3DC] space-y-3">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-[#2D5A43]" />
          <h3 className="text-sm font-bold text-[#1F2421]">
            {isEs ? 'Idioma del Patrón y la App' : 'App & Pattern Language'}
          </h3>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            type="button"
            onClick={() => {
              if (lang !== 'es') onToggleLang();
            }}
            className={`p-3 rounded-xl border text-left flex items-center justify-between transition cursor-pointer active:scale-95 ${
              lang === 'es'
                ? 'bg-[#EBF2EE] border-[#2D5A43] ring-1 ring-[#2D5A43]'
                : 'bg-white border-[#DDD7CD] hover:bg-[#F3EFEA]'
            }`}
          >
            <div>
              <div className="font-bold text-xs sm:text-sm text-[#1F2421]">🇦🇷 Español</div>
              <div className="text-[11px] text-[#6F756F]">Terminología argentina</div>
            </div>
            {lang === 'es' && <Check className="w-4 h-4 text-[#2D5A43]" />}
          </button>

          <button
            type="button"
            onClick={() => {
              if (lang !== 'en') onToggleLang();
            }}
            className={`p-3 rounded-xl border text-left flex items-center justify-between transition cursor-pointer active:scale-95 ${
              lang === 'en'
                ? 'bg-[#EBF2EE] border-[#2D5A43] ring-1 ring-[#2D5A43]'
                : 'bg-white border-[#DDD7CD] hover:bg-[#F3EFEA]'
            }`}
          >
            <div>
              <div className="font-bold text-xs sm:text-sm text-[#1F2421]">🇬🇧 English</div>
              <div className="text-[11px] text-[#6F756F]">Standard CYC notation</div>
            </div>
            {lang === 'en' && <Check className="w-4 h-4 text-[#2D5A43]" />}
          </button>
        </div>
      </div>

      {/* 2. Swatch Gauge Calibrator */}
      <div className="bg-[#FAF8F5] p-5 rounded-2xl border border-[#E8E3DC] space-y-4">
        <div className="flex items-center gap-2">
          <Ruler className="w-4 h-4 text-[#2D5A43]" />
          <h3 className="text-sm font-bold text-[#1F2421]">
            {isEs ? 'Muestra de Tensión (10 x 10 cm)' : 'Gauge Swatch (10 x 10 cm)'}
          </h3>
        </div>
        <p className="text-xs text-[#6F756F]">
          {isEs
            ? 'Si tejés más apretado o más flojo que el estándar (18 p / 24 vtas en 10 cm), ajustá acá para que el cálculo matemático sea exacto para tu mano.'
            : 'If your tension differs from standard (18 sts / 24 rows in 10 cm), adjust here so calculations match your personal gauge.'}
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#4A504A] mb-1">
              {isEs ? 'Puntos en 10 cm' : 'Stitches in 10 cm'}
            </label>
            <input
              type="number"
              step="0.5"
              value={constraints.gaugeSts10cm}
              onChange={(e) =>
                onUpdateConstraints({
                  ...constraints,
                  gaugeSts10cm: parseFloat(e.target.value) || 18,
                })
              }
              className="w-full text-sm font-bold p-2.5 bg-white border border-[#DDD7CD] rounded-xl"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#4A504A] mb-1">
              {isEs ? 'Vueltas en 10 cm' : 'Rows in 10 cm'}
            </label>
            <input
              type="number"
              step="0.5"
              value={constraints.gaugeRows10cm}
              onChange={(e) =>
                onUpdateConstraints({
                  ...constraints,
                  gaugeRows10cm: parseFloat(e.target.value) || 24,
                })
              }
              className="w-full text-sm font-bold p-2.5 bg-white border border-[#DDD7CD] rounded-xl"
            />
          </div>
        </div>
      </div>

      {/* 3. Deep Reference & Guide Link */}
      <div className="p-4 rounded-2xl bg-[#E4ECE7] border border-[#CDE1D4] flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <BookOpen className="w-5 h-5 text-[#2D5A43] flex-shrink-0" />
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-[#1F2421]">
              {isEs ? 'Guía para la Maestra Tejedora y Fuentes' : 'Master Knitter Guide & Citations'}
            </h4>
            <p className="text-[11px] text-[#2D5A43]">
              {isEs
                ? 'Explicaciones sobre disminuciones, elasticidad del punto y citas académicas de MIT.'
                : 'Explanations on decreases, ribbing elasticity, and MIT research.'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onOpenCraftNotes}
          className="px-3.5 py-2 bg-[#2D5A43] hover:bg-[#234734] text-white rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer whitespace-nowrap"
        >
          {isEs ? 'Abrir Guía' : 'Open Guide'}
        </button>
      </div>

      {/* 4. Reset App Data */}
      <div className="pt-2 border-t border-[#F0ECE6] flex items-center justify-between">
        <span className="text-xs text-[#6F756F]">
          {isEs ? '¿Querés volver al gorro original?' : 'Reset to default project?'}
        </span>
        <button
          type="button"
          onClick={onResetAll}
          className="px-3 py-1.5 rounded-xl border border-[#DDD7CD] text-xs font-semibold text-[#6F756F] hover:text-[#1F2421] hover:bg-[#FAF8F5] transition flex items-center gap-1.5 active:scale-95"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>{isEs ? 'Reiniciar todo' : 'Reset all'}</span>
        </button>
      </div>
    </div>
  );
};
