import { KnitBlueprint } from '../types/knit';

export type AiProviderId = 'claude' | 'gemini';

const KEY_STORAGE: Record<AiProviderId, { key: string; verified: string }> = {
  gemini: { key: 'knitvision_gemini_api_key', verified: 'knitvision_gemini_api_key_verified' },
  claude: { key: 'knitvision_claude_api_key', verified: 'knitvision_claude_api_key_verified' },
};
export function getStoredApiKey(provider: AiProviderId): string {
  try {
    return localStorage.getItem(KEY_STORAGE[provider].key) || '';
  } catch {
    return '';
  }
}

export function isApiKeyVerified(provider: AiProviderId): boolean {
  try {
    return localStorage.getItem(KEY_STORAGE[provider].verified) === 'true';
  } catch {
    return false;
  }
}

export function setStoredApiKey(provider: AiProviderId, key: string, verified = false): void {
  const slot = KEY_STORAGE[provider];
  try {
    if (!key) {
      localStorage.removeItem(slot.key);
      localStorage.removeItem(slot.verified);
    } else {
      localStorage.setItem(slot.key, key.trim());
      if (verified) {
        localStorage.setItem(slot.verified, 'true');
      } else {
        localStorage.removeItem(slot.verified);
      }
    }
  } catch (e) {
    console.error('Failed to save API key:', e);
  }
}

/** Claude reads the pictures. Gemini, if it has a key, only steps in when Claude fails. */
export function getAiServices(): { provider: AiProviderId; apiKey: string }[] {
  return (['claude', 'gemini'] as const).flatMap((provider) => {
    const apiKey = getStoredApiKey(provider);
    return apiKey ? [{ provider, apiKey }] : [];
  });
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
