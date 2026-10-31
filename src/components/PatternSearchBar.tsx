import React from 'react';
import { Search, X, Sparkles, HelpCircle } from 'lucide-react';
import { Language } from '../i18n/translations';

interface PatternSearchBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  lang: Language;
  resultsCount?: number;
}

export const PatternSearchBar: React.FC<PatternSearchBarProps> = ({
  searchQuery,
  onSearchChange,
  lang,
  resultsCount,
}) => {
  const isEs = lang === 'es';

  const quickChips = isEs
    ? [
        { label: '🧵 Montar puntos', query: 'montar' },
        { label: '📉 Disminuciones', query: 'disminución' },
        { label: '🥢 Agujas', query: 'agujas' },
        { label: '🧶 Lana y ovillos', query: 'lana' },
        { label: '🔄 Puño doblado', query: 'puño' },
        { label: '✨ Surjete simple', query: 'surjete' },
      ]
    : [
        { label: '🧵 Cast On', query: 'cast on' },
        { label: '📉 Decreases', query: 'decrease' },
        { label: '🥢 Needles', query: 'needles' },
        { label: '🧶 Yarn', query: 'yarn' },
        { label: '🔄 Folded Cuff', query: 'cuff' },
        { label: '✨ SSK / k2tog', query: 'ssk' },
      ];

  return (
    <div className="bg-[#FAF8F5] p-3 sm:p-4 rounded-2xl border border-[#E8E3DC] space-y-2.5">
      <div className="relative flex items-center">
        <Search className="w-4 h-4 text-[#6F756F] absolute left-3.5 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={
            isEs
              ? 'Buscar en el patrón: ej. "montar puntos", "disminución", "agujas"...'
              : 'Search pattern: e.g. "cast on", "decreases", "needles"...'
          }
          className="w-full pl-10 pr-10 py-2.5 text-xs sm:text-sm bg-white border border-[#DDD7CD] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2D5A43] font-medium"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            className="absolute right-3 text-[#6F756F] hover:text-[#1F2421] p-1 cursor-pointer"
            aria-label="Limpiar búsqueda"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Quick Search Autocomplete Chips for mum */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[11px] text-[#6F756F] font-semibold mr-1">
          {isEs ? 'Búsquedas rápidas:' : 'Quick search:'}
        </span>
        {quickChips.map((chip, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onSearchChange(chip.query)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition cursor-pointer active:scale-95 ${
              searchQuery.toLowerCase() === chip.query.toLowerCase()
                ? 'bg-[#2D5A43] text-white border-[#2D5A43] shadow-2xs'
                : 'bg-white text-[#4A504A] border-[#DDD7CD] hover:bg-[#F3EFEA]'
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Results status */}
      {searchQuery && resultsCount !== undefined && (
        <div className="text-xs font-semibold text-[#2D5A43] pt-1">
          {isEs
            ? `Mostrando filas y materiales que coinciden con "${searchQuery}" (${resultsCount} encontrados)`
            : `Showing rows matching "${searchQuery}" (${resultsCount} found)`}
        </div>
      )}
    </div>
  );
};
