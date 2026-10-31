import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { InteractiveGarmentPhoto } from './components/InteractiveGarmentPhoto';
import { KnitterEssentialsCard } from './components/KnitterEssentialsCard';
import { PatternView } from './components/PatternView';
import { StitchChart } from './components/StitchChart';
import { RowTracker } from './components/RowTracker';
import { CraftNotesModal } from './components/CraftNotesModal';
import { compilePattern } from './engine/compiler';
import { KnitBlueprint, KnitUserConstraints, CompiledPattern } from './types/knit';
import { Language } from './i18n/translations';
import { BookOpen, ListOrdered, Grid, BookmarkCheck } from 'lucide-react';

const INITIAL_NORTH_FACE_BLUEPRINT: KnitBlueprint = {
  garmentType: 'beanie',
  title: 'The North Face Striped Ribbed Beanie',
  description: 'Gorro elástico de abrigo con rayas verticales, puño doblado y disminuciones en 4 gajos.',
  construction: 'in_the_round',
  mainStitch: 'rib_1x1',
  secondaryStitch: 'rib_1x1',
  hasFoldedBrim: true,
  brimHeightRatio: 0.35,
  crownWedges: 4,
  colorworkType: 'vertical_stripes',
  stripes: [
    { colorName: 'Verde Salvia (Base)', hex: '#718873', widthStsEstimate: 8, role: 'base' },
    { colorName: 'Blanco Crema (Línea)', hex: '#F4F5F0', widthStsEstimate: 2, role: 'stripe' },
    { colorName: 'Oliva Profundo', hex: '#374735', widthStsEstimate: 2, role: 'accent' },
  ],
  features: [
    'Punto elástico 1x1 retorcido para máxima elasticidad y memoria',
    'Puño doblado de doble grosor (aprox. 7.5 cm doblado / 15 cm total)',
    '4 gajos simétricos de disminución en la coronilla',
    'Rayas verticales en contraste desde el borde hasta el vértice',
  ],
  suggestedYarnWeight: 'Worsted / Aran',
  suggestedNeedleMm: 4.5,
  difficulty: 'Intermediate',
  confidenceScore: 0.96,
  visionNotes: 'Detected 4 distinct decrease radials converging at apex. 1x1 vertical column ribs with 3-color palette.',
};

const DEFAULT_CONSTRAINTS: KnitUserConstraints = {
  targetSize: 'adult_m',
  circumferenceCm: 56,
  lengthCm: 22,
  brimLengthCm: 7.5,
  gaugeSts10cm: 18,
  gaugeRows10cm: 24,
  easeCm: -4,
  needleSizeMm: 4.5,
  yarnWeight: 'Worsted / Aran',
  language: 'es',
};

export default function App() {
  const [lang, setLang] = useState<Language>('es');
  const [currentImage, setCurrentImage] = useState<string>('/assets/aistudio/IMG_0240_e50ab8f0.jpg');
  const [blueprint, setBlueprint] = useState<KnitBlueprint | null>(INITIAL_NORTH_FACE_BLUEPRINT);
  const [constraints, setConstraints] = useState<KnitUserConstraints>(DEFAULT_CONSTRAINTS);
  const [compiledPattern, setCompiledPattern] = useState<CompiledPattern | null>(null);
  const [activePatternView, setActivePatternView] = useState<'instructions' | 'tracker' | 'chart'>('instructions');
  const [isCraftNotesOpen, setIsCraftNotesOpen] = useState(false);

  const patternSectionRef = useRef<HTMLDivElement>(null);
  const isEs = lang === 'es';

  // Re-compile pattern whenever blueprint, constraints or language change
  useEffect(() => {
    if (blueprint) {
      try {
        const pattern = compilePattern(blueprint, { ...constraints, language: lang });
        setCompiledPattern(pattern);
      } catch (err) {
        console.error('Error compiling pattern:', err);
      }
    }
  }, [blueprint, constraints, lang]);

  const handleToggleLang = () => {
    const nextLang: Language = lang === 'es' ? 'en' : 'es';
    setLang(nextLang);
    setConstraints((prev) => ({ ...prev, language: nextLang }));
  };

  const handleImageSelected = async (imageSrc: string, presetKey?: string) => {
    setCurrentImage(imageSrc);
    if (presetKey) {
      try {
        const res = await fetch('/api/analyze-knit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ presetKey }),
        });
        const data = await res.json();
        if (data.success && data.blueprint) {
          setBlueprint(data.blueprint);
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleSelectSectionFromPhoto = (sectionId: 'brim' | 'body' | 'crown') => {
    patternSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleReset = () => {
    setCurrentImage('/assets/aistudio/IMG_0240_e50ab8f0.jpg');
    setBlueprint(INITIAL_NORTH_FACE_BLUEPRINT);
    setConstraints(DEFAULT_CONSTRAINTS);
    setActivePatternView('instructions');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] flex flex-col font-sans">
      <Header
        onReset={handleReset}
        onPrint={handlePrint}
        hasCompiledPattern={Boolean(compiledPattern)}
        lang={lang}
        onToggleLang={handleToggleLang}
        onOpenCraftNotes={() => setIsCraftNotesOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-6">
        {/* 1. Interactive Garment Photo with Clickable Pins */}
        <section className="no-print">
          <InteractiveGarmentPhoto
            currentImage={currentImage}
            onImageSelected={handleImageSelected}
            blueprint={blueprint}
            lang={lang}
            onSelectSection={handleSelectSectionFromPhoto}
            castOnSts={compiledPattern?.calculatedGauge.castOnSts || 96}
          />
        </section>

        {/* 2. Essentials Card (Needles, Cast-on, Yarn, Size) */}
        {compiledPattern && (
          <section className="no-print">
            <KnitterEssentialsCard
              pattern={compiledPattern}
              constraints={constraints}
              onUpdateConstraints={setConstraints}
              lang={lang}
            />
          </section>
        )}

        {/* 3. The Pattern Section with Big Easy Navigation */}
        {compiledPattern && (
          <section ref={patternSectionRef} className="space-y-4">
            {/* View Mode Selector: Giant, easy-to-read touch buttons */}
            <div className="bg-white rounded-2xl p-1.5 border border-[#E8E3DC] flex items-center justify-between gap-1 shadow-xs no-print">
              <button
                type="button"
                onClick={() => setActivePatternView('instructions')}
                className={`flex-1 py-3 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer ${
                  activePatternView === 'instructions'
                    ? 'bg-[#2D5A43] text-white shadow-xs'
                    : 'text-[#4A504A] hover:bg-[#FAF8F5]'
                }`}
              >
                <ListOrdered className="w-4 h-4" />
                <span>{isEs ? 'Patrón Completo' : 'Full Pattern'}</span>
              </button>

              <button
                type="button"
                onClick={() => setActivePatternView('tracker')}
                className={`flex-1 py-3 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer ${
                  activePatternView === 'tracker'
                    ? 'bg-[#2D5A43] text-white shadow-xs'
                    : 'text-[#4A504A] hover:bg-[#FAF8F5]'
                }`}
              >
                <BookmarkCheck className="w-4 h-4" />
                <span>{isEs ? 'Contador Vuelta por Vuelta' : 'Live Row Counter'}</span>
              </button>

              <button
                type="button"
                onClick={() => setActivePatternView('chart')}
                className={`flex-1 py-3 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer ${
                  activePatternView === 'chart'
                    ? 'bg-[#2D5A43] text-white shadow-xs'
                    : 'text-[#4A504A] hover:bg-[#FAF8F5]'
                }`}
              >
                <Grid className="w-4 h-4" />
                <span>{isEs ? 'Diagrama / Gráfico' : 'Stitch Chart'}</span>
              </button>
            </div>

            {/* Pattern View Displays */}
            <div className="pattern-print-container">
              {activePatternView === 'instructions' && (
                <PatternView
                  pattern={compiledPattern}
                  onOpenRowTracker={() => setActivePatternView('tracker')}
                  lang={lang}
                />
              )}

              {activePatternView === 'tracker' && (
                <RowTracker pattern={compiledPattern} lang={lang} />
              )}

              {activePatternView === 'chart' && (
                <StitchChart
                  chartData={compiledPattern.chartData}
                  title={compiledPattern.title}
                  lang={lang}
                />
              )}
            </div>
          </section>
        )}
      </main>

      {/* Craft Notes & Deep Explanations Modal */}
      <CraftNotesModal
        isOpen={isCraftNotesOpen}
        onClose={() => setIsCraftNotesOpen(false)}
        lang={lang}
      />

      {/* Clean, low-noise footer */}
      <footer className="border-t border-[#E8E3DC] bg-white py-5 text-center text-xs text-[#6F756F] no-print mt-auto">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>KnitVision • {isEs ? 'Patrón a dos agujas calculado matemáticamente' : 'Mathematically compiled knitting pattern'}</span>
          <button
            onClick={() => setIsCraftNotesOpen(true)}
            className="text-[#2D5A43] font-bold hover:underline inline-flex items-center gap-1.5 cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>{isEs ? '¿Por qué funciona este patrón? (Guía y Fuentes)' : 'Why does this pattern work? (Guide & Sources)'}</span>
          </button>
        </div>
      </footer>
    </div>
  );
}
