import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  ImagePlus,
  KeyRound,
  Layers,
  Microscope,
  Ruler,
  Scissors,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
} from 'lucide-react';
import { STITCHES } from '../engine/stitches';
import { DecodeStage, decodePhotos } from '../decode/decodePhotos';
import {
  CONFIRM_BELOW,
  applyAnswer,
  buildQuestions,
  gaugeFromWidth,
  isReadyToCompile,
  manualDecoded,
  methodMatters,
  overallConfidence,
  pickStitchReading,
  stitchHint,
  yarnFromGauge,
} from '../decode/reconcile';
import { AiStatus, DecodeReport, Decoded, FieldSource, Finding, PhotoInput, PhotoSlot, STITCH_VALUES } from '../decode/types';
import { Language } from '../i18n/translations';
import { ColorworkType, GarmentType, StitchType, YarnWeightCategory } from '../types/knit';
import { EXAMPLE_IMAGE_URL, getStoredApiKey } from '../utils/aiAnalyzer';
import { PhotoLoadError, encodeJpegBase64, loadPhoto, nextFrame, rasterToDataUrl } from '../vision/browserIO';
import { QualityIssueCode } from '../vision/quality';

export interface DecodeApplied {
  decoded: Decoded;
  report: DecodeReport | null;
  gauge: { sts: number; rows: number | null } | null;
}

interface DecodeViewProps {
  lang: Language;
  onApply: (result: DecodeApplied) => void;
  onOpenSettings: () => void;
}

interface SlotState {
  slot: PhotoSlot;
  url: string;
  input: PhotoInput;
}

const SLOT_ORDER: PhotoSlot[] = ['front', 'closeup', 'inside', 'top', 'edge'];

export const DecodeView: React.FC<DecodeViewProps> = ({ lang, onApply, onOpenSettings }) => {
  const es = lang === 'es';
  const t = (en: string, esText: string) => (es ? esText : en);

  const [photos, setPhotos] = useState<Partial<Record<PhotoSlot, SlotState>>>({});
  const [stage, setStage] = useState<DecodeStage | null>(null);
  const [report, setReport] = useState<DecodeReport | null>(null);
  const [decoded, setDecoded] = useState<Decoded | null>(null);
  const [hints, setHints] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'photo' | 'clean' | 'map'>('map');
  const [widthCm, setWidthCm] = useState('');
  const [gauge, setGauge] = useState<{ sts: number; rows: number | null; across: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const pendingSlot = useRef<PhotoSlot>('front');

  const slotInfo: Record<PhotoSlot, { name: string; tip: string; required?: boolean }> = {
    front: {
      name: t('Whole piece', 'Prenda entera'),
      tip: t('Laid flat on a plain surface, in daylight, filling most of the frame.', 'Plana sobre una superficie lisa, con luz de día, ocupando casi toda la foto.'),
      required: true,
    },
    closeup: {
      name: t('Close-up', 'De cerca'),
      tip: t('As close as your phone stays sharp, about 10 stitches across. This helps most.', 'Lo más cerca que el teléfono enfoque, unos 10 puntos de ancho. Es la que más ayuda.'),
    },
    inside: {
      name: t('Inside', 'Por dentro'),
      tip: t('Turn it inside out. Shows carried yarn, seams and which side is the front.', 'Dalo vuelta. Muestra hebras llevadas, costuras y cuál es el derecho.'),
    },
    top: {
      name: t('Top / crown', 'Punta / coronilla'),
      tip: t('Straight down on the top. Shows the wedges and where it started.', 'Desde arriba, sobre la punta. Muestra los gajos y dónde empezó.'),
    },
    edge: {
      name: t('Edge', 'Borde'),
      tip: t('The very bottom edge, close up. Tells cast-on from bind-off.', 'El borde de abajo, de cerca. Distingue el montaje del cierre.'),
    },
  };

  const addPhoto = async (slot: PhotoSlot, source: File | string) => {
    setError(null);
    try {
      const { raster, originalLongSide, url } = await loadPhoto(source);
      setPhotos((prev) => ({ ...prev, [slot]: { slot, url, input: { slot, raster, originalLongSide } } }));
      setReport(null);
      setDecoded(null);
      setGauge(null);
    } catch (err) {
      const heic = source instanceof File && /hei[cf]/i.test(source.type + source.name);
      setError(
        heic
          ? t(
              'This browser cannot open HEIC photos. On iPhone use Safari, or set Settings > Camera > Formats to "Most Compatible".',
              'Este navegador no abre fotos HEIC. En iPhone usá Safari, o poné Ajustes > Cámara > Formatos en "Más compatible".'
            )
          : err instanceof PhotoLoadError
            ? t('This file could not be opened as a photo.', 'Este archivo no se pudo abrir como foto.')
            : t('The photo could not be loaded.', 'No se pudo cargar la foto.')
      );
    }
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void addPhoto(pendingSlot.current, file);
    e.target.value = '';
  };

  const pick = (slot: PhotoSlot, camera: boolean) => {
    pendingSlot.current = slot;
    (camera ? cameraRef : fileRef).current?.click();
  };

  const runDecode = async () => {
    const inputs = SLOT_ORDER.flatMap((slot) => (photos[slot] ? [photos[slot]!.input] : []));
    if (!photos.front && inputs.length === 0) return;
    setError(null);
    setReport(null);
    setDecoded(null);
    setGauge(null);
    try {
      const result = await decodePhotos(inputs, {
        apiKey: getStoredApiKey() || undefined,
        language: lang,
        hints: hints.trim() || undefined,
        encodeJpeg: encodeJpegBase64,
        onStage: (s) => setStage(s),
        yieldToUi: nextFrame,
      });
      setReport(result);
      setDecoded(result.decoded);
    } catch (err) {
      console.error(err);
      setError(t('The photo could not be analysed. Try a smaller photo or another browser.', 'No se pudo analizar la foto. Probá con una más chica u otro navegador.'));
    } finally {
      setStage(null);
    }
  };

  const reading = useMemo(() => (report ? pickStitchReading(report.readings) : null), [report]);
  const frontReading = report?.readings.find((r) => r.slot === 'front')?.reading ?? reading;

  const previews = useMemo(() => {
    if (!frontReading) return null;
    return {
      photo: rasterToDataUrl(frontReading.raster),
      clean: rasterToDataUrl(frontReading.enhanced.clean),
      map: rasterToDataUrl(frontReading.enhanced.stitchMap),
    };
  }, [frontReading]);

  const questions = useMemo(() => (decoded ? buildQuestions(decoded, lang) : []), [decoded, lang]);
  const ready = decoded ? isReadyToCompile(decoded) : false;
  const isBusy = stage !== null;

  const stitchLabel = (s: StitchType) => (es ? STITCHES[s].name.es : STITCHES[s].name.en);

  const setField = <K extends keyof Decoded>(field: K, value: Decoded[K] extends Finding<infer V> ? V : never) => {
    setDecoded((prev) =>
      prev
        ? { ...prev, [field]: { ...(prev[field] as Finding<unknown>), value, confidence: 1, source: 'you' as FieldSource } }
        : prev
    );
  };

  const applyGauge = () => {
    if (!reading) return;
    const width = parseFloat(widthCm.replace(',', '.'));
    const result = gaugeFromWidth(frontReading ?? reading, width);
    if (!result) {
      setGauge(null);
      setError(t('The stitches could not be counted in this photo, so the width cannot give a gauge.', 'No se pudieron contar los puntos en esta foto, así que el ancho no alcanza para calcular la tensión.'));
      return;
    }
    setError(null);
    setGauge({ sts: result.stsPer10cm, rows: result.rowsPer10cm, across: result.stitchesAcross });
    const yarn = yarnFromGauge(result.stsPer10cm);
    setDecoded((prev) =>
      prev
        ? {
            ...prev,
            yarnWeight: { value: yarn.weight, confidence: 0.75, source: 'measured', evidence: '' },
            needleMm: { value: yarn.needle, confidence: 0.75, source: 'measured', evidence: '' },
          }
        : prev
    );
  };

  const stages: { id: string; label: string; icon: React.ReactNode; active: boolean; done: boolean }[] = [
    { id: 'clean', label: t('Clean the photo', 'Limpiar la foto'), icon: <Scissors className="w-3.5 h-3.5" />, active: stage === 'clean', done: Boolean(report) || stage === 'measure' || stage === 'observe' || stage === 'deduce' },
    { id: 'reveal', label: t('Reveal the stitches', 'Revelar los puntos'), icon: <Microscope className="w-3.5 h-3.5" />, active: stage === 'measure', done: Boolean(report) || stage === 'observe' || stage === 'deduce' },
    { id: 'what', label: t('What it is', 'Qué es'), icon: <Sparkles className="w-3.5 h-3.5" />, active: stage === 'observe', done: Boolean(report) || stage === 'deduce' },
    { id: 'how', label: t('How it was made', 'Cómo se tejió'), icon: <Layers className="w-3.5 h-3.5" />, active: stage === 'deduce', done: Boolean(report) },
  ];

  const issueText = (code: QualityIssueCode, measured: string): { title: string; fix: string } => {
    const map: Record<QualityIssueCode, { title: string; fix: string }> = {
      too_small: {
        title: t(`The photo is small (${measured})`, `La foto es chica (${measured})`),
        fix: t('Use the original photo, not a screenshot or a messaging copy.', 'Usá la foto original, no una captura ni una copia de mensajería.'),
      },
      too_dark: {
        title: t('Too dark to see the stitches', 'Muy oscura para ver los puntos'),
        fix: t('Move near a window. Dark yarn especially needs daylight.', 'Acercate a una ventana. La lana oscura necesita más luz de día.'),
      },
      too_bright: {
        title: t('Overexposed: the yarn is washed out', 'Sobreexpuesta: la lana se ve lavada'),
        fix: t('Move out of direct sun, or tap the fabric on screen to set the exposure.', 'Salí del sol directo o tocá el tejido en la pantalla para ajustar la exposición.'),
      },
      glare: {
        title: t('Some parts have glare', 'Algunas partes tienen reflejo'),
        fix: t('Soft, indirect light works best.', 'Lo mejor es una luz suave e indirecta.'),
      },
      blurry: {
        title: t('The photo looks blurred', 'La foto parece movida'),
        fix: t('Hold still, tap to focus, and step back a little if it will not focus.', 'Quedate quieto, tocá para enfocar y alejate un poco si no enfoca.'),
      },
      color_cast: {
        title: t('The light tints the colours', 'La luz tiñe los colores'),
        fix: t('Colours were corrected, but check them against the real yarn.', 'Se corrigieron los colores, pero compará con la lana real.'),
      },
      subject_too_small: {
        title: t('The piece is small in the frame', 'La prenda se ve chica en la foto'),
        fix: t('Move closer so that it fills most of the photo.', 'Acercate para que ocupe casi toda la foto.'),
      },
      stitches_too_small: {
        title: t('Individual stitches could not be measured', 'No se pudieron medir los puntos'),
        fix: t('Add a close-up: fuzzy, dark or multi-coloured yarn needs one.', 'Sumá una foto de cerca: la lana peluda, oscura o matizada la necesita.'),
      },
      busy_background: {
        title: t('The background is busy', 'El fondo tiene mucho dibujo'),
        fix: t('A plain sheet or table separates the piece better.', 'Una sábana o mesa lisa separa mejor la prenda.'),
      },
    };
    return map[code];
  };

  return (
    <div className="space-y-5">
      {/* Photo set */}
      <section className="bg-white rounded-3xl border border-[#E8E3DC] shadow-xs p-4 sm:p-6 space-y-4">
        <div>
          <h2 className="text-lg sm:text-xl font-black text-[#1F2421]">
            {t('Show me the piece', 'Mostrame la prenda')}
          </h2>
          <p className="text-xs sm:text-sm text-[#6F756F]">
            {t(
              'One photo can work. Each extra one answers a question a single photo cannot.',
              'Una foto puede alcanzar. Cada foto extra responde algo que una sola no puede.'
            )}
          </p>
        </div>

        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {SLOT_ORDER.map((slot) => {
            const current = photos[slot];
            const info = slotInfo[slot];
            return (
              <div key={slot} className="rounded-2xl border border-[#E8E3DC] bg-[#FAF8F5] p-2.5 space-y-2 flex flex-col">
                <div className="aspect-square rounded-xl overflow-hidden bg-[#F0ECE6] flex items-center justify-center relative">
                  {current ? (
                    <>
                      <img src={current.url} alt={info.name} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => {
                          setPhotos((prev) => {
                            const next = { ...prev };
                            delete next[slot];
                            return next;
                          });
                          setReport(null);
                          setDecoded(null);
                        }}
                        className="absolute top-1.5 right-1.5 w-8 h-8 rounded-full bg-white/90 text-[#4A504A] flex items-center justify-center shadow-xs cursor-pointer"
                        aria-label={t('Remove photo', 'Quitar foto')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <ImagePlus className="w-7 h-7 text-[#B9B2A6]" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="text-xs font-bold text-[#1F2421]">
                    {info.name}
                    {!info.required && <span className="font-normal text-[#8C938C]"> · {t('optional', 'opcional')}</span>}
                  </div>
                  <p className="text-[11px] leading-snug text-[#6F756F]">{info.tip}</p>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => pick(slot, true)}
                    className="min-h-[44px] rounded-xl bg-[#2D5A43] text-white flex items-center justify-center cursor-pointer active:scale-95 touch-manipulation"
                    aria-label={t(`Take ${info.name} photo`, `Tomar foto: ${info.name}`)}
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => pick(slot, false)}
                    className="min-h-[44px] rounded-xl bg-[#E4ECE7] text-[#2D5A43] flex items-center justify-center cursor-pointer active:scale-95 touch-manipulation"
                    aria-label={t(`Choose ${info.name} photo`, `Elegir foto: ${info.name}`)}
                  >
                    <Upload className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <label className="block">
          <span className="text-xs font-semibold text-[#1F2421]">
            {t('Anything you already know? (optional)', '¿Algo que ya sepas? (opcional)')}
          </span>
          <input
            value={hints}
            onChange={(e) => setHints(e.target.value)}
            placeholder={t('e.g. my grandmother knitted it; it has no seam', 'ej. lo tejió mi abuela; no tiene costura')}
            className="mt-1 w-full text-sm p-3 bg-[#FAF8F5] border border-[#DDD7CD] rounded-xl"
          />
        </label>

        {error && (
          <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-xs sm:text-sm text-red-800 flex gap-2" role="alert">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            disabled={!photos.front || isBusy}
            onClick={runDecode}
            className="flex-1 min-h-[52px] rounded-2xl bg-[#2D5A43] hover:bg-[#234734] disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-sm sm:text-base flex items-center justify-center gap-2 cursor-pointer active:scale-95 touch-manipulation"
          >
            <Wand2 className="w-5 h-5" />
            {isBusy ? t('Reading the photos…', 'Leyendo las fotos…') : t('Decode this piece', 'Analizar esta prenda')}
          </button>
          {!photos.front && (
            <button
              type="button"
              onClick={() => void addPhoto('front', EXAMPLE_IMAGE_URL)}
              className="min-h-[52px] px-4 rounded-2xl border border-[#DDD7CD] bg-white text-xs font-bold text-[#2D5A43] cursor-pointer"
            >
              {t('Use the example hat', 'Usar el gorro de ejemplo')}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setReport(null);
              setDecoded(manualDecoded(lang));
            }}
            className="min-h-[52px] px-4 rounded-2xl border border-[#DDD7CD] bg-white text-xs font-bold text-[#4A504A] cursor-pointer"
          >
            {t('No photo: I will choose', 'Sin foto: elijo yo')}
          </button>
        </div>

        {(isBusy || report) && (
          <ol className="grid grid-cols-2 sm:grid-cols-4 gap-2" aria-label={t('Progress', 'Progreso')}>
            {stages.map((s) => (
              <li
                key={s.id}
                className={`px-3 py-2 rounded-xl text-[11px] sm:text-xs font-bold flex items-center gap-1.5 border ${
                  s.done
                    ? 'bg-[#E4ECE7] text-[#1C3A2B] border-[#C2DEC8]'
                    : s.active
                      ? 'bg-amber-50 text-amber-900 border-amber-300'
                      : 'bg-[#FAF8F5] text-[#8C938C] border-[#E8E3DC]'
                }`}
              >
                {s.done ? <Check className="w-3.5 h-3.5" /> : s.icon}
                {s.label}
              </li>
            ))}
          </ol>
        )}
      </section>

      {report && <AiBanner ai={report.ai} t={t} onOpenSettings={onOpenSettings} />}

      {/* Stage 1 and 2: clean and reveal */}
      {report && previews && frontReading && (
        <section className="bg-white rounded-3xl border border-[#E8E3DC] shadow-xs p-4 sm:p-6 space-y-4">
          <StageTitle n={1} title={t('Clean and reveal', 'Limpiar y revelar')} subtitle={t('The surface is removed, the light evened out and the stitch structure pulled forward. Compare with your photo.', 'Se quita la superficie, se empareja la luz y se resalta la estructura de los puntos. Comparala con tu foto.')} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            <div className="space-y-2">
              <div className="flex gap-1 bg-[#FAF8F5] p-1 rounded-xl border border-[#E8E3DC]" role="tablist">
                {([
                  ['map', t('Stitch map', 'Mapa de puntos')],
                  ['clean', t('Cleaned', 'Limpia')],
                  ['photo', t('Your photo', 'Tu foto')],
                ] as const).map(([id, label]) => (
                  <button
                    key={id}
                    role="tab"
                    aria-selected={view === id}
                    type="button"
                    onClick={() => setView(id)}
                    className={`flex-1 min-h-[40px] rounded-lg text-xs font-bold cursor-pointer ${view === id ? 'bg-[#2D5A43] text-white' : 'text-[#4A504A]'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <img src={previews[view]} alt={t('Decoded view of the piece', 'Vista analizada de la prenda')} className="w-full rounded-2xl border border-[#E8E3DC]" />
            </div>

            <div className="space-y-3">
              {report.readings.map(({ slot, reading: r }) => (
                <div key={slot} className="p-3 rounded-2xl bg-[#FAF8F5] border border-[#E8E3DC] space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold text-[#1F2421]">
                    <span>{slotInfo[slot].name}</span>
                    <span className={r.quality.score >= 0.7 ? 'text-[#2D5A43]' : 'text-amber-700'}>
                      {r.quality.usable
                        ? r.quality.score >= 0.7
                          ? t('Good photo', 'Buena foto')
                          : t('Usable, could be better', 'Sirve, podría ser mejor')
                        : t('Please retake', 'Mejor volver a sacarla')}
                    </span>
                  </div>
                  {r.quality.issues.length === 0 && (
                    <p className="text-[11px] text-[#6F756F] flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-[#2D5A43]" />{t('Sharp, well lit, stitches measurable.', 'Nítida, bien iluminada, puntos medibles.')}</p>
                  )}
                  {r.quality.issues.map((issue) => {
                    const info = issueText(issue.code, issue.measured);
                    return (
                      <div key={issue.code} className="text-[11px] leading-snug">
                        <span className={`font-bold ${issue.severity === 'block' ? 'text-red-700' : 'text-amber-800'}`}>{info.title}.</span>{' '}
                        <span className="text-[#4A504A]">{info.fix}</span>
                      </div>
                    );
                  })}
                </div>
              ))}

              {frontReading.colors.colors.length > 0 && (
                <div className="p-3 rounded-2xl bg-[#FAF8F5] border border-[#E8E3DC] space-y-2">
                  <div className="text-xs font-bold text-[#1F2421]">{t('Yarn colours found', 'Colores de lana encontrados')}</div>
                  <div className="flex flex-wrap gap-2">
                    {frontReading.colors.colors.map((c, i) => (
                      <span key={i} className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xl border border-[#DDD7CD] text-[11px] font-semibold">
                        <span className="w-3.5 h-3.5 rounded-full border border-black/10" style={{ backgroundColor: c.hex }} />
                        {es ? c.name.es : c.name.en} · {Math.round(c.share * 100)}%
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="p-3 rounded-2xl bg-[#FAF8F5] border border-[#E8E3DC] space-y-2">
                <div className="text-xs font-bold text-[#1F2421] flex items-center gap-1.5"><Ruler className="w-3.5 h-3.5 text-[#2D5A43]" />{t('Give me a scale (optional)', 'Dame una escala (opcional)')}</div>
                <p className="text-[11px] text-[#6F756F] leading-snug">
                  {t('A photo has no size. Measure the piece laid flat, and the stitch count becomes a real gauge, which tells you the yarn and needle.', 'Una foto no tiene tamaño. Medí la prenda plana, y el conteo de puntos se vuelve una tensión real, que indica la lana y la aguja.')}
                </p>
                <div className="flex gap-2 items-center">
                  <input
                    inputMode="decimal"
                    value={widthCm}
                    onChange={(e) => setWidthCm(e.target.value)}
                    placeholder={t('Width in cm', 'Ancho en cm')}
                    aria-label={t('Width in cm', 'Ancho en cm')}
                    className="w-32 text-sm p-2.5 bg-white border border-[#DDD7CD] rounded-xl"
                  />
                  <button type="button" onClick={applyGauge} className="min-h-[42px] px-3 rounded-xl bg-[#E4ECE7] text-[#2D5A43] text-xs font-bold cursor-pointer">
                    {t('Calculate', 'Calcular')}
                  </button>
                </div>
                {gauge && (
                  <p className="text-xs font-semibold text-[#1C3A2B]">
                    {t(
                      `About ${gauge.across} stitches across: ${gauge.sts} sts per 10 cm${gauge.rows ? `, ${gauge.rows} rows per 10 cm` : ''}. Still knit a swatch.`,
                      `Unos ${gauge.across} puntos de ancho: ${gauge.sts} puntos en 10 cm${gauge.rows ? `, ${gauge.rows} vueltas en 10 cm` : ''}. Igual tejé una muestra.`
                    )}
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {decoded && (
        <>
          {decoded.inputKind.value === 'crochet' && (
            <Notice>
              {t('This looks like crochet, not knitting. A knitting pattern cannot reproduce it, so check this before you go on.', 'Parece crochet, no dos agujas. Un patrón de dos agujas no lo puede reproducir, así que revisalo antes de seguir.')}
            </Notice>
          )}
          {decoded.inputKind.value === 'written_or_chart' && (
            <Notice>
              {t('This looks like a printed pattern or chart. This app reads knitted fabric, not printed patterns, so the results below will not be reliable.', 'Parece un patrón impreso o un gráfico. Esta app lee tejido, no patrones impresos, así que los resultados de abajo no van a ser confiables.')}
            </Notice>
          )}

          {/* Questions */}
          {questions.length > 0 && (
            <section className="bg-amber-50 rounded-3xl border border-amber-200 p-4 sm:p-6 space-y-4">
              <div>
                <h3 className="text-base sm:text-lg font-black text-[#1F2421]">
                  {t(`I need your eyes on ${questions.length === 1 ? 'one thing' : `${questions.length} things`}`, questions.length === 1 ? 'Necesito que mires una cosa' : `Necesito que mires ${questions.length} cosas`)}
                </h3>
                <p className="text-xs text-[#6F756F]">
                  {t('I would rather ask than give you a wrong pattern.', 'Prefiero preguntar antes que darte un patrón equivocado.')}
                </p>
              </div>
              {questions.map((q) => (
                <div key={q.field} className="space-y-2">
                  <div>
                    <div className="text-sm font-bold text-[#1F2421]">{q.prompt}</div>
                    <p className="text-[11px] text-[#6F756F]">{q.why}</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {q.options.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setDecoded((prev) => (prev ? applyAnswer(prev, q.field, option.value) : prev))}
                        className="text-left min-h-[48px] p-2.5 rounded-xl bg-white border border-amber-200 hover:border-[#2D5A43] cursor-pointer active:scale-[0.98] touch-manipulation"
                      >
                        <span className="block text-xs font-bold text-[#1F2421]">{option.label}</span>
                        {option.hint && <span className="block text-[11px] leading-snug text-[#6F756F]">{option.hint}</span>}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          )}

          {/* Stage 3: what it is */}
          <section className="bg-white rounded-3xl border border-[#E8E3DC] shadow-xs p-4 sm:p-6 space-y-3">
            <StageTitle n={2} title={t('What it is', 'Qué es')} subtitle={t('Change anything that looks wrong. You can see the real piece, and your answer wins.', 'Cambiá lo que no esté bien. Vos ves la prenda real, y tu respuesta manda.')} />
            <FindingRow label={t('Piece', 'Prenda')} finding={decoded.garment} t={t}>
              <select value={decoded.garment.value} onChange={(e) => setField('garment', e.target.value as GarmentType)} className={selectClass} aria-label={t('Piece', 'Prenda')}>
                <option value="beanie">{t('Hat', 'Gorro')}</option>
                <option value="scarf">{t('Scarf', 'Bufanda')}</option>
                <option value="cowl">{t('Cowl', 'Cuello')}</option>
                <option value="pullover">{t('Sweater', 'Pulóver')}</option>
                <option value="cardigan">{t('Cardigan', 'Saco')}</option>
                <option value="swatch">{t('Just fabric', 'Solo tejido')}</option>
                <option value="other">{t('Something else', 'Otra cosa')}</option>
              </select>
            </FindingRow>
            <FindingRow label={t('Main stitch', 'Punto principal')} finding={decoded.stitch} t={t} hint={stitchHint(decoded.stitch.value, lang)}>
              <select value={decoded.stitch.value} onChange={(e) => setField('stitch', e.target.value as StitchType)} className={selectClass} aria-label={t('Main stitch', 'Punto principal')}>
                {STITCH_VALUES.map((s) => (
                  <option key={s} value={s}>{stitchLabel(s)}</option>
                ))}
              </select>
            </FindingRow>
            <FindingRow label={t('Brim or edge stitch', 'Punto del puño o borde')} finding={decoded.edgeStitch} t={t}>
              <select value={decoded.edgeStitch.value} onChange={(e) => setField('edgeStitch', e.target.value as StitchType | 'same')} className={selectClass} aria-label={t('Brim or edge stitch', 'Punto del puño o borde')}>
                <option value="same">{t('Same as main', 'Igual al principal')}</option>
                {STITCH_VALUES.filter((s) => STITCHES[s].compilable).map((s) => (
                  <option key={s} value={s}>{stitchLabel(s)}</option>
                ))}
              </select>
            </FindingRow>
            <FindingRow label={t('Colours', 'Colores')} finding={decoded.colorwork} t={t}>
              <select value={decoded.colorwork.value} onChange={(e) => setField('colorwork', e.target.value as ColorworkType)} className={selectClass} aria-label={t('Colours', 'Colores')}>
                <option value="solid">{t('One colour', 'Un color')}</option>
                <option value="vertical_stripes">{t('Vertical stripes', 'Rayas verticales')}</option>
                <option value="horizontal_stripes">{t('Horizontal stripes', 'Rayas horizontales')}</option>
                <option value="color_block">{t('Colour blocks', 'Bloques de color')}</option>
                <option value="stranded_motif">{t('Motif (Fair Isle or similar)', 'Motivo (Fair Isle o similar)')}</option>
                <option value="variegated">{t('Multicolour yarn', 'Lana matizada')}</option>
              </select>
            </FindingRow>
            <FindingRow label={t('Made by', 'Hecho')} finding={decoded.madeBy} t={t}>
              <select value={decoded.madeBy.value} onChange={(e) => setField('madeBy', e.target.value as Decoded['madeBy']['value'])} className={selectClass} aria-label={t('Made by', 'Hecho')}>
                <option value="unknown">{t('Not sure', 'No sé')}</option>
                <option value="hand">{t('By hand', 'A mano')}</option>
                <option value="machine">{t('By machine', 'A máquina')}</option>
              </select>
            </FindingRow>
          </section>

          {/* Stage 4: how it was made */}
          <section className="bg-white rounded-3xl border border-[#E8E3DC] shadow-xs p-4 sm:p-6 space-y-3">
            <StageTitle n={3} title={t('How it was made', 'Cómo se tejió')} subtitle={t('Which way it grew, and which side faced the knitter.', 'Hacia dónde creció, y qué lado miraba quien tejía.')} />
            {methodMatters(decoded.garment.value) && (
            <FindingRow
              label={t('Method', 'Método')}
              finding={decoded.method}
              t={t}
              hint={
                decoded.method.value === 'round'
                  ? t('You always see the right side, so a knit stitch is always a knit stitch.', 'Siempre ves el derecho, así que un punto al derecho siempre se teje al derecho.')
                  : t('You turn each row. On the wrong side you make the opposite stitch to get the same look.', 'Girás en cada hilera. Del revés hacés el punto contrario para lograr lo mismo.')
              }
            >
              <select value={decoded.method.value} onChange={(e) => setField('method', e.target.value as Decoded['method']['value'])} className={selectClass} aria-label={t('Method', 'Método')}>
                <option value="round">{t('In the round, no seam', 'En redondo, sin costura')}</option>
                <option value="flat">{t('Flat, with a seam or edges', 'Plano, con costura o bordes')}</option>
              </select>
            </FindingRow>
            )}
            {decoded.garment.value === 'beanie' && decoded.method.value === 'round' && (
              <FindingRow label={t('Starts at', 'Empieza en')} finding={decoded.direction} t={t}>
                <select value={decoded.direction.value === 'top_down' ? 'top_down' : 'bottom_up'} onChange={(e) => setField('direction', e.target.value as Decoded['direction']['value'])} className={selectClass} aria-label={t('Starts at', 'Empieza en')}>
                  <option value="bottom_up">{t('The brim, works up', 'El puño, sube')}</option>
                  <option value="top_down">{t('The top, works down', 'La punta, baja')}</option>
                </select>
              </FindingRow>
            )}
            {decoded.garment.value === 'beanie' && (
              <>
                <FindingRow label={t('Folded brim', 'Puño doblado')} finding={decoded.foldedBrim} t={t}>
                  <select value={String(decoded.foldedBrim.value)} onChange={(e) => setField('foldedBrim', e.target.value === 'true')} className={selectClass} aria-label={t('Folded brim', 'Puño doblado')}>
                    <option value="true">{t('Yes', 'Sí')}</option>
                    <option value="false">{t('No', 'No')}</option>
                  </select>
                </FindingRow>
                <FindingRow label={t('Crown wedges', 'Gajos de la coronilla')} finding={decoded.crownWedges} t={t}>
                  <select value={String(decoded.crownWedges.value ?? 4)} onChange={(e) => setField('crownWedges', parseInt(e.target.value, 10))} className={selectClass} aria-label={t('Crown wedges', 'Gajos de la coronilla')}>
                    {[4, 5, 6, 8].map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </FindingRow>
              </>
            )}
            <FindingRow label={t('Yarn weight', 'Grosor de lana')} finding={decoded.yarnWeight} t={t}>
              <select value={decoded.yarnWeight.value} onChange={(e) => setField('yarnWeight', e.target.value as YarnWeightCategory)} className={selectClass} aria-label={t('Yarn weight', 'Grosor de lana')}>
                {(['Fingering / 4-ply', 'Sport', 'DK / Light Worsted', 'Worsted / Aran', 'Chunky / Bulky', 'Super Bulky'] as YarnWeightCategory[]).map((w) => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </select>
            </FindingRow>
            {decoded.notes.length > 0 && (
              <ul className="text-xs text-[#4A504A] space-y-1 list-disc list-inside">
                {decoded.notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            )}
          </section>

          <div>
            <button
              type="button"
              disabled={decoded.inputKind.value === 'crochet'}
              onClick={() => onApply({ decoded, report, gauge: gauge ? { sts: gauge.sts, rows: gauge.rows } : null })}
              className={`w-full min-h-[56px] rounded-2xl font-black text-sm sm:text-base text-white flex items-center justify-center gap-2 shadow-lg cursor-pointer active:scale-[0.98] touch-manipulation disabled:opacity-40 ${ready ? 'bg-[#2D5A43] hover:bg-[#234734]' : 'bg-amber-700 hover:bg-amber-800'}`}
            >
              {ready
                ? t('Write my step-by-step pattern', 'Escribir mi patrón paso a paso')
                : t(`Write it anyway (${Math.round(overallConfidence(decoded) * 100)}% sure)`, `Escribirlo igual (${Math.round(overallConfidence(decoded) * 100)}% de certeza)`)}
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </>
      )}
    </div>
  );
};

const selectClass = 'w-full sm:w-56 text-xs font-semibold p-2.5 min-h-[44px] bg-[#FAF8F5] border border-[#DDD7CD] rounded-xl';

const StageTitle: React.FC<{ n: number; title: string; subtitle: string }> = ({ n, title, subtitle }) => (
  <div className="flex items-start gap-3">
    <span className="w-7 h-7 rounded-full bg-[#2D5A43] text-white text-xs font-black flex items-center justify-center flex-shrink-0">{n}</span>
    <div>
      <h3 className="text-base sm:text-lg font-black text-[#1F2421]">{title}</h3>
      <p className="text-xs text-[#6F756F]">{subtitle}</p>
    </div>
  </div>
);

const Notice: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-sm font-semibold text-red-900 flex gap-2" role="alert">
    <AlertTriangle className="w-5 h-5 flex-shrink-0" />
    <span>{children}</span>
  </div>
);

const FindingRow: React.FC<{
  label: string;
  finding: Finding<unknown>;
  t: (en: string, es: string) => string;
  hint?: string;
  children: React.ReactNode;
}> = ({ label, finding, t, hint, children }) => {
  const percent = Math.round(finding.confidence * 100);
  const sourceText: Record<FieldSource, string> = {
    you: t('You said', 'Lo dijiste vos'),
    ai: t('AI read', 'Lectura de IA'),
    measured: t('Measured', 'Medido'),
    assumed: t('Assumed, please check', 'Supuesto, revisalo'),
  };
  const tone =
    finding.source === 'you'
      ? 'bg-[#E4ECE7] text-[#1C3A2B]'
      : finding.confidence >= CONFIRM_BELOW
        ? 'bg-[#EBF2EE] text-[#2D5A43]'
        : 'bg-amber-100 text-amber-900';
  return (
    <div className="p-3 rounded-2xl bg-[#FAF8F5] border border-[#E8E3DC] flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-[#1F2421]">{label}</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${tone}`}>
            {sourceText[finding.source]}
            {finding.source !== 'you' && finding.source !== 'assumed' ? ` · ${percent}%` : ''}
          </span>
        </div>
        {finding.evidence && <p className="text-[11px] leading-snug text-[#4A504A]">{finding.evidence}</p>}
        {hint && <p className="text-[11px] leading-snug text-[#6F756F]">{hint}</p>}
      </div>
      {children}
    </div>
  );
};

const AiBanner: React.FC<{ ai: AiStatus; t: (en: string, es: string) => string; onOpenSettings: () => void }> = ({ ai, t, onOpenSettings }) => {
  if (ai.state === 'used') {
    return (
      <div className="px-4 py-3 rounded-2xl bg-[#E4ECE7] border border-[#C2DEC8] text-xs sm:text-sm font-semibold text-[#1C3A2B] flex items-center gap-2">
        <Sparkles className="w-4 h-4 flex-shrink-0" />
        {t(`Read by ${ai.model} from ${ai.photosSent} images and checked against the measurements.`, `Leído por ${ai.model} con ${ai.photosSent} imágenes y comparado con las mediciones.`)}
      </div>
    );
  }
  const failure: Record<string, string> = {
    bad_key: t('Google rejected your key.', 'Google rechazó tu clave.'),
    quota: t('Your free Gemini quota is used up for now. Try again later.', 'Por ahora se agotó tu cuota gratis de Gemini. Probá más tarde.'),
    network: t('Could not reach Google. Check your connection.', 'No se pudo conectar con Google. Revisá tu conexión.'),
    timeout: t('Google took too long to answer.', 'Google tardó demasiado en responder.'),
    blocked: t('Google refused to process this photo.', 'Google no quiso procesar esta foto.'),
    invalid_response: t('Google answered with something unusable.', 'Google respondió algo que no se puede usar.'),
    no_model: t('No suitable Gemini model is available for this key.', 'No hay un modelo de Gemini adecuado para esta clave.'),
  };
  return (
    <div className="px-4 py-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs sm:text-sm text-amber-900 flex flex-col sm:flex-row sm:items-center gap-2">
      <div className="flex-1">
        <span className="font-bold">
          {ai.state === 'failed' ? failure[ai.reason] : t('Photo measurements only, without AI.', 'Solo mediciones de la foto, sin IA.')}
        </span>{' '}
        {t(
          'Measurements can see the structure, but they cannot name every stitch or tell how it was made. Please answer the questions below. Adding a free Gemini key makes this far better. Your photos then go to Google for analysis.',
          'Las mediciones ven la estructura, pero no pueden nombrar cada punto ni decir cómo se tejió. Respondé las preguntas de abajo. Sumar una clave gratis de Gemini lo mejora mucho. En ese caso tus fotos van a Google para el análisis.'
        )}
      </div>
      <button type="button" onClick={onOpenSettings} className="min-h-[42px] px-3 rounded-xl bg-white border border-amber-300 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer flex-shrink-0">
        <KeyRound className="w-3.5 h-3.5" />
        {t('Add key', 'Agregar clave')}
      </button>
    </div>
  );
};
