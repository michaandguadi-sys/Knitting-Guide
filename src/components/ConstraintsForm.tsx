import React from 'react';
import {
  Ruler,
  Compass,
  Calculator,
} from 'lucide-react';
import { KnitUserConstraints, YarnWeightCategory } from '../types/knit';
import { YARN_SPECS, YARN_NAMES_ES, needleToUs } from '../engine/compiler';
import { Language, TRANSLATIONS } from '../i18n/translations';

interface ConstraintsFormProps {
  constraints: KnitUserConstraints;
  onChange: (updated: KnitUserConstraints) => void;
  onCompile: () => void;
  isBeanie: boolean;
  lang: Language;
}

export const ConstraintsForm: React.FC<ConstraintsFormProps> = ({
  constraints,
  onChange,
  onCompile,
  isBeanie,
  lang,
}) => {
  const t = TRANSLATIONS[lang];
  const isEs = lang === 'es';

  const sizePresets = [
    { id: 'baby', label: isEs ? 'Bebé' : 'Baby', circ: 42, len: 16, brim: 4 },
    { id: 'toddler', label: isEs ? 'Niñito' : 'Toddler', circ: 46, len: 18, brim: 5 },
    { id: 'child', label: isEs ? 'Infantil' : 'Child', circ: 50, len: 20, brim: 6 },
    { id: 'adult_s', label: isEs ? 'Adulto S' : 'Adult S', circ: 53, len: 21, brim: 7 },
    { id: 'adult_m', label: isEs ? 'Adulto M' : 'Adult M', circ: 56, len: 22, brim: 7.5 },
    { id: 'adult_l', label: isEs ? 'Adulto L' : 'Adult L', circ: 59, len: 23, brim: 8 },
  ];

  const handlePresetSelect = (preset: (typeof sizePresets)[0]) => {
    onChange({
      ...constraints,
      targetSize: preset.id,
      circumferenceCm: preset.circ,
      lengthCm: preset.len,
      brimLengthCm: preset.brim,
    });
  };

  const handleYarnChange = (yarnWeight: YarnWeightCategory) => {
    const spec = YARN_SPECS[yarnWeight];
    onChange({
      ...constraints,
      yarnWeight,
      needleSizeMm: spec ? spec.defaultNeedle : constraints.needleSizeMm,
    });
  };

  return (
    <div className="bg-white rounded-3xl border border-[#E8E3DC] shadow-xs p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#F0ECE6] pb-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[#2D5A43]">
            {t.step3Tag}
          </span>
          <h3 className="text-lg sm:text-xl font-bold text-[#1F2421]">
            {t.step3Title}
          </h3>
          <p className="text-xs text-[#6F756F]">
            {t.step3Subtitle}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs bg-[#F4F1EA] text-[#4A504A] px-3 py-1.5 rounded-xl border border-[#DDD7CD] font-mono">
            Gx = {(constraints.gaugeSts10cm / 10).toFixed(2)} {isEs ? 'p/cm' : 'sts/cm'}
          </span>
          <span className="text-xs bg-[#F4F1EA] text-[#4A504A] px-3 py-1.5 rounded-xl border border-[#DDD7CD] font-mono">
            Gy = {(constraints.gaugeRows10cm / 10).toFixed(2)} {isEs ? 'vtas/cm' : 'rows/cm'}
          </span>
        </div>
      </div>

      {/* Size Presets (touch friendly) */}
      {isBeanie && (
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-[#1F2421]">
            {t.sizePresetsLabel}
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {sizePresets.map((p) => {
              const isSelected = constraints.targetSize === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handlePresetSelect(p)}
                  className={`py-2.5 px-2 rounded-2xl text-xs font-medium border text-center transition active:scale-95 ${
                    isSelected
                      ? 'bg-[#2D5A43] text-white border-[#2D5A43] shadow-xs font-bold'
                      : 'bg-[#FAF8F5] text-[#4A504A] border-[#DDD7CD] hover:bg-[#F3EFEA]'
                  }`}
                >
                  <div className="truncate font-semibold">{p.label}</div>
                  <div className={`text-[10px] ${isSelected ? 'text-emerald-100' : 'text-[#6F756F]'}`}>
                    {p.circ} cm
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Gauge and Measurements Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Left: Swatch Gauge Calibrator */}
        <div className="bg-[#FAF8F5] rounded-2xl p-4 sm:p-5 border border-[#E8E3DC] space-y-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#1F2421] flex items-center gap-1.5">
              <Ruler className="w-3.5 h-3.5 text-[#2D5A43]" />
              {t.swatchTitle}
            </span>
            <span className="text-[10px] text-[#2D5A43] font-semibold bg-[#E4ECE7] px-2 py-0.5 rounded-full">
              {t.swatchEssential}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-[#4A504A] mb-1">
                {t.stsPer10cm}
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.5"
                  min="8"
                  max="45"
                  value={constraints.gaugeSts10cm}
                  onChange={(e) =>
                    onChange({
                      ...constraints,
                      gaugeSts10cm: parseFloat(e.target.value) || 18,
                    })
                  }
                  className="w-full text-base font-bold p-3 bg-white border border-[#DDD7CD] rounded-xl focus:ring-2 focus:ring-[#2D5A43]"
                />
                <span className="absolute right-3 top-3 text-xs text-[#6F756F]">
                  {isEs ? 'puntos' : 'sts'}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#4A504A] mb-1">
                {t.rowsPer10cm}
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.5"
                  min="10"
                  max="55"
                  value={constraints.gaugeRows10cm}
                  onChange={(e) =>
                    onChange({
                      ...constraints,
                      gaugeRows10cm: parseFloat(e.target.value) || 24,
                    })
                  }
                  className="w-full text-base font-bold p-3 bg-white border border-[#DDD7CD] rounded-xl focus:ring-2 focus:ring-[#2D5A43]"
                />
                <span className="absolute right-3 top-3 text-xs text-[#6F756F]">
                  {isEs ? 'vueltas' : 'rows'}
                </span>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-[#6F756F] leading-relaxed">
            {t.swatchTip}
          </p>
        </div>

        {/* Right: Target Dimensions */}
        <div className="bg-[#FAF8F5] rounded-2xl p-4 sm:p-5 border border-[#E8E3DC] space-y-3.5">
          <span className="text-xs font-bold text-[#1F2421] flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-[#2D5A43]" />
            {t.targetDimensionsTitle}
          </span>

          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-[#4A504A] mb-1">
                {isBeanie ? t.circumferenceLabel : t.garmentWidthLabel}
              </label>
              <input
                type="number"
                step="0.5"
                value={constraints.circumferenceCm}
                onChange={(e) =>
                  onChange({
                    ...constraints,
                    targetSize: 'custom',
                    circumferenceCm: parseFloat(e.target.value) || 56,
                  })
                }
                className="w-full text-base font-bold p-3 bg-white border border-[#DDD7CD] rounded-xl focus:ring-2 focus:ring-[#2D5A43]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#4A504A] mb-1">
                {t.totalLengthLabel}
              </label>
              <input
                type="number"
                step="0.5"
                value={constraints.lengthCm}
                onChange={(e) =>
                  onChange({
                    ...constraints,
                    targetSize: 'custom',
                    lengthCm: parseFloat(e.target.value) || 22,
                  })
                }
                className="w-full text-base font-bold p-3 bg-white border border-[#DDD7CD] rounded-xl focus:ring-2 focus:ring-[#2D5A43]"
              />
            </div>
          </div>

          {/* Negative Ease for Beanies */}
          {isBeanie && (
            <div>
              <div className="flex items-center justify-between text-xs font-medium text-[#4A504A] mb-1">
                <span>{t.hatEaseLabel}</span>
                <span className="font-bold text-[#2D5A43]">
                  {constraints.easeCm > 0
                    ? `+${constraints.easeCm} cm (${t.easeSlouchy})`
                    : `${constraints.easeCm} cm (${t.easeSnug})`}
                </span>
              </div>
              <input
                type="range"
                min="-8"
                max="2"
                step="1"
                value={constraints.easeCm}
                onChange={(e) =>
                  onChange({
                    ...constraints,
                    easeCm: parseInt(e.target.value, 10),
                  })
                }
                className="w-full accent-[#2D5A43] h-2 bg-[#EFECE6] rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-[#6F756F]">
                <span>{t.easeVerySnug}</span>
                <span>{t.easeStandard}</span>
                <span>{t.easeLoose}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Yarn and Needle Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-[#1F2421] mb-1">
            {t.yarnWeightLabel}
          </label>
          <select
            value={constraints.yarnWeight}
            onChange={(e) => handleYarnChange(e.target.value as YarnWeightCategory)}
            className="w-full text-xs font-medium p-3 bg-[#FAF8F5] border border-[#DDD7CD] rounded-xl focus:ring-2 focus:ring-[#2D5A43]"
          >
            {Object.keys(YARN_SPECS).map((k) => (
              <option key={k} value={k}>
                {isEs ? (YARN_NAMES_ES[k] || k) : `${k} (~${YARN_SPECS[k].metersPer100g}m / 100g)`}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#1F2421] mb-1">
            {t.needleSizeLabel}
          </label>
          <select
            value={constraints.needleSizeMm}
            onChange={(e) =>
              onChange({
                ...constraints,
                needleSizeMm: parseFloat(e.target.value),
              })
            }
            className="w-full text-xs font-medium p-3 bg-[#FAF8F5] border border-[#DDD7CD] rounded-xl focus:ring-2 focus:ring-[#2D5A43]"
          >
            {[2.5, 3.0, 3.25, 3.5, 3.75, 4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 8.0, 9.0, 10.0].map(
              (mm) => (
                <option key={mm} value={mm}>
                  {mm} mm {isEs ? `(equivalente US ${needleToUs(mm)})` : `(US ${needleToUs(mm)})`}
                </option>
              )
            )}
          </select>
        </div>
      </div>

      {/* Compile Button (Huge tactile tap target for mobile / iPad) */}
      <div className="pt-2">
        <button
          type="button"
          onClick={onCompile}
          className="w-full py-4 sm:py-5 px-6 rounded-2xl font-bold text-base text-white bg-[#2D5A43] hover:bg-[#234734] transition shadow-md flex items-center justify-center gap-2.5 active:scale-98 cursor-pointer"
        >
          <Calculator className="w-5 h-5" />
          <span>{t.btnCompile}</span>
        </button>
      </div>
    </div>
  );
};
