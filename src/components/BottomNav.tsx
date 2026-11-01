import React from 'react';
import {
  Camera,
  ListOrdered,
  BookmarkCheck,
  FolderHeart,
  Settings,
} from 'lucide-react';
import { AppNavTab } from './Header';
import { Language } from '../i18n/translations';

interface BottomNavProps {
  activeTab: AppNavTab;
  setActiveTab: (tab: AppNavTab) => void;
  lang: Language;
  savedCount: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  setActiveTab,
  lang,
  savedCount,
}) => {
  const isEs = lang === 'es';

  const triggerHaptic = () => {
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(20);
      }
    } catch {
      // ignore
    }
  };

  const navItems = [
    {
      id: 'photo' as AppNavTab,
      label: isEs ? 'Prenda' : 'Garment',
      icon: Camera,
    },
    {
      id: 'pattern' as AppNavTab,
      label: isEs ? 'Patrón' : 'Pattern',
      icon: ListOrdered,
    },
    {
      id: 'counter' as AppNavTab,
      label: isEs ? 'Contador' : 'Counter',
      icon: BookmarkCheck,
      highlight: true,
    },
    {
      id: 'projects' as AppNavTab,
      label: isEs ? 'Guardados' : 'Saved',
      icon: FolderHeart,
      badge: savedCount,
    },
    {
      id: 'settings' as AppNavTab,
      label: isEs ? 'Ajustes' : 'Settings',
      icon: Settings,
    },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#FAF8F5]/95 backdrop-blur-md border-t border-[#E8E3DC] px-2 sm:px-4 py-2 pb-[max(0.6rem,env(safe-area-inset-bottom))] shadow-xl no-print">
      <nav className="flex items-center justify-around max-w-xl mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                triggerHaptic();
                setActiveTab(item.id);
              }}
              className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-2xl transition-all active:scale-90 touch-manipulation cursor-pointer relative min-h-[48px] ${
                isActive
                  ? 'text-[#2D5A43] font-bold'
                  : 'text-[#6F756F] hover:text-[#1F2421]'
              }`}
            >
              <div
                className={`p-1.5 rounded-2xl transition-all ${
                  isActive
                    ? 'bg-[#E4ECE7] text-[#2D5A43] scale-105 shadow-2xs ring-1 ring-[#2D5A43]/20'
                    : 'hover:bg-black/5'
                }`}
              >
                <Icon className={`w-5 h-5 sm:w-5.5 sm:h-5.5 ${item.highlight && isActive ? 'text-[#2D5A43]' : ''}`} />
              </div>
              <span className="text-[10px] sm:text-[11px] mt-0.5 leading-none tracking-tight font-medium">
                {item.label}
              </span>

              {Boolean(item.badge && item.badge > 0) && (
                <span className="absolute top-0 right-3 sm:right-6 w-4 h-4 rounded-full bg-[#2D5A43] text-white text-[9px] font-bold flex items-center justify-center shadow-xs">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
};
