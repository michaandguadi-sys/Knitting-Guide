import { SavedProject, CompiledPattern } from '../types/knit';

const STORAGE_KEY = 'knitvision_saved_projects_v1';
const ACTIVE_PROJECT_KEY = 'knitvision_active_project_id';

export function loadSavedProjects(): SavedProject[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load saved projects from localStorage:', e);
    return [];
  }
}

export function saveProject(project: SavedProject): void {
  try {
    const projects = loadSavedProjects();
    const existingIndex = projects.findIndex((p) => p.id === project.id);
    if (existingIndex >= 0) {
      projects[existingIndex] = { ...project, updatedAt: new Date().toISOString() };
    } else {
      projects.unshift({
        ...project,
        savedAt: project.savedAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    localStorage.setItem(ACTIVE_PROJECT_KEY, project.id);
  } catch (e) {
    console.error('Failed to save project:', e);
  }
}

export function deleteProject(id: string): SavedProject[] {
  try {
    const projects = loadSavedProjects().filter((p) => p.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    return projects;
  } catch (e) {
    console.error('Failed to delete project:', e);
    return [];
  }
}

export function updateProjectProgress(
  id: string,
  currentStepIndex: number,
  completedSteps: Record<number, boolean>,
  notes?: string
): void {
  try {
    const projects = loadSavedProjects();
    const project = projects.find((p) => p.id === id);
    if (project) {
      project.currentStepIndex = currentStepIndex;
      project.completedSteps = completedSteps;
      if (notes !== undefined) project.notes = notes;
      project.updatedAt = new Date().toISOString();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    }
  } catch (e) {
    console.error('Failed to update project progress:', e);
  }
}

export function getActiveProjectId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_PROJECT_KEY);
  } catch (e) {
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
