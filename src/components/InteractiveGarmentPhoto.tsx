import React, { useState } from 'react';
import {
  Upload,
  CheckCircle2,
  Sparkles,
  ChevronRight,
  Info,
  Layers,
  ArrowDown,
} from 'lucide-react';
import { KnitBlueprint } from '../types/knit';
import { Language, TRANSLATIONS } from '../i18n/translations';

interface InteractiveGarmentPhotoProps {
  currentImage: string | null;
  onImageSelected: (base64OrUrl: string, presetKey?: string) => void;
  blueprint: KnitBlueprint | null;
  lang: Language;
  onSelectSection: (sectionId: 'brim' | 'body' | 'crown') => void;
  castOnSts: number;
}

export const InteractiveGarmentPhoto: React.FC<InteractiveGarmentPhotoProps> = ({
  currentImage,
  onImageSelected,
  blueprint,
  lang,
  onSelectSection,
  castOnSts,
}) => {
  const [activePin, setActivePin] = useState<'brim' | 'body' | 'crown' | null>('brim');
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const isEs = lang === 'es';

  const sampleNorthFacePath = '/assets/aistudio/IMG_0240_e50ab8f0.jpg';

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) onImageSelected(result);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="bg-white rounded-3xl border border-[#E8E3DC] shadow-xs p-4 sm:p-6 space-y-4">
      {/* Friendly Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#F0ECE6] pb-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-[#1F2421]">
            {isEs ? '1. Mirá la prenda y tocá cada parte' : '1. Look at the garment & tap each part'}
          </h2>
          <p className="text-xs sm:text-sm text-[#6F756F]">
            {isEs
              ? 'Tocá los puntos amarillos sobre el gorro para ver cómo se teje cada parte.'
              : 'Tap the pins on the photo to see how each part is knitted.'}
          </p>
        </div>

        {/* Change photo button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold text-[#2D5A43] bg-[#E4ECE7] hover:bg-[#D5E3DC] transition flex items-center gap-1.5 active:scale-95 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{isEs ? 'Subir otra foto' : 'Upload other photo'}</span>
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

      {/* Photo with Clickable Interactive Pins */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
        {/* The Image Canvas with Touch Hotspots */}
        <div className="lg:col-span-7">
          <div className="relative rounded-2xl overflow-hidden border border-[#E8E3DC] bg-[#F7F5F0] flex items-center justify-center min-h-[320px] max-h-[440px] select-none">
            {currentImage && (
              <div className="relative w-full h-full flex items-center justify-center">
                <img
                  src={currentImage}
                  alt="Prenda tejida"
                  className="max-h-[420px] w-auto object-contain mx-auto"
                />

                {/* Hotspot Pin 1: Coronilla (Crown) */}
                <button
                  type="button"
                  onClick={() => {
                    setActivePin('crown');
                    onSelectSection('crown');
                  }}
                  aria-label="Ver parte de la coronilla"
                  className={`absolute top-[12%] left-[50%] -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-full shadow-lg font-bold text-xs transition-transform cursor-pointer active:scale-90 ${
                    activePin === 'crown'
                      ? 'bg-[#1C3A2B] text-white ring-4 ring-[#A3D9B5] scale-105 z-20'
                      : 'bg-[#FAF8F5]/95 text-[#1F2421] border border-[#DDD7CD] hover:bg-white z-10'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
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
                  className={`absolute top-[48%] left-[32%] -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-full shadow-lg font-bold text-xs transition-transform cursor-pointer active:scale-90 ${
                    activePin === 'body'
                      ? 'bg-[#1C3A2B] text-white ring-4 ring-[#A3D9B5] scale-105 z-20'
                      : 'bg-[#FAF8F5]/95 text-[#1F2421] border border-[#DDD7CD] hover:bg-white z-10'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
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
                  className={`absolute bottom-[16%] left-[50%] -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-full shadow-lg font-bold text-xs transition-transform cursor-pointer active:scale-90 ${
                    activePin === 'brim'
                      ? 'bg-[#1C3A2B] text-white ring-4 ring-[#A3D9B5] scale-105 z-20'
                      : 'bg-[#FAF8F5]/95 text-[#1F2421] border border-[#DDD7CD] hover:bg-white z-10'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
                  <span>{isEs ? `1. Puño: Montar ${castOnSts} puntos` : `1. Cuff: Cast on ${castOnSts} sts`}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Explanatory Spotlight for the tapped section */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-[#FAF8F5] rounded-3xl p-5 border border-[#E8E3DC] space-y-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#2D5A43] bg-[#E4ECE7] px-2.5 py-0.5 rounded-full">
              {isEs ? 'Detalle de la parte seleccionada' : 'Selected part explanation'}
            </span>

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
                <div className="p-3 bg-white rounded-xl border border-[#DDD7CD] text-xs font-semibold text-[#2D5A43]">
                  💡 {isEs ? 'Consejo: Usá un montaje elástico (hebra larga) para que no tire en la cabeza.' : 'Tip: Use a stretchy cast-on so it slips comfortably over the head.'}
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
                    ? 'Se continúa recto en elástico 1x1 siguiendo las rayas: fondo verde salvia con pinstripes blanco crema y verde oliva oscuro. Se teje hasta tener unos 17 cm totales antes de empezar a disminuir.'
                    : 'Continue straight in 1x1 rib following vertical stripes: sage green background with cream white and dark olive accents. Knit until ~17 cm total before beginning crown decreases.'}
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <span className="w-4 h-4 rounded-full bg-[#718873] border border-black/10" title="Verde Salvia" />
                  <span className="w-4 h-4 rounded-full bg-[#F4F5F0] border border-black/10" title="Blanco Crema" />
                  <span className="w-4 h-4 rounded-full bg-[#374735] border border-black/10" title="Oliva Oscuro" />
                  <span className="text-xs text-[#6F756F]">
                    {isEs ? '3 colores detectados' : '3 detected colors'}
                  </span>
                </div>
              </div>
            )}

            {activePin === 'crown' && (
              <div className="space-y-2 animate-in fade-in">
                <h3 className="text-base sm:text-lg font-bold text-[#1F2421]">
                  {isEs ? 'Disminuciones de Coronilla (4 Gajos)' : 'Crown Decreases (4 Wedges)'}
                </h3>
                <p className="text-xs sm:text-sm text-[#4A504A] leading-relaxed">
                  {isEs
                    ? 'Dividimos los puntos en 4 gajos iguales. En cada vuelta de disminución restamos 8 puntos (2 por gajo) haciendo 1 surjete simple y 2 puntos juntos. Al final pasamos la hebra por los últimos puntos y cerramos como una bolsita.'
                    : 'We divide stitches into 4 equal wedges. Each decrease round removes 8 stitches (2 per wedge) using 1 ssk and 1 k2tog. Finally, draw yarn through remaining stitches and pull tight like a drawstring.'}
                </p>
                <div className="p-3 bg-white rounded-xl border border-[#DDD7CD] text-xs font-semibold text-[#2D5A43]">
                  ✨ {isEs ? 'Queda una punta redondeada y prolija sin picos raros.' : 'Creates a clean, round silhouette without bunching.'}
                </div>
              </div>
            )}

            {/* Jump to instructions button */}
            <button
              type="button"
              onClick={() => onSelectSection(activePin || 'brim')}
              className="w-full py-3 px-4 rounded-2xl bg-[#2D5A43] hover:bg-[#234734] text-white font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 shadow-xs active:scale-95 cursor-pointer"
            >
              <span>{isEs ? 'Ver las vueltas de esta parte' : 'Go to instructions for this section'}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
