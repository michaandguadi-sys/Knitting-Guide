import React, { useEffect, useMemo, useState } from 'react';
import { Check, Eye, Layers, Microscope, Scissors } from 'lucide-react';
import type { Observation } from '../decode/analysis';
import type { DecodeStage } from '../decode/decodePhotos';
import { describeTexture } from '../decode/reconcile';
import { Language } from '../i18n/translations';
import { rasterToDataUrl } from '../vision/browserIO';
import { FabricReading } from '../vision/pipeline';

interface ThinkingPanelProps {
  lang: Language;
  stage: DecodeStage | null;
  pictureUrl: string | null;
  reading: FabricReading | null;
  observation: Observation | null;
  usesAi: boolean;
}

/** Shows what has really been found so far, as it arrives. Nothing here is decorative filler. */
export const ThinkingPanel: React.FC<ThinkingPanelProps> = ({ lang, stage, pictureUrl, reading, observation, usesAi }) => {
  const es = lang === 'es';
  const t = (en: string, esText: string) => (es ? esText : en);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, []);

  const stitchMap = useMemo(() => (reading ? rasterToDataUrl(reading.enhanced.stitchMap, 900) : null), [reading]);

  const order: DecodeStage[] = ['clean', 'measure', 'observe', 'deduce', 'done'];
  const at = stage ? order.indexOf(stage) : 0;
  const steps = [
    { id: 'clean', icon: <Scissors className="w-3.5 h-3.5" />, label: t('Cleaning the picture', 'Limpiando la foto'), active: at === 0, done: at > 0 },
    { id: 'reveal', icon: <Microscope className="w-3.5 h-3.5" />, label: t('Revealing the stitches', 'Revelando los puntos'), active: at === 1, done: at > 1 },
    ...(usesAi
      ? [
          { id: 'observe', icon: <Eye className="w-3.5 h-3.5" />, label: t('Looking closely, like a knitter would', 'Mirando de cerca, como una tejedora'), active: at === 2, done: at > 2 },
          { id: 'deduce', icon: <Layers className="w-3.5 h-3.5" />, label: t('Working out how it was made', 'Deduciendo cómo se tejió'), active: at === 3, done: at > 3 },
        ]
      : []),
  ];

  const seen = observation
    ? ([
        [t('Surface', 'Superficie'), observation.surface_look],
        [t('Stitch shapes', 'Forma de los puntos'), observation.vs_or_bumps],
        [t('Lines', 'Líneas'), observation.visible_lines],
        [t('Edges', 'Bordes'), observation.edges],
        [t('Shaping', 'Forma'), observation.shaping],
        [t('Colours', 'Colores'), observation.colour_changes],
      ] as const).filter(([, text]) => text && !/^not visible/i.test(text))
    : [];

  return (
    <div className="space-y-4" aria-busy="true">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg sm:text-xl font-black text-[#1F2421]">{t('Reading your picture', 'Leyendo tu foto')}</h2>
        <span className="text-xs font-mono text-[#6F756F]">{elapsed}s</span>
      </div>
      <p className="text-xs sm:text-sm text-[#6F756F]">
        {usesAi
          ? t(
              'This takes about 40 seconds, because reading stitches is careful work. You can watch what it finds, and then it will go through the picture with you.',
              'Esto tarda unos 40 segundos, porque leer puntos lleva su trabajo. Podés ver lo que va encontrando, y después va a revisar la foto con vos.'
            )
          : t('This takes a few seconds. Then it will go through the picture with you.', 'Esto tarda unos segundos. Después va a revisar la foto con vos.')}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
        <div className="relative overflow-hidden rounded-2xl border border-[#E8E3DC] bg-[#F0ECE6]">
          {(stitchMap ?? pictureUrl) && (
            <img
              src={stitchMap ?? pictureUrl ?? undefined}
              alt={stitchMap ? t('Stitch map of your picture', 'Mapa de puntos de tu foto') : t('Your picture', 'Tu foto')}
              className="w-full block"
            />
          )}
          <div className="kv-scan-line" aria-hidden="true" />
        </div>

        <div className="space-y-3">
          <ol className="space-y-1.5" aria-label={t('Progress', 'Progreso')}>
            {steps.map((step) => (
              <li
                key={step.id}
                aria-current={step.active ? 'step' : undefined}
                className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border ${
                  step.done
                    ? 'bg-[#E4ECE7] text-[#1C3A2B] border-[#C2DEC8]'
                    : step.active
                      ? 'bg-amber-50 text-amber-900 border-amber-300'
                      : 'bg-[#FAF8F5] text-[#8C938C] border-[#E8E3DC]'
                }`}
              >
                {step.done ? <Check className="w-3.5 h-3.5" /> : step.icon}
                {step.label}
              </li>
            ))}
          </ol>

          {reading && (
            <div className="p-3 rounded-2xl bg-[#FAF8F5] border border-[#E8E3DC] space-y-2 text-xs text-[#1F2421]">
              <div className="font-bold">{t('Measured so far', 'Medido hasta ahora')}</div>
              <p>{describeTexture(reading, lang)}</p>
              {reading.colors.colors.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {reading.colors.colors.map((color) => (
                    <span key={color.hex} className="flex items-center gap-1 bg-white px-2 py-0.5 rounded-lg border border-[#DDD7CD] text-[11px] font-semibold">
                      <span className="w-3 h-3 rounded-full border border-black/10" style={{ backgroundColor: color.hex }} />
                      {es ? color.name.es : color.name.en}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {seen.length > 0 && (
            <div className="p-3 rounded-2xl bg-[#F4F6F5] border border-[#D5E3DC] space-y-1.5 text-xs text-[#1F2421]">
              <div className="font-bold">{t('What it sees', 'Lo que ve')}</div>
              {seen.map(([label, text]) => (
                <p key={label} className="leading-snug">
                  <span className="font-bold">{label}:</span> {text}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
