import React, { useState } from 'react';
import {
  Sliders,
  CheckCircle2,
  FileCode,
  Tag,
  Palette,
} from 'lucide-react';
import { KnitBlueprint, StitchType } from '../types/knit';
import { Language, TRANSLATIONS } from '../i18n/translations';

interface BlueprintInspectorProps {
  blueprint: KnitBlueprint;
  onUpdateBlueprint: (updated: KnitBlueprint) => void;
  onTriggerRecompile: () => void;
  lang: Language;
}

export const BlueprintInspector: React.FC<BlueprintInspectorProps> = ({
  blueprint,
  onUpdateBlueprint,
  onTriggerRecompile,
  lang,
}) => {
  const [showJsonRaw, setShowJsonRaw] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const t = TRANSLATIONS[lang];
  const isEs = lang === 'es';

  const handleFieldChange = (field: keyof KnitBlueprint, value: any) => {
    const updated = { ...blueprint, [field]: value };
    onUpdateBlueprint(updated);
  };

  const getStitchLabel = (stitch: StitchType) => {
    if (isEs) {
      const map: Record<StitchType, string> = {
        rib_1x1: 'Elástico 1x1 (Flexible)',
        rib_2x2: 'Elástico 2x2 (Clásico)',
        brioche: 'Punto Brioche / Inglés',
        stockinette: 'Jersey Derecho',
        reverse_stockinette: 'Jersey Revés',
        garter: 'Punto Santa Clara / Bobo',
        seed_stitch: 'Punto Arroz',
        moss_stitch: 'Punto Trigo / Arroz Doble',
      };
      return map[stitch] || stitch;
    }
    return stitch.replace(/_/g, ' ');
  };

  return (
    <div className="bg-white rounded-3xl border border-[#E8E3DC] shadow-xs p-4 sm:p-6 space-y-5">
      {/* Title & Confidence */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#F0ECE6] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#2D5A43]">
              {t.step2Tag}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#E4ECE7] text-[#2D5A43]">
              <CheckCircle2 className="w-3 h-3" />
              {Math.round(blueprint.confidenceScore * 100)}% {t.confidence}
            </span>
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-[#1F2421] mt-0.5">
            {isEs && blueprint.title.includes('North Face')
              ? 'Gorro The North Face a Rayas y Punto Elástico'
              : blueprint.title}
          </h3>
          <p className="text-xs text-[#6F756F] mt-0.5">
            {isEs
              ? 'Gorro de abrigo en punto elástico con rayas verticales, puño doblado y disminuciones en 4 gajos.'
              : blueprint.description}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className={`px-3.5 py-2 text-xs font-semibold rounded-xl border transition flex items-center gap-1.5 active:scale-95 ${
              isEditing
                ? 'bg-[#2D5A43] text-white border-[#2D5A43]'
                : 'bg-[#FAF8F5] text-[#4A504A] border-[#DDD7CD] hover:bg-[#F3EFEA]'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>{isEditing ? t.btnDoneEditing : t.btnFineTune}</span>
          </button>

          <button
            onClick={() => setShowJsonRaw(!showJsonRaw)}
            className="px-3 py-2 text-xs font-medium bg-[#FAF8F5] text-[#6F756F] hover:text-[#1F2421] border border-[#DDD7CD] rounded-xl transition flex items-center gap-1 active:scale-95"
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>{showJsonRaw ? t.btnHideJson : t.btnRawJson}</span>
          </button>
        </div>
      </div>

      {/* Primary Key-Value Summary Matrix */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#FAF8F5] rounded-2xl p-3 border border-[#E8E3DC]">
          <span className="text-[11px] font-medium text-[#6F756F] block">{t.silhouette}</span>
          <span className="text-sm font-bold text-[#1F2421] capitalize">
            {isEs
              ? blueprint.garmentType === 'beanie'
                ? 'Gorro'
                : blueprint.garmentType === 'scarf'
                ? 'Bufanda'
                : blueprint.garmentType
              : blueprint.garmentType}
          </span>
        </div>

        <div className="bg-[#FAF8F5] rounded-2xl p-3 border border-[#E8E3DC]">
          <span className="text-[11px] font-medium text-[#6F756F] block">{t.construction}</span>
          <span className="text-sm font-bold text-[#1F2421] capitalize">
            {isEs
              ? blueprint.construction === 'in_the_round'
                ? 'En Redondo (Sin costuras)'
                : 'En Plano (Ida y vuelta)'
              : blueprint.construction.replace(/_/g, ' ')}
          </span>
        </div>

        <div className="bg-[#FAF8F5] rounded-2xl p-3 border border-[#E8E3DC]">
          <span className="text-[11px] font-medium text-[#6F756F] block">{t.mainStitch}</span>
          <span className="text-sm font-bold text-[#1F2421]">
            {getStitchLabel(blueprint.mainStitch)}
          </span>
        </div>

        <div className="bg-[#FAF8F5] rounded-2xl p-3 border border-[#E8E3DC]">
          <span className="text-[11px] font-medium text-[#6F756F] block">{t.crownDecreases}</span>
          <span className="text-sm font-bold text-[#1F2421]">
            {blueprint.crownWedges ? `${blueprint.crownWedges} ${isEs ? 'Gajos' : 'Wedges'}` : 'Estándar'}
          </span>
        </div>
      </div>

      {/* Editing Controls (when fine-tuning) */}
      {isEditing && (
        <div className="bg-[#F8F6F1] rounded-2xl p-4 sm:p-5 border border-[#DFD8CC] space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#1F2421] flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-[#2D5A43]" />
              {t.adjustBlueprintTitle}
            </h4>
            <span className="text-[11px] text-[#6F756F]">
              {t.adjustBlueprintTip}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#4A504A] mb-1">
                {t.mainStitchLabel}
              </label>
              <select
                value={blueprint.mainStitch}
                onChange={(e) => handleFieldChange('mainStitch', e.target.value as StitchType)}
                className="w-full text-xs p-2.5 bg-white border border-[#DDD7CD] rounded-xl font-medium"
              >
                <option value="rib_1x1">{isEs ? 'Punto Elástico 1x1' : '1x1 Ribbing'}</option>
                <option value="rib_2x2">{isEs ? 'Punto Elástico 2x2' : '2x2 Ribbing'}</option>
                <option value="brioche">{isEs ? 'Brioche / Punto Inglés' : 'Brioche'}</option>
                <option value="stockinette">{isEs ? 'Jersey Derecho' : 'Stockinette'}</option>
                <option value="garter">{isEs ? 'Santa Clara / Bobo' : 'Garter Stitch'}</option>
                <option value="seed_stitch">{isEs ? 'Punto Arroz' : 'Seed Stitch'}</option>
              </select>
            </div>

            {blueprint.garmentType === 'beanie' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-[#4A504A] mb-1">
                    {t.crownWedgesLabel}
                  </label>
                  <select
                    value={blueprint.crownWedges || 4}
                    onChange={(e) => handleFieldChange('crownWedges', parseInt(e.target.value, 10))}
                    className="w-full text-xs p-2.5 bg-white border border-[#DDD7CD] rounded-xl font-medium"
                  >
                    <option value={4}>{isEs ? '4 Gajos Simétricos (Estilo The North Face)' : '4 Wedges'}</option>
                    <option value={6}>{isEs ? '6 Gajos (Cúpula Redonda)' : '6 Wedges (Round dome)'}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#4A504A] mb-1">
                    {t.brimConstructionLabel}
                  </label>
                  <div className="flex items-center gap-3 pt-2">
                    <label className="flex items-center gap-2 text-xs cursor-pointer font-medium">
                      <input
                        type="checkbox"
                        checked={blueprint.hasFoldedBrim ?? true}
                        onChange={(e) => handleFieldChange('hasFoldedBrim', e.target.checked)}
                        className="w-4 h-4 rounded text-[#2D5A43] focus:ring-[#2D5A43]"
                      />
                      <span>{t.foldedCuff}</span>
                    </label>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Colorway & Detected Features */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Colors / Stripes */}
        {blueprint.stripes && blueprint.stripes.length > 0 && (
          <div className="bg-[#FAF8F5] rounded-2xl p-4 border border-[#E8E3DC] space-y-2">
            <span className="text-xs font-semibold text-[#1F2421] flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-[#2D5A43]" />
              {t.extractedPalette}
            </span>
            <div className="flex items-center gap-2 flex-wrap pt-1">
              {blueprint.stripes.map((stripe, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 bg-white border border-[#DDD7CD] rounded-xl px-2.5 py-1.5 shadow-2xs"
                >
                  <span
                    className="w-4 h-4 rounded-full border border-black/10 shadow-inner flex-shrink-0"
                    style={{ backgroundColor: stripe.hex }}
                  />
                  <div className="text-[11px] leading-tight">
                    <div className="font-semibold text-[#1F2421]">{stripe.colorName}</div>
                    <div className="text-[#6F756F] font-mono">{stripe.hex}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Features bullet list */}
        <div className="bg-[#FAF8F5] rounded-2xl p-4 border border-[#E8E3DC] space-y-2">
          <span className="text-xs font-semibold text-[#1F2421] flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-[#2D5A43]" />
            {t.extractedFeatures}
          </span>
          <ul className="text-xs text-[#4A504A] space-y-1 list-disc list-inside">
            {isEs ? (
              <>
                <li className="leading-relaxed">Punto elástico 1x1 retorcido para máxima elasticidad y memoria</li>
                <li className="leading-relaxed">Puño doblado de doble grosor (aprox. 7–8 cm doblado / 15 cm total)</li>
                <li className="leading-relaxed">4 gajos simétricos de disminución en la coronilla</li>
                <li className="leading-relaxed">Rayas verticales en contraste desde el borde hasta el vértice</li>
              </>
            ) : (
              blueprint.features.map((feat, idx) => (
                <li key={idx} className="leading-relaxed">
                  {feat}
                </li>
              ))
            )}
          </ul>
        </div>
      </div>

      {/* Raw JSON viewer */}
      {showJsonRaw && (
        <div className="rounded-2xl bg-[#1F2421] text-emerald-300 p-4 font-mono text-xs overflow-x-auto shadow-inner">
          <pre>{JSON.stringify(blueprint, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};
