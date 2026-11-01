import React, { useState, useRef } from 'react';
import {
  Camera,
  Upload,
  Sparkles,
  ChevronRight,
  Layers,
  CheckCircle2,
  RefreshCw,
  Scissors,
  Eye,
  Sliders,
} from 'lucide-react';
import { KnitBlueprint } from '../types/knit';
import { Language } from '../i18n/translations';
import { SAMPLE_PRESETS } from '../utils/aiAnalyzer';

interface InteractiveGarmentPhotoProps {
  currentImage: string | null;
  onImageSelected: (base64OrUrl: string, presetKey?: string) => void;
  blueprint: KnitBlueprint | null;
  lang: Language;
  onSelectSection: (sectionId: 'brim' | 'body' | 'crown') => void;
  castOnSts: number;
  isAnalyzing?: boolean;
}

export const InteractiveGarmentPhoto: React.FC<InteractiveGarmentPhotoProps> = ({
  currentImage,
  onImageSelected,
  blueprint,
  lang,
  onSelectSection,
  castOnSts,
  isAnalyzing = false,
}) => {
  const [activePin, setActivePin] = useState<'brim' | 'body' | 'crown'>('brim');
  const [viewMode, setViewMode] = useState<'isolated' | 'original'>('isolated');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const isEs = lang === 'es';

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) onImageSelected(result);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Determine which image to render (isolated garment vs full photo)
  const displayImage =
    viewMode === 'isolated' && blueprint?.isolatedImageUrl
      ? blueprint.isolatedImageUrl
      : currentImage;

  return (
    <div className="bg-white rounded-3xl border border-[#E8E3DC] shadow-xs p-4 sm:p-6 space-y-4">
      {/* Friendly Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#F0ECE6] pb-3">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#2D5A43] bg-[#E4ECE7] px-2.5 py-0.5 rounded-full inline-block mb-1">
            {isEs ? 'Paso 1: Foto y Extracción de Prenda' : 'Step 1: Photo & Garment Extraction'}
          </span>
          <h2 className="text-lg sm:text-xl font-extrabold text-[#1F2421]">
            {isEs ? 'Prenda Aislada y Puntos Clave' : 'Isolated Garment & Key Hotspots'}
          </h2>
          <p className="text-xs sm:text-sm text-[#6F756F]">
            {isEs
              ? 'El sistema aísla la prenda del fondo (mesa, sábanas o piso) para analizar solo la lana.'
              : 'The engine isolates the garment from background surfaces (tables, floors) to analyze true wool fibers.'}
          </p>
        </div>

        {/* Mobile Camera and Photo Library Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Camera Button (Opens native mobile camera) */}
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="flex-1 sm:flex-none px-3.5 py-2.5 rounded-2xl text-xs font-bold text-white bg-[#2D5A43] hover:bg-[#234734] transition flex items-center justify-center gap-1.5 shadow-xs active:scale-95 cursor-pointer touch-manipulation min-h-[44px]"
            title={isEs ? 'Tomar foto con la cámara' : 'Take photo with camera'}
          >
            <Camera className="w-4 h-4" />
            <span>{isEs ? 'Tomar Foto' : 'Take Photo'}</span>
          </button>
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* Photo Library / Upload Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 sm:flex-none px-3.5 py-2.5 rounded-2xl text-xs font-bold text-[#2D5A43] bg-[#E4ECE7] hover:bg-[#D5E3DC] transition flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer touch-manipulation min-h-[44px]"
            title={isEs ? 'Elegir de fotos del teléfono' : 'Choose from photo library'}
          >
            <Upload className="w-4 h-4" />
            <span>{isEs ? 'Elegir Foto' : 'Library'}</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </div>

      {/* Quick Model Presets Bar for Instant Phone Testing */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-[#6F756F]">
          <span className="font-semibold flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-[#2D5A43]" />
            {isEs ? 'O probá un modelo preconfigurado:' : 'Or tap a preset model:'}
          </span>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
          {SAMPLE_PRESETS.map((preset) => {
            const isSelected = currentImage === preset.imageUrl;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onImageSelected(preset.imageUrl, preset.presetKey)}
                className={`flex-shrink-0 px-3 py-2 rounded-2xl border text-xs font-semibold flex items-center gap-2 transition active:scale-95 touch-manipulation cursor-pointer ${
                  isSelected
                    ? 'bg-[#EBF2EE] border-[#2D5A43] text-[#2D5A43] ring-1 ring-[#2D5A43] shadow-2xs'
                    : 'bg-[#FAF8F5] border-[#DDD7CD] text-[#4A504A] hover:bg-[#F3EFEA]'
                }`}
              >
                <img
                  src={preset.imageUrl}
                  alt={preset.titleEs}
                  className="w-5 h-5 rounded-full object-cover border border-black/10"
                />
                <span className="whitespace-nowrap">{isEs ? preset.titleEs : preset.titleEn}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Subject Isolation Controls Bar */}
      {blueprint?.isolatedImageUrl && (
        <div className="flex items-center justify-between bg-[#F4F6F5] p-2 sm:px-3 rounded-2xl border border-[#D5E3DC] text-xs">
          <div className="flex items-center gap-1.5 text-[#2D5A43] font-bold">
            <CheckCircle2 className="w-4 h-4 text-[#2D5A43]" />
            <span>
              {isEs
                ? `Objeto extraído (${blueprint.backgroundRatio || 25}% de fondo descartado)`
                : `Garment isolated (${blueprint.backgroundRatio || 25}% background ignored)`}
            </span>
          </div>

          <div className="flex items-center gap-1 bg-white p-0.5 rounded-xl border border-[#DDD7CD]">
            <button
              type="button"
              onClick={() => setViewMode('isolated')}
              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition cursor-pointer ${
                viewMode === 'isolated'
                  ? 'bg-[#2D5A43] text-white shadow-xs'
                  : 'text-[#6F756F] hover:text-[#1F2421]'
              }`}
            >
              {isEs ? '✨ Tejido Aislado' : '✨ Isolated'}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('original')}
              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition cursor-pointer ${
                viewMode === 'original'
                  ? 'bg-[#2D5A43] text-white shadow-xs'
                  : 'text-[#6F756F] hover:text-[#1F2421]'
              }`}
            >
              {isEs ? '📷 Foto Original' : '📷 Original'}
            </button>
          </div>
        </div>
      )}

      {/* Main Interactive Canvas & Explanations */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
        {/* The Image Canvas with Touch Hotspots */}
        <div className="lg:col-span-7">
          <div className="relative rounded-3xl overflow-hidden border border-[#E8E3DC] bg-[#F7F5F0] flex items-center justify-center min-h-[300px] sm:min-h-[380px] max-h-[440px] select-none">
            {isAnalyzing && (
              <div className="absolute inset-0 bg-[#FAF8F5]/85 backdrop-blur-xs z-30 flex flex-col items-center justify-center p-6 text-center space-y-3">
                <RefreshCw className="w-8 h-8 text-[#2D5A43] animate-spin" />
                <div className="font-extrabold text-[#1F2421] text-base">
                  {isEs ? 'Aislando la prenda del fondo...' : 'Isolating garment from background...'}
                </div>
                <p className="text-xs text-[#6F756F] max-w-xs">
                  {isEs
                    ? 'Descartando la superficie (mesa o piso) y extrayendo los colores exactos de la lana.'
                    : 'Filtering background surfaces and extracting exact yarn fiber colors.'}
                </p>
              </div>
            )}

            {displayImage && (
              <div className="relative w-full h-full flex items-center justify-center p-2">
                <img
                  src={displayImage}
                  alt="Prenda tejida"
                  className="max-h-[380px] w-auto max-w-full object-contain rounded-2xl mx-auto shadow-xs"
                />

                {/* Hotspot Pin 1: Coronilla (Crown) */}
                <button
                  type="button"
                  onClick={() => {
                    setActivePin('crown');
                    onSelectSection('crown');
                  }}
                  aria-label="Ver parte de la coronilla"
                  className={`absolute top-[14%] left-[50%] -translate-x-1/2 flex items-center gap-1.5 px-3.5 py-2 rounded-full shadow-lg font-bold text-xs transition-transform cursor-pointer touch-manipulation active:scale-90 min-h-[40px] ${
                    activePin === 'crown'
                      ? 'bg-[#1C3A2B] text-white ring-4 ring-[#A3D9B5] scale-105 z-20'
                      : 'bg-[#FAF8F5]/95 text-[#1F2421] border border-[#DDD7CD] hover:bg-white z-10'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping"></span>
                  <span>{isEs ? '3. Coronilla' : '3. Crown'}</span>
                </button>

                {/* Hotspot Pin 2: Rayas y Cuerpo (Body) */}
                <button
                  type="button"
                  onClick={() => {
                    setActivePin('body');
                    onSelectSection('body');
                  }}
                  aria-label="Ver parte de las rayas del cuerpo"
                  className={`absolute top-[48%] left-[34%] -translate-x-1/2 flex items-center gap-1.5 px-3.5 py-2 rounded-full shadow-lg font-bold text-xs transition-transform cursor-pointer touch-manipulation active:scale-90 min-h-[40px] ${
                    activePin === 'body'
                      ? 'bg-[#1C3A2B] text-white ring-4 ring-[#A3D9B5] scale-105 z-20'
                      : 'bg-[#FAF8F5]/95 text-[#1F2421] border border-[#DDD7CD] hover:bg-white z-10'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping"></span>
                  <span>{isEs ? '2. Rayas y Cuerpo' : '2. Body & Stripes'}</span>
                </button>

                {/* Hotspot Pin 3: Puño Doblado (Brim) */}
                <button
                  type="button"
                  onClick={() => {
                    setActivePin('brim');
                    onSelectSection('brim');
                  }}
                  aria-label="Ver parte del puño doblado"
                  className={`absolute bottom-[16%] left-[50%] -translate-x-1/2 flex items-center gap-1.5 px-3.5 py-2 rounded-full shadow-lg font-bold text-xs transition-transform cursor-pointer touch-manipulation active:scale-90 min-h-[40px] ${
                    activePin === 'brim'
                      ? 'bg-[#1C3A2B] text-white ring-4 ring-[#A3D9B5] scale-105 z-20'
                      : 'bg-[#FAF8F5]/95 text-[#1F2421] border border-[#DDD7CD] hover:bg-white z-10'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping"></span>
                  <span>{isEs ? `1. Puño (${castOnSts}p)` : `1. Brim (${castOnSts} sts)`}</span>
                </button>
              </div>
            )}
          </div>

          {/* Extracted Wool Fiber Colors Box */}
          {blueprint?.stripes && blueprint.stripes.length > 0 && (
            <div className="mt-3 p-3 bg-[#FAF8F5] rounded-2xl border border-[#E8E3DC] flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-bold text-[#1F2421] flex items-center gap-1.5">
                <Scissors className="w-3.5 h-3.5 text-[#2D5A43]" />
                {isEs ? 'Lana detectada en la prenda:' : 'Detected garment wool colors:'}
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                {blueprint.stripes.map((st, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xl border border-[#DDD7CD] text-xs font-semibold shadow-2xs"
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-black/10 flex-shrink-0"
                      style={{ backgroundColor: st.hex }}
                    />
                    <span className="text-[#1F2421] text-[11px]">{st.colorName}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Explanatory Spotlight for the tapped section */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-[#FAF8F5] rounded-3xl p-5 border border-[#E8E3DC] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#2D5A43] bg-[#E4ECE7] px-2.5 py-0.5 rounded-full">
                {isEs ? 'Detalle de la parte elegida' : 'Selected part details'}
              </span>
              <span className="text-xs text-[#6F756F] font-semibold">
                {activePin === 'brim' ? '1 / 3' : activePin === 'body' ? '2 / 3' : '3 / 3'}
              </span>
            </div>

            {activePin === 'brim' && (
              <div className="space-y-2 animate-in fade-in">
                <h3 className="text-base sm:text-lg font-bold text-[#1F2421]">
                  {isEs ? 'Puño Doblado en Elástico 1x1' : 'Folded 1x1 Ribbed Cuff'}
                </h3>
                <p className="text-xs sm:text-sm text-[#4A504A] leading-relaxed">
                  {isEs
                    ? `Se montan ${castOnSts} puntos en agujas circulares y se teje en punto elástico (1 derecho, 1 revés) durante 15 cm. Luego se dobla hacia arriba por la mitad (quedando de 7.5 cm) para abrigar bien las orejas con doble grosor.`
                    : `Cast on ${castOnSts} stitches on circular needles and knit in 1x1 rib (K1, P1) for 15 cm. It folds upward in half (giving a 7.5 cm cuff) for double warmth around the ears.`}
                </p>
                <div className="p-3 bg-white rounded-2xl border border-[#DDD7CD] text-xs font-semibold text-[#2D5A43]">
                  💡 {isEs ? 'Consejo: Usá un montaje elástico de hebra larga para que estire bien.' : 'Tip: Use a stretchy long-tail cast-on so it slips easily over the head.'}
                </div>
              </div>
            )}

            {activePin === 'body' && (
              <div className="space-y-2 animate-in fade-in">
                <h3 className="text-base sm:text-lg font-bold text-[#1F2421]">
                  {isEs ? 'Cuerpo y Rayas Verticales' : 'Body & Vertical Stripes'}
                </h3>
                <p className="text-xs sm:text-sm text-[#4A504A] leading-relaxed">
                  {isEs
                    ? 'Se continúa recto en elástico 1x1 siguiendo las rayas del diseño: fondo con pinstripes en contraste. Se teje hasta tener unos 17 cm totales antes de comenzar la coronilla.'
                    : 'Continue straight in 1x1 rib following vertical stripes: background field with contrast pinstripes. Knit until ~17 cm total before beginning crown decreases.'}
                </p>
              </div>
            )}

            {activePin === 'crown' && (
              <div className="space-y-2 animate-in fade-in">
                <h3 className="text-base sm:text-lg font-bold text-[#1F2421]">
                  {isEs ? `Disminuciones de Coronilla (${blueprint?.crownWedges || 4} Gajos)` : `Crown Decreases (${blueprint?.crownWedges || 4} Wedges)`}
                </h3>
                <p className="text-xs sm:text-sm text-[#4A504A] leading-relaxed">
                  {isEs
                    ? 'Dividimos los puntos en 4 gajos iguales con marcadores. En cada vuelta de disminución restamos 8 puntos (2 por gajo) haciendo 1 surjete simple y 2 puntos juntos al derecho. Queda una punta redondeada perfecta.'
                    : 'We divide stitches into 4 equal wedges with stitch markers. Each decrease round removes 8 stitches (2 per wedge) using 1 ssk and 1 k2tog. Produces a neat rounded crown.'}
                </p>
                <div className="p-3 bg-white rounded-2xl border border-[#DDD7CD] text-xs font-semibold text-[#2D5A43]">
                  ✨ {isEs ? 'Al terminar, enhebrá la lana por los últimos puntos y tirá fuerte para cerrar.' : 'At the end, thread yarn through remaining sts and draw tight like a drawstring.'}
                </div>
              </div>
            )}

            {/* Jump to instructions button */}
            <button
              type="button"
              onClick={() => onSelectSection(activePin || 'brim')}
              className="w-full py-3.5 px-4 rounded-2xl bg-[#2D5A43] hover:bg-[#234734] text-white font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 shadow-xs active:scale-95 cursor-pointer touch-manipulation min-h-[44px]"
            >
              <span>{isEs ? 'Ver las vueltas de esta parte en el patrón' : 'View instructions for this section'}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
