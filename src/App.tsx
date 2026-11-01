import React, { useState, useEffect } from 'react';
import { Header, AppNavTab } from './components/Header';
import { MobileBottomNav } from './components/MobileBottomNav';
import { InteractiveGarmentPhoto } from './components/InteractiveGarmentPhoto';
import { KnitterEssentialsCard } from './components/KnitterEssentialsCard';
import { PatternView } from './components/PatternView';
import { RowTracker } from './components/RowTracker';
import { SavedProjectsView } from './components/SavedProjectsView';
import { SettingsView } from './components/SettingsView';
import { CraftNotesModal } from './components/CraftNotesModal';
import { compilePattern } from './engine/compiler';
import { KnitBlueprint, KnitUserConstraints, CompiledPattern, SavedProject } from './types/knit';
import { Language } from './i18n/translations';
import { analyzeKnit, PRESET_BLUEPRINTS } from './utils/aiAnalyzer';
import {
  loadSavedProjects,
  saveProject,
  deleteProject,
  updateProjectProgress,
} from './utils/storage';
import { Sparkles, Info, X } from 'lucide-react';

const INITIAL_NORTH_FACE_BLUEPRINT: KnitBlueprint = PRESET_BLUEPRINTS.north_face_beanie;

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
  const [activeTab, setActiveTab] = useState<AppNavTab>('pattern');
  const [currentImage, setCurrentImage] = useState<string>('./assets/aistudio/IMG_0240_e50ab8f0.jpg');
  const [blueprint, setBlueprint] = useState<KnitBlueprint | null>(INITIAL_NORTH_FACE_BLUEPRINT);
  const [constraints, setConstraints] = useState<KnitUserConstraints>(DEFAULT_CONSTRAINTS);
  const [compiledPattern, setCompiledPattern] = useState<CompiledPattern | null>(null);
  const [isCraftNotesOpen, setIsCraftNotesOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisNotice, setAnalysisNotice] = useState<string | null>(null);

  // Persistence State
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string>('project-north-face-default');
  const [completedSteps, setCompletedSteps] = useState<Record<number, boolean>>({});

  const isEs = lang === 'es';

  // Initial load from storage (and seed if empty)
  useEffect(() => {
    let projects = loadSavedProjects();
    if (projects.length === 0 && blueprint) {
      const initialPattern = compilePattern(blueprint, { ...constraints, language: 'es' });
      const seedProject: SavedProject = {
        id: 'project-north-face-default',
        name: 'Gorro The North Face',
        recipientName: 'Para tejer ahora',
        pattern: initialPattern,
        currentStepIndex: 0,
        completedSteps: {},
        notes: 'Hilado semigrueso (Cashmilon 4/7 o Merino), aguja circular 4.5 mm de 40 cm.',
        savedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      saveProject(seedProject);
      projects = [seedProject];
    }
    setSavedProjects(projects);
  }, []);

  // Re-compile pattern when blueprint, constraints or language change
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

  const handleToggleStep = (stepNumber: number) => {
    setCompletedSteps((prev) => {
      const updated = { ...prev, [stepNumber]: !prev[stepNumber] };
      if (activeProjectId) {
        updateProjectProgress(activeProjectId, 0, updated);
        setSavedProjects(loadSavedProjects());
      }
      return updated;
    });
  };

  const handleSaveCurrentAsProject = (projectName: string, recipientName: string) => {
    if (!compiledPattern) return;
    const newProj: SavedProject = {
      id: `project-${Date.now()}`,
      name: projectName,
      recipientName,
      pattern: compiledPattern,
      currentStepIndex: 0,
      completedSteps,
      notes: '',
      savedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveProject(newProj);
    setSavedProjects(loadSavedProjects());
    setActiveProjectId(newProj.id);
  };

  const handleLoadProject = (proj: SavedProject) => {
    setBlueprint(proj.pattern.blueprint);
    setConstraints(proj.pattern.constraints);
    setCompiledPattern(proj.pattern);
    setCompletedSteps(proj.completedSteps || {});
    setActiveProjectId(proj.id);
    setActiveTab('counter'); // Takes her straight to row counter!
  };

  const handleDeleteProject = (id: string) => {
    const updated = deleteProject(id);
    setSavedProjects(updated);
  };

  const handleUpdateNotes = (id: string, notes: string) => {
    updateProjectProgress(id, 0, completedSteps, notes);
    setSavedProjects(loadSavedProjects());
  };

  const handleImageSelected = async (imageSrc: string, presetKey?: string) => {
    setCurrentImage(imageSrc);
    setIsAnalyzing(true);
    setAnalysisNotice(null);

    try {
      const result = await analyzeKnit({
        imageBase64: imageSrc.startsWith('data:') ? imageSrc : undefined,
        presetKey,
      });

      if (result.success && result.blueprint) {
        setBlueprint(result.blueprint);
        if (result.warning) {
          setAnalysisNotice(result.warning);
        } else if (result.source === 'gemini-flash') {
          setAnalysisNotice(
            isEs
              ? '✨ ¡Prenda decodificada con éxito mediante Google Gemini 2.5 Flash!'
              : '✨ Garment successfully decoded with Google Gemini 2.5 Flash!'
          );
        }
      }
    } catch (e) {
      console.error('Image analysis error:', e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleReset = () => {
    setCurrentImage('./assets/aistudio/IMG_0240_e50ab8f0.jpg');
    setBlueprint(INITIAL_NORTH_FACE_BLUEPRINT);
    setConstraints(DEFAULT_CONSTRAINTS);
    setCompletedSteps({});
    setActiveTab('pattern');
    setAnalysisNotice(null);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-[100dvh] bg-[#FAF8F5] flex flex-col font-sans selection:bg-[#E4ECE7] selection:text-[#1C3A2B]">
      {/* Header for Desktop & iPad */}
      <Header
        onReset={handleReset}
        onPrint={handlePrint}
        hasCompiledPattern={Boolean(compiledPattern)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        lang={lang}
        onOpenCraftNotes={() => setIsCraftNotesOpen(true)}
        savedCount={savedProjects.length}
      />

      {/* Main Tabbed Container: Clear, Distinct, Never Overwhelming */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-6 pb-24 md:pb-10">
        {/* Status / Notice Banner */}
        {analysisNotice && (
          <div className="bg-[#E4ECE7] border border-[#C2DEC8] text-[#1C3A2B] px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-semibold flex items-center justify-between gap-2 shadow-2xs animate-in fade-in">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#2D5A43] flex-shrink-0" />
              <span>{analysisNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setAnalysisNotice(null)}
              className="text-[#2D5A43] hover:text-[#1C3A2B] p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Tab 1: Prenda y Foto */}
        {activeTab === 'photo' && (
          <div className="space-y-6 animate-in fade-in">
            <InteractiveGarmentPhoto
              currentImage={currentImage}
              onImageSelected={handleImageSelected}
              blueprint={blueprint}
              lang={lang}
              onSelectSection={() => setActiveTab('pattern')}
              castOnSts={compiledPattern?.calculatedGauge.castOnSts || 96}
              isAnalyzing={isAnalyzing}
            />

            {compiledPattern && (
              <KnitterEssentialsCard
                pattern={compiledPattern}
                constraints={constraints}
                onUpdateConstraints={setConstraints}
                lang={lang}
              />
            )}
          </div>
        )}

        {/* Tab 2: Patrón Escrito */}
        {activeTab === 'pattern' && compiledPattern && (
          <div className="space-y-6 animate-in fade-in">
            <KnitterEssentialsCard
              pattern={compiledPattern}
              constraints={constraints}
              onUpdateConstraints={setConstraints}
              lang={lang}
            />

            <PatternView
              pattern={compiledPattern}
              onOpenRowTracker={() => setActiveTab('counter')}
              lang={lang}
              onToggleStep={handleToggleStep}
              completedSteps={completedSteps}
            />
          </div>
        )}

        {/* Tab 3: Contador Vuelta por Vuelta */}
        {activeTab === 'counter' && compiledPattern && (
          <div className="space-y-6 animate-in fade-in">
            <RowTracker pattern={compiledPattern} lang={lang} />
          </div>
        )}

        {/* Tab 4: Mis Tejidos Guardados */}
        {activeTab === 'projects' && compiledPattern && (
          <div className="space-y-6 animate-in fade-in">
            <SavedProjectsView
              savedProjects={savedProjects}
              currentPattern={compiledPattern}
              onLoadProject={handleLoadProject}
              onSaveCurrentAsProject={handleSaveCurrentAsProject}
              onDeleteProject={handleDeleteProject}
              onUpdateNotes={handleUpdateNotes}
              lang={lang}
            />
          </div>
        )}

        {/* Tab 5: Ajustes */}
        {activeTab === 'settings' && (
          <div className="space-y-6 animate-in fade-in">
            <SettingsView
              constraints={constraints}
              onUpdateConstraints={setConstraints}
              lang={lang}
              onToggleLang={handleToggleLang}
              onOpenCraftNotes={() => setIsCraftNotesOpen(true)}
              onResetAll={handleReset}
            />
          </div>
        )}
      </main>

      {/* Mobile Bottom Navigation Bar (Visible only on phones/small screens) */}
      <MobileBottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        lang={lang}
        savedCount={savedProjects.length}
      />

      {/* Craft Notes & Deep Explanations Modal */}
      <CraftNotesModal
        isOpen={isCraftNotesOpen}
        onClose={() => setIsCraftNotesOpen(false)}
        lang={lang}
      />

      {/* Footer */}
      <footer className="border-t border-[#E8E3DC] bg-white py-5 text-center text-xs text-[#6F756F] no-print mt-auto mb-14 md:mb-0">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>KnitVision • {isEs ? 'Patrón a dos agujas calculado matemáticamente' : 'Mathematically compiled knitting pattern'}</span>
          <button
            onClick={() => setIsCraftNotesOpen(true)}
            className="text-[#2D5A43] font-bold hover:underline inline-flex items-center gap-1.5 cursor-pointer"
          >
            <span>{isEs ? '¿Por qué funciona este patrón? (Guía y Fuentes)' : 'Why does this pattern work? (Guide & Sources)'}</span>
          </button>
        </div>
      </footer>
    </div>
  );
}
