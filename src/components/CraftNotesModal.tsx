import React from 'react';
import {
  X,
  BookOpen,
  ExternalLink,
  Sparkles,
  Layers,
  Compass,
  CheckCircle2,
  HelpCircle,
  Coffee,
} from 'lucide-react';
import { Language } from '../i18n/translations';

interface CraftNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
}

export const CraftNotesModal: React.FC<CraftNotesModalProps> = ({
  isOpen,
  onClose,
  lang,
}) => {
  if (!isOpen) return null;
  const isEs = lang === 'es';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-[#E8E3DC] overflow-hidden my-auto max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#F0ECE6] flex items-center justify-between bg-[#FAF8F5]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#2D5A43] text-white flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-[#1F2421]">
                  {isEs ? 'Guía para la Maestra Tejedora & Fuentes' : 'Master Knitter Guide & Sources'}
                </h3>
                <span className="text-[10px] bg-[#E4ECE7] text-[#2D5A43] font-bold px-2 py-0.5 rounded-full">
                  {isEs ? 'Para tejer con el mate' : 'Craft Theory'}
                </span>
              </div>
              <p className="text-xs text-[#6F756F]">
                {isEs
                  ? 'Explicaciones técnicas sobre por qué este patrón funciona, física del elástico y fuentes académicas.'
                  : 'Technical explanations of garment geometry, elastic physics, and academic citations.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar modal"
            className="p-2 rounded-xl text-[#6F756F] hover:text-[#1F2421] hover:bg-[#EFECE6] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs sm:text-sm text-[#4A504A]">
          {/* Note to Mother in law */}
          {isEs && (
            <div className="p-4 rounded-2xl bg-[#F7F5EE] border border-[#DFD8CC] flex items-start gap-3">
              <Coffee className="w-5 h-5 text-[#2D5A43] flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold text-[#1F2421] text-xs">
                  Dedicado a las tejedoras con experiencia:
                </span>
                <p className="text-xs text-[#4A504A] leading-relaxed">
                  Sabemos que nada reemplaza la mano de una buena tejedora. Esta herramienta no inventa números al azar: calcula los múltiplos exactos para que las disminuciones cierren limpias y la prenda calce perfecto desde el primer intento.
                </p>
              </div>
            </div>
          )}

          {/* Section 1: Crown Decreases */}
          <div className="space-y-2">
            <h4 className="font-bold text-[#1F2421] text-sm sm:text-base flex items-center gap-2">
              <Compass className="w-4 h-4 text-[#2D5A43]" />
              {isEs ? '1. Geometría de la Coronilla (¿Por qué 4 gajos?)' : '1. Crown Geometry (Why 4 Wedges?)'}
            </h4>
            <p className="leading-relaxed">
              {isEs
                ? 'El gorro de muestra (estilo The North Face o gorro pescador clásico) utiliza 4 líneas de disminución simétricas. En cada vuelta de disminución, se cierran 2 puntos por gajo (1 a la izquierda con surjete simple y 1 a la derecha con 2 puntos juntos), lo que resta exactamente 8 puntos por vuelta. Al alternar una vuelta de disminuciones con una vuelta sin disminuciones, se logra una inclinación uniforme de 45° que redondea la cabeza sin formar picos ni frunces desprolijos.'
                : 'The reference beanie features 4 symmetrical decrease lines. On decrease rounds, 2 stitches are reduced per wedge (1 left-slanting ssk, 1 right-slanting k2tog), removing exactly 8 stitches per round. Alternating decrease rounds with plain rounds yields a steady 45° incline that fits the cranial curvature smoothly without bunching.'}
            </p>
          </div>

          {/* Section 2: Negative Ease */}
          <div className="space-y-2">
            <h4 className="font-bold text-[#1F2421] text-sm sm:text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#2D5A43]" />
              {isEs ? '2. La Física del Elástico y la Holgura Negativa' : '2. Ribbing Physics & Negative Ease'}
            </h4>
            <p className="leading-relaxed">
              {isEs
                ? 'El punto elástico 1x1 tiene un poder de estiramiento lateral de entre 30% y 45%. Si montaras puntos para la medida exacta de la cabeza (por ejemplo, 56 cm), el gorro quedaría flojo y se caería sobre los ojos con el uso. Por eso aplicamos entre -4 cm y -6 cm de holgura negativa: la prenda se teje a 51-52 cm para que al colocarse quede firme, cómoda y abrigada.'
                : '1x1 ribbing possesses 30% to 45% lateral elasticity. Casting on for the exact head circumference (e.g. 56 cm) results in a hat that slips down over the wearer’s eyes after a few hours. The engine enforces -4 cm to -6 cm of negative ease so the fabric hugs the head comfortably and retains thermal memory.'}
            </p>
          </div>

          {/* Section 3: Argentine Yarn Guide */}
          <div className="space-y-2">
            <h4 className="font-bold text-[#1F2421] text-sm sm:text-base flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#2D5A43]" />
              {isEs ? '3. Guía de Hilados Argentinos y Agujas en Milímetros' : '3. Yarn Weights & Metric Needles'}
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border border-[#E8E3DC] rounded-xl overflow-hidden">
                <thead className="bg-[#FAF8F5] text-[#1F2421] font-bold border-b border-[#E8E3DC]">
                  <tr>
                    <th className="p-2.5">{isEs ? 'Grosor en Argentina' : 'Standard Category'}</th>
                    <th className="p-2.5">{isEs ? 'Nombre Habitual' : 'Yarn Weight'}</th>
                    <th className="p-2.5">{isEs ? 'Agujas recomendadas' : 'Needle Size'}</th>
                    <th className="p-2.5">{isEs ? 'Muestra aprox. (10cm)' : 'Gauge (10cm)'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0ECE6]">
                  <tr>
                    <td className="p-2.5 font-semibold text-[#1F2421]">Semigrueso</td>
                    <td className="p-2.5">Cashmilon 4/7, Merino semigruesa, Nevadita</td>
                    <td className="p-2.5 font-mono">4.5 mm – 5.0 mm</td>
                    <td className="p-2.5">17 – 20 puntos</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-semibold text-[#1F2421]">Mediano</td>
                    <td className="p-2.5">Hilado 2/7, Dralón mediano</td>
                    <td className="p-2.5 font-mono">3.75 mm – 4.0 mm</td>
                    <td className="p-2.5">21 – 23 puntos</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-semibold text-[#1F2421]">Fino</td>
                    <td className="p-2.5">Cashmilon fino 3/8, Bremer fino, Bebé</td>
                    <td className="p-2.5 font-mono">2.5 mm – 3.25 mm</td>
                    <td className="p-2.5">26 – 30 puntos</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-semibold text-[#1F2421]">Grueso</td>
                    <td className="p-2.5">Mecha, Hilado 3/4, Rústico</td>
                    <td className="p-2.5 font-mono">6.0 mm – 8.0 mm</td>
                    <td className="p-2.5">12 – 15 puntos</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 4: Academic Sources & Beyond */}
          <div className="space-y-3 border-t border-[#E8E3DC] pt-4">
            <h4 className="font-bold text-[#1F2421] text-sm sm:text-base flex items-center gap-2">
              <ExternalLink className="w-4 h-4 text-[#2D5A43]" />
              {isEs ? '4. Fuentes Académicas y Referencias' : '4. Academic Citations & Further Reading'}
            </h4>
            <div className="space-y-2">
              <div className="bg-[#FAF8F5] p-3 rounded-xl border border-[#E8E3DC]">
                <div className="font-bold text-[#1F2421] text-xs">
                  MIT CSAIL: InverseKnit Machine Vision Research
                </div>
                <p className="text-[11px] text-[#6F756F] mt-0.5">
                  Alexandre Kaspar et al. (MIT Computer Science and Artificial Intelligence Laboratory). Demonstrated that multi-stage computer vision decoupling stitch topology from geometric scaling achieves near-zero error rates compared to end-to-end models.
                </p>
              </div>

              <div className="bg-[#FAF8F5] p-3 rounded-xl border border-[#E8E3DC]">
                <div className="font-bold text-[#1F2421] text-xs">
                  Craft Yarn Council (CYC) Technical Knitting Standards
                </div>
                <p className="text-[11px] text-[#6F756F] mt-0.5">
                  International standard abbreviations, sizing charts, and tension metrics used by major pattern designers worldwide.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-[#F0ECE6] bg-[#FAF8F5] flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#2D5A43] hover:bg-[#234734] transition shadow-xs"
          >
            {isEs ? 'Entendido, volver al patrón' : 'Got it, back to pattern'}
          </button>
        </div>
      </div>
    </div>
  );
};
