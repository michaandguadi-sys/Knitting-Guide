import { compilePattern } from '../engine/compiler';
import { SavedProject, TrackerPosition } from '../types/knit';

const STORAGE_KEY = 'knitvision_saved_projects_v1';
const ACTIVE_PROJECT_KEY = 'knitvision_active_project_id';

export type SaveResult = { ok: true } | { ok: false; reason: 'full' | 'blocked' };

/** Photos are far too big for localStorage and are not needed to knit from a project. */
function stripImages(project: SavedProject): SavedProject {
  const { isolatedImageUrl, croppedImageUrl, ...blueprint } = project.pattern.blueprint;
  void isolatedImageUrl;
  void croppedImageUrl;
  return { ...project, pattern: { ...project.pattern, blueprint } };
}

/** Projects saved by earlier versions have no worked rows, so they are recompiled on load. */
function migrate(project: SavedProject): SavedProject {
  const pattern = project.pattern;
  if (pattern?.howItsMade && pattern.allRows?.every((r) => r.kind)) return project;
  try {
    const fresh = compilePattern(
      { ...pattern.blueprint, confidenceScore: pattern.blueprint.confidenceScore ?? null },
      pattern.constraints
    );
    return { ...project, pattern: fresh, tracker: project.tracker ?? { stepIndex: 0, rowInStep: 0 }, completedSteps: {} };
  } catch (e) {
    console.error('Could not update saved project:', project.id, e);
    return project;
  }
}

function writeAll(projects: SavedProject[]): SaveResult {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    return { ok: true };
  } catch (e) {
    const full = e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22);
    return { ok: false, reason: full ? 'full' : 'blocked' };
  }
}

export function loadSavedProjects(): SavedProject[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((p) => p?.pattern?.blueprint).map(migrate);
  } catch (e) {
    console.error('Failed to load saved projects from localStorage:', e);
    return [];
  }
}

export function saveProject(project: SavedProject): SaveResult {
  const projects = loadSavedProjects();
  const clean = stripImages(project);
  const existingIndex = projects.findIndex((p) => p.id === project.id);
  if (existingIndex >= 0) {
    projects[existingIndex] = { ...clean, updatedAt: new Date().toISOString() };
  } else {
    projects.unshift({
      ...clean,
      savedAt: clean.savedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
  const result = writeAll(projects);
  if (result.ok) setActiveProjectId(project.id);
  return result;
}

export function deleteProject(id: string): SavedProject[] {
  const projects = loadSavedProjects().filter((p) => p.id !== id);
  writeAll(projects);
  return projects;
}

export function updateProjectProgress(
  id: string,
  update: { tracker?: TrackerPosition; completedSteps?: Record<number, boolean>; notes?: string }
): SaveResult {
  const projects = loadSavedProjects();
  const project = projects.find((p) => p.id === id);
  if (!project) return { ok: true };
  if (update.tracker) {
    project.tracker = update.tracker;
    project.currentStepIndex = update.tracker.stepIndex;
  }
  if (update.completedSteps) project.completedSteps = update.completedSteps;
  if (update.notes !== undefined) project.notes = update.notes;
  project.updatedAt = new Date().toISOString();
  return writeAll(projects);
}

export function getActiveProjectId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_PROJECT_KEY);
  } catch {
    return null;
  }
}

export function setActiveProjectId(id: string): void {
  try {
    localStorage.setItem(ACTIVE_PROJECT_KEY, id);
  } catch (e) {
    console.error(e);
  }
}
