import { KnitBlueprint } from '../types/knit';

const API_KEY_STORAGE_KEY = 'knitvision_gemini_api_key';
const API_KEY_VERIFIED_KEY = 'knitvision_gemini_api_key_verified';

export function getStoredApiKey(): string {
  try {
    return localStorage.getItem(API_KEY_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function isApiKeyVerified(): boolean {
  try {
    return localStorage.getItem(API_KEY_VERIFIED_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setStoredApiKey(key: string, verified = false): void {
  try {
    if (!key) {
      localStorage.removeItem(API_KEY_STORAGE_KEY);
      localStorage.removeItem(API_KEY_VERIFIED_KEY);
    } else {
      localStorage.setItem(API_KEY_STORAGE_KEY, key.trim());
      if (verified) {
        localStorage.setItem(API_KEY_VERIFIED_KEY, 'true');
      } else {
        localStorage.removeItem(API_KEY_VERIFIED_KEY);
      }
    }
  } catch (e) {
    console.error('Failed to save API key:', e);
  }
}

export const EXAMPLE_IMAGE_URL = './assets/aistudio/IMG_0240_e50ab8f0.jpg';

/** Starting point when a project from an older version has lost its blueprint fields. */
export const DEFAULT_BLUEPRINT: KnitBlueprint = {
  garmentType: 'beanie',
  title: 'My piece',
  description: '',
  construction: 'in_the_round',
  mainStitch: 'rib_1x1',
  hasFoldedBrim: false,
  crownWedges: 4,
  colorworkType: 'solid',
  features: [],
  suggestedYarnWeight: 'Worsted / Aran',
  suggestedNeedleMm: 4.5,
  difficulty: 'Advanced Beginner',
  confidenceScore: null,
};
