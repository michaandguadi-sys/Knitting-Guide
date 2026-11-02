import React from 'react';
import {
  Printer,
  RotateCcw,
  BookOpen,
  Sparkles,
} from 'lucide-react';
import { Language } from '../i18n/translations';
import { getStoredApiKey, isApiKeyVerified } from '../utils/aiAnalyzer';

export type AppNavTab = 'photo' | 'pattern' | 'counter' | 'projects' | 'settings';

interface HeaderProps {
  onReset: () => void;
  onPrint: () => void;
  hasCompiledPattern: boolean;
  activeTab: AppNavTab;
  setActiveTab: (tab: AppNavTab) => void;
  lang: Language;
  onOpenCraftNotes: () => void;
  savedCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  onReset,
  onPrint,
  hasCompiledPattern,
  activeTab,
  setActiveTab,
  lang,
  onOpenCraftNotes,
}) => {
  const isEs = lang === 'es';
  const hasKey = Boolean(getStoredApiKey());
  const isVerified = isApiKeyVerified();

  return (
    <header className="sticky top-0 z-40 bg-[#FAF8F5]/95 backdrop-blur-md border-b border-[#E8E3DC] no-print">
      <div className="max-w-5xl mx-auto px-3 sm:px-6 h-15 sm:h-16 flex items-center justify-between gap-3">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-2xl bg-gradient-to-br from-[#2D5A43] to-[#1C3A2B] text-white flex items-center justify-center shadow-xs">
            <span className="text-base sm:text-lg font-black font-mono">K</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black tracking-tight text-[#1F2421]">KnitVision</h1>
              
              {/* AI Key Status indicator */}
              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                className={`text-[10px] sm:text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 cursor-pointer transition active:scale-95 ${
                  hasKey && isVerified
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : hasKey
                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                    : 'bg-[#E4ECE7] text-[#2D5A43]'
                }`}
                title={isEs ? 'Tocar para ver estado de IA en Ajustes' : 'Tap to inspect AI status in Settings'}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    hasKey && isVerified
                      ? 'bg-emerald-500 animate-pulse'
                      : hasKey
                      ? 'bg-amber-500'
                      : 'bg-[#2D5A43]'
                  }`}
                />
                <span>
                  {hasKey && isVerified
                    ? (isEs ? 'IA activa' : 'AI on')
                    : hasKey
                    ? (isEs ? 'IA sin verificar' : 'AI unverified')
                    : (isEs ? 'Modo Offline' : 'Offline Mode')}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Right side quick actions (Print, Guide, Reset) */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={onOpenCraftNotes}
            title={isEs ? 'Guía tejedora y fuentes' : 'Craft guide & sources'}
            aria-label="Guía Tejedora"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#2D5A43] bg-[#E4ECE7] hover:bg-[#D5E3DC] rounded-xl transition cursor-pointer active:scale-95 touch-manipulation min-h-[38px]"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>{isEs ? 'Guía' : 'Guide'}</span>
          </button>

          {hasCompiledPattern && (
            <button
              onClick={onPrint}
              aria-label="Imprimir patrón"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#1F2421] bg-white border border-[#DDD7CD] rounded-xl hover:bg-[#F3EFEA] transition shadow-2xs cursor-pointer active:scale-95 touch-manipulation min-h-[38px]"
            >
              <Printer className="w-3.5 h-3.5 text-[#2D5A43]" />
              <span>PDF</span>
            </button>
          )}

          <button
            onClick={onReset}
            title={isEs ? 'Reiniciar' : 'Reset'}
            aria-label="Reiniciar"
            className="p-2 text-[#8C938C] hover:text-[#1F2421] hover:bg-[#EFECE6] rounded-xl transition cursor-pointer active:scale-95 touch-manipulation min-h-[38px] min-w-[38px] flex items-center justify-center"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
