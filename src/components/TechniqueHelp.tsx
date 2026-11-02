import React, { useState } from 'react';
import { ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';
import { TECHNIQUES } from '../knowledge/techniques';
import { Language } from '../i18n/translations';

interface TechniqueHelpProps {
  ids?: string[];
  lang: Language;
}

/** Expands "how do I do this?" for the techniques a step uses, in place, without leaving the row. */
export const TechniqueHelp: React.FC<TechniqueHelpProps> = ({ ids, lang }) => {
  const [open, setOpen] = useState<string | null>(null);
  const known = (ids ?? []).filter((id) => TECHNIQUES[id]);
  if (known.length === 0) return null;
  return (
    <div className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
      {known.map((id) => {
        const technique = TECHNIQUES[id];
        const isOpen = open === id;
        return (
          <div key={id} className="rounded-xl border border-[#D5E3DC] bg-[#F4F6F5] text-left">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : id)}
              aria-expanded={isOpen}
              className="w-full min-h-[40px] px-3 py-2 flex items-center gap-2 text-xs font-bold text-[#2D5A43] cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="flex-1 text-left">{lang === 'es' ? technique.name.es : technique.name.en}</span>
              {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {isOpen && (
              <p className="px-3 pb-3 text-xs leading-relaxed text-[#1F2421]">
                {lang === 'es' ? technique.how.es : technique.how.en}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
};
