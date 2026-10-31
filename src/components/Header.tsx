import React from 'react';
import {
  Sparkles,
  Printer,
  RotateCcw,
  BookOpen,
  Image as ImageIcon,
  ListOrdered,
  BookmarkCheck,
  FolderHeart,
  Settings,
} from 'lucide-react';
import { Language } from '../i18n/translations';

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
  savedCount,
}) => {
  const isEs = lang === 'es';

  return (
    <header className="sticky top-0 z-40 bg-[#FAF8F5]/95 backdrop-blur-md border-b border-[#E8E3DC] no-print">
      <div className="max-w-5xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-2">
        {/* Brand */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-[#2D5A43] to-[#1C3A2B] text-white flex items-center justify-center shadow-xs">
            <span className="text-base sm:text-lg font-bold font-mono">K</span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-sm sm:text-base font-bold text-[#1F2421]">KnitVision</h1>
              <span className="text-[10px] bg-[#E4ECE7] text-[#2D5A43] px-2 py-0.5 rounded-full font-bold hidden sm:inline-block">
                {isEs ? 'Patrón Fácil' : 'Easy Pattern'}
              </span>
            </div>
          </div>
        </div>

        {/* Clean, Non-Dense Navigation Tabs for Phone & iPad */}
        <nav className="flex items-center bg-[#EFECE6] p-1 rounded-2xl text-xs font-semibold text-[#4A504A] overflow-x-auto scrollbar-none gap-0.5">
          <button
            type="button"
            onClick={() => setActiveTab('photo')}
            className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'photo'
                ? 'bg-white text-[#1F2421] shadow-xs font-bold'
                : 'hover:text-[#1F2421]'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>{isEs ? 'Prenda' : 'Garment'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('pattern')}
            className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'pattern'
                ? 'bg-white text-[#1F2421] shadow-xs font-bold'
                : 'hover:text-[#1F2421]'
            }`}
          >
            <ListOrdered className="w-3.5 h-3.5" />
            <span>{isEs ? 'Patrón' : 'Pattern'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('counter')}
            className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'counter'
                ? 'bg-white text-[#2D5A43] shadow-xs font-bold'
                : 'hover:text-[#1F2421]'
            }`}
          >
            <BookmarkCheck className="w-3.5 h-3.5 text-[#2D5A43]" />
            <span>{isEs ? 'Contador' : 'Counter'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('projects')}
            className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'projects'
                ? 'bg-white text-[#1F2421] shadow-xs font-bold'
                : 'hover:text-[#1F2421]'
            }`}
          >
            <FolderHeart className="w-3.5 h-3.5" />
            <span>{isEs ? 'Mis Tejidos' : 'Saved'}</span>
            {savedCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-[#2D5A43] text-white text-[9px] font-bold flex items-center justify-center">
                {savedCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`px-2.5 py-1.5 rounded-xl whitespace-nowrap transition-all flex items-center gap-1 cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-white text-[#1F2421] shadow-xs font-bold'
                : 'hover:text-[#1F2421]'
            }`}
            title={isEs ? 'Ajustes' : 'Settings'}
            aria-label={isEs ? 'Ajustes' : 'Settings'}
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </nav>

        {/* Right side quick actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={onOpenCraftNotes}
            title={isEs ? 'Guía tejedora y fuentes' : 'Craft guide & sources'}
            aria-label="Guía Tejedora"
            className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-[#2D5A43] bg-[#E4ECE7] hover:bg-[#D5E3DC] rounded-xl transition cursor-pointer active:scale-95"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span className="text-[11px]">{isEs ? 'Guía' : 'Guide'}</span>
          </button>

          {hasCompiledPattern && (
            <button
              onClick={onPrint}
              aria-label="Imprimir patrón"
              className="hidden md:inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-[#1F2421] bg-white border border-[#DDD7CD] rounded-xl hover:bg-[#F3EFEA] transition shadow-2xs cursor-pointer active:scale-95"
            >
              <Printer className="w-3.5 h-3.5 text-[#2D5A43]" />
              <span className="text-[11px]">PDF</span>
            </button>
          )}

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
