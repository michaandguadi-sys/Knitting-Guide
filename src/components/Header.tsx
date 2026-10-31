import React from 'react';
import { Sparkles, Printer, RotateCcw, BookOpen } from 'lucide-react';
import { Language } from '../i18n/translations';

interface HeaderProps {
  onReset: () => void;
  onPrint: () => void;
  hasCompiledPattern: boolean;
  lang: Language;
  onToggleLang: () => void;
  onOpenCraftNotes: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onReset,
  onPrint,
  hasCompiledPattern,
  lang,
  onToggleLang,
  onOpenCraftNotes,
}) => {
  const isEs = lang === 'es';

  return (
    <header className="sticky top-0 z-40 bg-[#FAF8F5]/95 backdrop-blur-md border-b border-[#E8E3DC] no-print">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#2D5A43] to-[#1C3A2B] text-white flex items-center justify-center shadow-xs">
            <span className="text-lg font-bold font-mono">K</span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-base sm:text-lg font-bold text-[#1F2421]">KnitVision</h1>
              <span className="text-[10px] bg-[#E4ECE7] text-[#2D5A43] px-2 py-0.5 rounded-full font-bold">
                {isEs ? 'Patrón Fácil' : 'Easy Pattern'}
              </span>
            </div>
            <p className="text-[11px] text-[#6F756F] hidden sm:block">
              {isEs ? 'De foto a patrón de tejido a dos agujas' : 'From photo to knitting pattern'}
            </p>
          </div>
        </div>

        {/* Right side actions - discreet, clean, low noise */}
        <div className="flex items-center gap-2">
          {/* Guide & Sources Modal */}
          <button
            onClick={onOpenCraftNotes}
            title={isEs ? 'Guía tejedora y fuentes' : 'Craft guide and sources'}
            aria-label="Guía Tejedora"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#2D5A43] bg-[#E4ECE7] hover:bg-[#D5E3DC] rounded-xl transition cursor-pointer active:scale-95"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span className="text-xs">{isEs ? 'Guía Tejedora' : 'Craft Guide'}</span>
          </button>

          {/* Print button */}
          {hasCompiledPattern && (
            <button
              onClick={onPrint}
              aria-label="Imprimir patrón"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#1F2421] bg-white border border-[#DDD7CD] rounded-xl hover:bg-[#F3EFEA] transition shadow-2xs cursor-pointer active:scale-95"
            >
              <Printer className="w-3.5 h-3.5 text-[#2D5A43]" />
              <span>{isEs ? 'Imprimir / PDF' : 'Print / PDF'}</span>
            </button>
          )}

          {/* Discreet Language Pill Toggle */}
          <button
            onClick={onToggleLang}
            title={isEs ? 'Switch to English' : 'Cambiar a Español'}
            aria-label="Cambiar idioma"
            className="px-2.5 py-1 text-[11px] font-bold text-[#6F756F] hover:text-[#1F2421] bg-white border border-[#DDD7CD] rounded-lg transition active:scale-95 cursor-pointer"
          >
            {isEs ? '🇦🇷 ES' : '🇬🇧 EN'}
          </button>

          {/* Reset */}
          <button
            onClick={onReset}
            title={isEs ? 'Reiniciar' : 'Reset'}
            aria-label="Reiniciar"
            className="p-1.5 text-[#8C938C] hover:text-[#1F2421] hover:bg-[#EFECE6] rounded-xl transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
