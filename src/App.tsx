import React, { useEffect, useMemo, useState } from 'react';
import { Header, AppNavTab } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { DecodeApplied, DecodeView } from './components/DecodeView';
import { KnitterEssentialsCard } from './components/KnitterEssentialsCard';
import { PatternView } from './components/PatternView';
import { RowTracker } from './components/RowTracker';
import { SavedProjectsView } from './components/SavedProjectsView';
import { SettingsView } from './components/SettingsView';
import { CraftNotesModal } from './components/CraftNotesModal';
import { YARN_SPECS, sizePresetsFor } from './engine/compiler';
import { resolvePattern, sameMeasurements } from './engine/resolvePattern';
import { suggestGauge } from './engine/stitches';
import { pickStitchReading, toBlueprint } from './decode/reconcile';
import { CompiledPattern, GarmentType, KnitBlueprint, KnitUserConstraints, SavedProject, TrackerPosition } from './types/knit';
import { Language } from './i18n/translations';
import {
  deleteProject,
  getActiveProjectId,
  loadSavedProjects,
  saveProject,
  setActiveProjectId as storeActiveProjectId,
  updateProjectProgress,
} from './utils/storage';
import { AlertTriangle, Camera, X } from 'lucide-react';

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

/** Typical gauge for a yarn, the starting point until the knitter has a swatch. */
const GAUGE_BY_YARN: Record<KnitUserConstraints['yarnWeight'], number> = {
  'Fingering / 4-ply': 30,
  'Sport': 25,
  'DK / Light Worsted': 22,
  'Worsted / Aran': 18,
  'Chunky / Bulky': 14,
  'Super Bulky': 9,
};

function sizeFor(garment: GarmentType, lang: Language) {
  const options = sizePresetsFor(garment, lang);
  const pick = options.find((o) => o.id === 'regular') ?? options[options.length - 1];
  return {
    targetSize: pick.id,
    circumferenceCm: pick.circ,
    lengthCm: pick.len,
    brimLengthCm: 'brim' in pick ? (pick.brim as number) : undefined,
    easeCm: garment === 'beanie' ? -4 : 0,
  };
}

export default function App() {
  const [lang, setLang] = useState<Language>('es');
  const [activeTab, setActiveTab] = useState<AppNavTab>('photo');
  const [blueprint, setBlueprint] = useState<KnitBlueprint | null>(null);
  const [constraints, setConstraints] = useState<KnitUserConstraints>(DEFAULT_CONSTRAINTS);
  const [isCraftNotesOpen, setIsCraftNotesOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [completedSteps, setCompletedSteps] = useState<Record<number, boolean>>({});
  const [tracker, setTracker] = useState<TrackerPosition>({ stepIndex: 0, rowInStep: 0 });
  /** The active project's own pattern, which improvements to the app must not rewrite. */
  const [savedPattern, setSavedPattern] = useState<CompiledPattern | null>(null);

  const isEs = lang === 'es';

  const reportSave = (result: { ok: boolean; reason?: string }) => {
    if (!result.ok) {
      setNotice(
        isEs
          ? 'No se pudo guardar tu progreso: este navegador no tiene lugar o lo está bloqueando. Anotá la vuelta en la que vas.'
          : 'Your progress could not be saved: this browser is out of space or blocking storage. Write down the row you are on.'
      );
    }
  };

  // Reopen the project the knitter was working on, at the row they left it.
  useEffect(() => {
    const projects = loadSavedProjects();
    setSavedProjects(projects);
    const lastId = getActiveProjectId();
    const last = projects.find((p) => p.id === lastId);
    if (last) {
      setSavedPattern(last.pattern);
      setBlueprint(last.pattern.blueprint);
      setConstraints(last.pattern.constraints);
      setLang(last.pattern.constraints.language ?? 'es');
      setCompletedSteps(last.completedSteps || {});
      setTracker(last.tracker ?? { stepIndex: last.currentStepIndex || 0, rowInStep: 0 });
      setActiveProjectId(last.id);
      setActiveTab('counter');
    }
  }, []);

  const { pattern: compiledPattern, compileError } = useMemo(() => {
    if (!blueprint) return { pattern: null, compileError: null };
    try {
      return { pattern: resolvePattern(savedPattern, blueprint, constraints, lang), compileError: null };
    } catch (err) {
      console.error('Error compiling pattern:', err);
      return { pattern: null, compileError: (err as Error).message };
    }
  }, [blueprint, constraints, lang, savedPattern]);

  // A rebuilt pattern replaces the saved one. New measurements mean new rows, so the place starts
  // over. A translation has the same steps, so the knitter keeps their place.
  useEffect(() => {
    if (!compiledPattern || !activeProjectId || compiledPattern === savedPattern) return;
    const project = loadSavedProjects().find((p) => p.id === activeProjectId);
    if (!project) return;
    const newRows = !sameMeasurements(project.pattern.constraints, compiledPattern.constraints);
    reportSave(
      saveProject(
        newRows
          ? { ...project, pattern: compiledPattern, tracker: { stepIndex: 0, rowInStep: 0 }, completedSteps: {} }
          : { ...project, pattern: compiledPattern }
      )
    );
    if (newRows) {
      setTracker({ stepIndex: 0, rowInStep: 0 });
      setCompletedSteps({});
    }
    setSavedPattern(compiledPattern);
    setSavedProjects(loadSavedProjects());
  }, [compiledPattern, activeProjectId, savedPattern]);

  const handleToggleLang = () => {
    const nextLang: Language = lang === 'es' ? 'en' : 'es';
    setLang(nextLang);
    setConstraints((prev) => ({ ...prev, language: nextLang }));
  };

  const handleToggleStep = (stepNumber: number) => {
    setCompletedSteps((prev) => {
      const updated = { ...prev, [stepNumber]: !prev[stepNumber] };
      if (activeProjectId) {
        reportSave(updateProjectProgress(activeProjectId, { completedSteps: updated }));
      }
      return updated;
    });
  };

  const handleTracker = (position: TrackerPosition) => {
    setTracker(position);
    if (activeProjectId) reportSave(updateProjectProgress(activeProjectId, { tracker: position }));
  };

  const handleSaveCurrentAsProject = (projectName: string, recipientName: string) => {
    if (!compiledPattern) return;
    const newProj: SavedProject = {
      id: `project-${Date.now()}`,
      name: projectName,
      recipientName,
      pattern: compiledPattern,
      currentStepIndex: tracker.stepIndex,
      completedSteps,
      tracker,
      notes: '',
      savedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    reportSave(saveProject(newProj));
    setSavedProjects(loadSavedProjects());
    setSavedPattern(compiledPattern);
    setActiveProjectId(newProj.id);
  };

  const handleLoadProject = (proj: SavedProject) => {
    setSavedPattern(proj.pattern);
    setLang(proj.pattern.constraints.language ?? 'es');
    setBlueprint(proj.pattern.blueprint);
    setConstraints(proj.pattern.constraints);
    setCompletedSteps(proj.completedSteps || {});
    setTracker(proj.tracker ?? { stepIndex: proj.currentStepIndex || 0, rowInStep: 0 });
    setActiveProjectId(proj.id);
    storeActiveProjectId(proj.id);
    setActiveTab('counter');
  };

  const handleDeleteProject = (id: string) => {
    setSavedProjects(deleteProject(id));
    if (id === activeProjectId) {
      setActiveProjectId(null);
      setSavedPattern(null);
    }
  };

  const handleUpdateNotes = (id: string, notes: string) => {
    reportSave(updateProjectProgress(id, { notes }));
    setSavedProjects(loadSavedProjects());
  };

  const handleApplyDecode = ({ decoded, report, gauge }: DecodeApplied) => {
    const reading = report ? pickStitchReading(report.readings) : null;
    const next = toBlueprint(decoded, reading, lang);
    setSavedPattern(null);
    setBlueprint(next);
    const yarn = decoded.yarnWeight.value;
    // A gauge measured from the picture is already this fabric's. Otherwise estimate it per stitch.
    const estimate = suggestGauge(next.mainStitch, GAUGE_BY_YARN[yarn]);
    setConstraints((prev) => ({
      ...prev,
      ...sizeFor(next.garmentType, lang),
      yarnWeight: yarn,
      needleSizeMm: decoded.needleMm.value || YARN_SPECS[yarn].defaultNeedle,
      gaugeSts10cm: gauge?.sts ?? estimate.sts,
      gaugeRows10cm: gauge?.rows ?? estimate.rows,
      language: lang,
    }));
    // A new piece must never inherit the row count of whatever was on the needles before.
    setCompletedSteps({});
    setTracker({ stepIndex: 0, rowInStep: 0 });
    setActiveProjectId(null);
    setActiveTab('pattern');
    window.scrollTo?.({ top: 0 });
  };

  const handleReset = () => {
    setSavedPattern(null);
    setBlueprint(null);
    setConstraints(DEFAULT_CONSTRAINTS);
    setCompletedSteps({});
    setTracker({ stepIndex: 0, rowInStep: 0 });
    setActiveProjectId(null);
    setActiveTab('photo');
    setNotice(null);
  };

  const needsPiece = (
    <div className="bg-white rounded-3xl border border-[#E8E3DC] p-8 text-center space-y-3">
      <p className="text-sm text-[#4A504A]">
        {compileError
          ? (isEs ? 'Estas medidas no permiten escribir el patrón. Revisá la tensión y el tamaño.' : 'A pattern cannot be written with these numbers. Check the gauge and size.')
          : (isEs ? 'Todavía no hay una prenda. Empezá con una foto.' : 'No piece yet. Start with a photo.')}
      </p>
      <button
        type="button"
        onClick={() => setActiveTab('photo')}
        className="min-h-[48px] px-5 rounded-2xl bg-[#2D5A43] text-white font-bold text-sm inline-flex items-center gap-2 cursor-pointer"
      >
        <Camera className="w-4 h-4" />
        {isEs ? 'Ir a la foto' : 'Go to photo'}
      </button>
    </div>
  );

  return (
    <div className="min-h-[100dvh] bg-[#FAF8F5] flex flex-col font-sans selection:bg-[#E4ECE7] selection:text-[#1C3A2B]">
      <Header
        onReset={handleReset}
        onPrint={() => window.print()}
        hasCompiledPattern={Boolean(compiledPattern)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        lang={lang}
        onOpenCraftNotes={() => setIsCraftNotesOpen(true)}
        savedCount={savedProjects.length}
      />

      <main className="flex-1 max-w-5xl w-full mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-6 pb-28 sm:pb-32">
        {notice && (
          <div role="alert" className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-semibold flex items-center justify-between gap-2 shadow-2xs">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{notice}</span>
            </div>
            <button type="button" onClick={() => setNotice(null)} aria-label={isEs ? 'Cerrar' : 'Dismiss'} className="p-1 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Kept mounted so that photos and answers survive switching tabs. */}
        <div className={activeTab === 'photo' ? '' : 'hidden'}>
          <DecodeView lang={lang} onApply={handleApplyDecode} onOpenSettings={() => setActiveTab('settings')} />
        </div>

        {activeTab === 'pattern' &&
          (compiledPattern ? (
            <div className="space-y-6 animate-in fade-in">
              <KnitterEssentialsCard pattern={compiledPattern} constraints={constraints} onUpdateConstraints={setConstraints} lang={lang} />
              <PatternView
                pattern={compiledPattern}
                onOpenRowTracker={() => setActiveTab('counter')}
                lang={lang}
                onToggleStep={handleToggleStep}
                completedSteps={completedSteps}
              />
            </div>
          ) : (
            needsPiece
          ))}

        {activeTab === 'counter' &&
          (compiledPattern ? (
            <div className="space-y-6 animate-in fade-in">
              {!activeProjectId && (
                <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs sm:text-sm text-amber-900 flex flex-col sm:flex-row sm:items-center gap-2">
                  <span className="flex-1">
                    {isEs ? 'Este patrón todavía no está guardado, así que perderías la vuelta si cerrás la app.' : 'This pattern is not saved yet, so you would lose your place if you close the app.'}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleSaveCurrentAsProject(compiledPattern.title, '')}
                    className="min-h-[42px] px-3 rounded-xl bg-[#2D5A43] text-white text-xs font-bold cursor-pointer flex-shrink-0"
                  >
                    {isEs ? 'Guardar ahora' : 'Save now'}
                  </button>
                </div>
              )}
              <RowTracker pattern={compiledPattern} lang={lang} position={tracker} onChange={handleTracker} />
            </div>
          ) : (
            needsPiece
          ))}

        {activeTab === 'projects' &&
          (compiledPattern || savedProjects.length > 0 ? (
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
          ) : (
            needsPiece
          ))}

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

      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} lang={lang} savedCount={savedProjects.length} />

      <CraftNotesModal isOpen={isCraftNotesOpen} onClose={() => setIsCraftNotesOpen(false)} lang={lang} />

      <footer className="border-t border-[#E8E3DC] bg-white py-5 text-center text-xs text-[#6F756F] no-print mt-auto mb-20 sm:mb-24">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>KnitVision</span>
          <button onClick={() => setIsCraftNotesOpen(true)} className="text-[#2D5A43] font-bold hover:underline inline-flex items-center gap-1.5 cursor-pointer">
            <span>{isEs ? '¿Por qué funciona este patrón? (Guía y Fuentes)' : 'Why does this pattern work? (Guide & Sources)'}</span>
          </button>
        </div>
      </footer>
    </div>
  );
}
