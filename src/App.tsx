import React, { useState, useEffect } from 'react';
import { Header, AppNavTab } from './components/Header';
import { InteractiveGarmentPhoto } from './components/InteractiveGarmentPhoto';
import { KnitterEssentialsCard } from './components/KnitterEssentialsCard';
import { PatternView } from './components/PatternView';
import { StitchChart } from './components/StitchChart';
import { RowTracker } from './components/RowTracker';
import { SavedProjectsView } from './components/SavedProjectsView';
import { SettingsView } from './components/SettingsView';
import { CraftNotesModal } from './components/CraftNotesModal';
import { compilePattern } from './engine/compiler';
import { KnitBlueprint, KnitUserConstraints, CompiledPattern, SavedProject } from './types/knit';
import { Language } from './i18n/translations';
import {
  loadSavedProjects,
  saveProject,
  deleteProject,
  updateProjectProgress,
} from './utils/storage';

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
  const [activeTab, setActiveTab] = useState<AppNavTab>('pattern');
  const [currentImage, setCurrentImage] = useState<string>('/assets/aistudio/IMG_0240_e50ab8f0.jpg');
  const [blueprint, setBlueprint] = useState<KnitBlueprint | null>(INITIAL_NORTH_FACE_BLUEPRINT);
  const [constraints, setConstraints] = useState<KnitUserConstraints>(DEFAULT_CONSTRAINTS);
  const [compiledPattern, setCompiledPattern] = useState<CompiledPattern | null>(null);
  const [isCraftNotesOpen, setIsCraftNotesOpen] = useState(false);

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

  const handleReset = () => {
    setCurrentImage('/assets/aistudio/IMG_0240_e50ab8f0.jpg');
    setBlueprint(INITIAL_NORTH_FACE_BLUEPRINT);
    setConstraints(DEFAULT_CONSTRAINTS);
    setCompletedSteps({});
    setActiveTab('pattern');
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
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        lang={lang}
        onOpenCraftNotes={() => setIsCraftNotesOpen(true)}
        savedCount={savedProjects.length}
      />

      {/* Main Tabbed Container: Clear, Distinct, Never Overwhelming */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-6">
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

      {/* Craft Notes & Deep Explanations Modal */}
      <CraftNotesModal
        isOpen={isCraftNotesOpen}
        onClose={() => setIsCraftNotesOpen(false)}
        lang={lang}
      />

      {/* Footer */}
      <footer className="border-t border-[#E8E3DC] bg-white py-5 text-center text-xs text-[#6F756F] no-print mt-auto">
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
