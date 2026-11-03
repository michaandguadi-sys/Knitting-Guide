import React, { useMemo, useState } from 'react';
import { spotForQuestion, whereToLook } from '../decode/questionSpots';
import { CANT_TELL, DecodeQuestion } from '../decode/types';
import { Language } from '../i18n/translations';
import { rasterToDataUrl } from '../vision/browserIO';
import { FabricReading } from '../vision/pipeline';
import { crop } from '../vision/raster';

interface GuidedQuestionsProps {
  lang: Language;
  questions: DecodeQuestion[];
  answered: number;
  reading: FabricReading;
  photoUrl: string;
  mapUrl: string;
  onAnswer: (question: DecodeQuestion, value: string) => void;
  onUseBestGuess: () => void;
}

/** One question at a time, next to the picture, with the place to look marked on it. */
export const GuidedQuestions: React.FC<GuidedQuestionsProps> = ({ lang, questions, answered, reading, photoUrl, mapUrl, onAnswer, onUseBestGuess }) => {
  const es = lang === 'es';
  const t = (en: string, esText: string) => (es ? esText : en);
  const [view, setView] = useState<'photo' | 'map'>('photo');
  const question = questions[0];
  const spot = useMemo(() => (question ? spotForQuestion(question.field, reading) : null), [question, reading]);

  const closeUp = useMemo(() => {
    if (!spot) return null;
    const { raster } = reading;
    const w = Math.max(40, Math.round(spot.w * raster.width));
    const h = Math.max(40, Math.round(spot.h * raster.height));
    const x = Math.min(raster.width - w, Math.round(spot.x * raster.width));
    const y = Math.min(raster.height - h, Math.round(spot.y * raster.height));
    return rasterToDataUrl(crop(raster, Math.max(0, x), Math.max(0, y), w, h), 700);
  }, [spot, reading]);

  if (!question) return null;
  const total = answered + questions.length;
  const options = question.options.filter((o) => o.value !== CANT_TELL);
  const cantTell = question.options.find((o) => o.value === CANT_TELL);

  return (
    <section className="bg-white rounded-3xl border-2 border-amber-300 shadow-xs p-4 sm:p-6 space-y-4" aria-labelledby="guided-question">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-bold text-amber-900">
          {t(`Let's look together: question ${answered + 1} of ${total}`, `Miremos la foto: pregunta ${answered + 1} de ${total}`)}
        </span>
        <button type="button" onClick={onUseBestGuess} className="min-h-[40px] px-3 rounded-xl border border-[#DDD7CD] bg-white text-[11px] font-bold text-[#4A504A] cursor-pointer">
          {t('Skip: use the most likely', 'Saltear: usar lo más probable')}
        </button>
      </div>

      <div>
        <h3 id="guided-question" className="text-base sm:text-lg font-black text-[#1F2421]">{question.prompt}</h3>
        {question.where && <p className="text-xs sm:text-sm font-semibold text-amber-900 mt-1">{whereToLook(question, spot, lang)}</p>}
        <p className="text-xs text-[#6F756F] mt-1">{question.why}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        <div className="space-y-2 md:sticky md:top-4">
          <div className={closeUp ? 'grid grid-cols-5 gap-2 items-start' : ''}>
            <div className={`relative overflow-hidden rounded-2xl border border-[#E8E3DC] ${closeUp ? 'col-span-3' : ''}`}>
              <img src={view === 'photo' ? photoUrl : mapUrl} alt={t('Your picture', 'Tu foto')} className="w-full block" />
              {spot && (
                <span
                  className="absolute border-[3px] border-amber-400 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.3)] pointer-events-none"
                  style={{ left: `${spot.x * 100}%`, top: `${spot.y * 100}%`, width: `${spot.w * 100}%`, height: `${spot.h * 100}%` }}
                />
              )}
            </div>
            {closeUp && (
              <figure className="col-span-2 space-y-1">
                <img src={closeUp} alt={t('Close-up of the marked spot', 'Primer plano del lugar marcado')} className="w-full rounded-xl border-2 border-amber-400 bg-[#F0ECE6]" />
                <figcaption className="text-[11px] leading-tight text-[#6F756F]">{t('The marked spot, up close', 'El lugar marcado, de cerca')}</figcaption>
              </figure>
            )}
          </div>
          <div className="flex gap-1 bg-[#FAF8F5] p-1 rounded-xl border border-[#E8E3DC]">
            {([
              ['photo', t('Your picture', 'Tu foto')],
              ['map', t('Stitch map', 'Mapa de puntos')],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={view === id}
                onClick={() => setView(id)}
                className={`flex-1 min-h-[40px] rounded-lg text-xs font-bold cursor-pointer ${view === id ? 'bg-[#2D5A43] text-white' : 'text-[#4A504A]'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-2">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onAnswer(question, option.value)}
                className="text-left min-h-[48px] p-3 rounded-xl bg-[#FAF8F5] border border-[#DDD7CD] hover:border-[#2D5A43] cursor-pointer active:scale-[0.98] touch-manipulation"
              >
                <span className="block text-sm font-bold text-[#1F2421]">{option.label}</span>
                {option.hint && <span className="block text-xs leading-snug text-[#6F756F]">{option.hint}</span>}
              </button>
            ))}
            {cantTell && (
              <button
                type="button"
                onClick={() => onAnswer(question, CANT_TELL)}
                className="text-left min-h-[48px] p-3 rounded-xl border border-dashed border-[#B9B2A6] bg-white text-sm font-semibold text-[#4A504A] cursor-pointer"
              >
                {t("I can't tell from the picture", 'No se ve en la foto')}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
