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

interface MobileBottomNavProps {
  activeTab: AppNavTab;
  setActiveTab: (tab: AppNavTab) => void;
  lang: Language;
  savedCount: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  setActiveTab,
  lang,
  savedCount,
}) => {
  const isEs = lang === 'es';

  const triggerHaptic = () => {
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(15);
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
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#FAF8F5]/95 backdrop-blur-md border-t border-[#E8E3DC] px-2 py-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-lg no-print">
      <nav className="flex items-center justify-around max-w-lg mx-auto">
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
              className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition active:scale-95 touch-manipulation cursor-pointer relative ${
                isActive
                  ? 'text-[#2D5A43] font-bold'
                  : 'text-[#6F756F] hover:text-[#1F2421]'
              }`}
            >
              <div
                className={`p-1 rounded-xl transition ${
                  isActive ? 'bg-[#E4ECE7]' : ''
                }`}
              >
                <Icon className={`w-5 h-5 ${item.highlight && isActive ? 'text-[#2D5A43]' : ''}`} />
              </div>
              <span className="text-[10px] mt-0.5 leading-none">{item.label}</span>

              {Boolean(item.badge && item.badge > 0) && (
                <span className="absolute top-0.5 right-3 w-4 h-4 rounded-full bg-[#2D5A43] text-white text-[9px] font-bold flex items-center justify-center shadow-xs">
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
