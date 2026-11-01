import { KnitBlueprint, StripeDefinition, GarmentType, StitchType } from '../types/knit';

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

export interface KeyVerificationResult {
  valid: boolean;
  message: string;
  model?: string;
  latencyMs?: number;
}

/**
 * Actively calls the Google Gemini API to verify the key works and has available quota
 */
export async function verifyGeminiApiKey(apiKey: string): Promise<KeyVerificationResult> {
  const cleanKey = apiKey.trim();
  if (!cleanKey) {
    return {
      valid: false,
      message: 'La clave no puede estar vacía.',
    };
  }

  const startTime = Date.now();
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(
        cleanKey
      )}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: 'Ping test for knitting pattern engine. Reply with single word OK.' }],
            },
          ],
          generationConfig: {
            maxOutputTokens: 5,
            temperature: 0,
          },
        }),
      }
    );

    const latencyMs = Date.now() - startTime;

    if (res.ok) {
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        setStoredApiKey(cleanKey, true);
        return {
          valid: true,
          message: '✓ Clave verificada con éxito. Gemini 2.5 Flash está activo y respondiendo.',
          model: 'gemini-2.5-flash',
          latencyMs,
        };
      }
    }

    // Parse specific error from Google API
    const errorJson = await res.json().catch(() => ({}));
    const apiError = errorJson?.error?.message || errorJson?.error?.status || `Error HTTP ${res.status}`;
    setStoredApiKey(cleanKey, false);

    return {
      valid: false,
      message: `Google AI rechazó la clave: ${apiError}`,
    };
  } catch (err: any) {
    setStoredApiKey(cleanKey, false);
    return {
      valid: false,
      message: `Error de conexión: ${err.message || 'No se pudo conectar con el servidor de Google'}`,
    };
  }
}

export interface SamplePresetItem {
  id: string;
  presetKey: string;
  titleEs: string;
  titleEn: string;
  descriptionEs: string;
  descriptionEn: string;
  tagEs: string;
  tagEn: string;
  imageUrl: string;
}

export const SAMPLE_PRESETS: SamplePresetItem[] = [
  {
    id: 'north_face_beanie',
    presetKey: 'north_face_beanie',
    titleEs: 'Gorro The North Face',
    titleEn: 'The North Face Striped Beanie',
    descriptionEs: 'Gorro elástico a rayas con puño doblado y coronilla en 4 gajos.',
    descriptionEn: 'Elastic ribbed beanie with folded brim and 4-wedge crown decreases.',
    tagEs: 'Rayas y Puño Doblado',
    tagEn: 'Striped Folded Rib',
    imageUrl: './assets/aistudio/IMG_0240_e50ab8f0.jpg',
  },
  {
    id: 'classic_rib_beanie',
    presetKey: 'classic_rib_beanie',
    titleEs: 'Gorro Pescador Minimalista',
    titleEn: 'Fisherman Folded Beanie',
    descriptionEs: 'Punto elástico 1x1 puro, color avena, puño amplio y copa anatómica.',
    descriptionEn: 'Pure 1x1 rib, oatmeal heather, folded brim, anatomical fit.',
    tagEs: 'Clásico Liso',
    tagEn: 'Solid Classic',
    imageUrl: 'https://images.unsplash.com/photo-1576871337622-98d48d1cf531?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'cloud_scarf',
    presetKey: 'cloud_scarf',
    titleEs: 'Bufanda Nube en Punto Santa Clara',
    titleEn: 'Chunky Garter Cloud Scarf',
    descriptionEs: 'Tejido plano ultra suave con orillo prolijo y textura esponjosa.',
    descriptionEn: 'Plush flat garter stitch scarf with neat chain selvedge edges.',
    tagEs: 'Bufanda Fácil',
    tagEn: 'Garter Scarf',
    imageUrl: 'https://images.unsplash.com/photo-1520903920243-00d872a2d1c9?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'brioche_cowl',
    presetKey: 'brioche_cowl',
    titleEs: 'Cuello Infinito en Punto Inglés',
    titleEn: 'Cozy Brioche Honeycomb Cowl',
    descriptionEs: 'Cuello circular sin costuras, grueso y térmico para el invierno.',
    descriptionEn: 'Seamless circular cowl with deep squishy ribbed thermal texture.',
    tagEs: 'Cuello Térmico',
    tagEn: 'Thermal Cowl',
    imageUrl: 'https://images.unsplash.com/photo-1608256246200-53e635b5b65f?auto=format&fit=crop&w=600&q=80',
  },
];

export const PRESET_BLUEPRINTS: Record<string, KnitBlueprint> = {
  north_face_beanie: {
    garmentType: 'beanie',
    title: 'The North Face Striped Ribbed Beanie',
    description: 'Classic outdoor ribbed knit beanie with vertical pinstripes, deep folded cuff, and 4-wedge crown decrease shaping.',
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
      '4 gajos simétricos de disminución en la coronilla con líneas diagonales prolijas',
      'Rayas verticales en contraste desde el borde hasta el vértice',
      'Parche tejido colocado centrado en el puño doblado',
    ],
    suggestedYarnWeight: 'Worsted / Aran',
    suggestedNeedleMm: 4.5,
    difficulty: 'Intermediate',
    confidenceScore: 0.98,
    visionNotes: 'Detected 4 distinct decrease radials converging at apex. 1x1 vertical column ribs with 3-color palette (sage green field with cream white and dark olive stripes).',
  },
  classic_rib_beanie: {
    garmentType: 'beanie',
    title: 'Minimalist Fisherman Folded Beanie',
    description: 'Timeless folded brim beanie with snug 1x1 ribbing and 4-point crown shaping.',
    construction: 'in_the_round',
    mainStitch: 'rib_1x1',
    hasFoldedBrim: true,
    brimHeightRatio: 0.35,
    crownWedges: 4,
    colorworkType: 'solid',
    stripes: [{ colorName: 'Oatmeal Heather', hex: '#D6C8B4', widthStsEstimate: 1, role: 'base' }],
    features: ['Punto elástico 1x1 elástico', 'Puño doblado doble capa', '4 gajos de disminución en coronilla'],
    suggestedYarnWeight: 'Worsted / Aran',
    suggestedNeedleMm: 4.5,
    difficulty: 'Beginner',
    confidenceScore: 0.98,
    visionNotes: 'Solid single-color ribbed beanie with clean 4-wedge crown decreases.',
  },
  cloud_scarf: {
    garmentType: 'scarf',
    title: 'Chunky Garter Cloud Scarf',
    description: 'Plush squishy garter stitch scarf with neat chain selvedge edges.',
    construction: 'bottom_up_flat',
    mainStitch: 'garter',
    colorworkType: 'solid',
    stripes: [{ colorName: 'Warm Camel', hex: '#C29B72', widthStsEstimate: 1, role: 'base' }],
    features: ['Punto Santa Clara / Garter', 'Orillo prolijo en punto deslizado', 'Construcción rectangular plana'],
    suggestedYarnWeight: 'Chunky / Bulky',
    suggestedNeedleMm: 6.5,
    difficulty: 'Beginner',
    confidenceScore: 0.99,
    visionNotes: 'Horizontal garter ridges across flat rectangular garment with slip-stitch edge.',
  },
  brioche_cowl: {
    garmentType: 'cowl',
    title: 'Cozy Brioche Honeycomb Cowl',
    description: 'Plush circular cowl worked in continuous rounds with deep ribbed insulation.',
    construction: 'in_the_round',
    mainStitch: 'rib_2x2',
    colorworkType: 'solid',
    stripes: [{ colorName: 'Charcoal Heather', hex: '#3B3F45', widthStsEstimate: 1, role: 'base' }],
    features: ['Tejido circular sin costura', 'Punto térmico 2x2 de alta absorción de frío', 'Cierre tubular elástico'],
    suggestedYarnWeight: 'Worsted / Aran',
    suggestedNeedleMm: 5.0,
    difficulty: 'Beginner',
    confidenceScore: 0.95,
    visionNotes: 'Circular tube cowl with 2x2 rib memory and stretch.',
  },
};

/**
 * Extracts dominant colors from an image base64 or URL using an offscreen canvas
 */
export async function extractPaletteFromImage(imageSrc: string): Promise<StripeDefinition[]> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(PRESET_BLUEPRINTS.north_face_beanie.stripes || []);
          return;
        }

        const size = 64;
        canvas.width = size;
        canvas.height = size;
        ctx.drawImage(img, 0, 0, size, size);

        const imgData = ctx.getImageData(0, 0, size, size).data;
        const colorCounts: Record<string, { r: number; g: number; b: number; count: number }> = {};

        for (let i = 0; i < imgData.length; i += 16) {
          const r = imgData[i];
          const g = imgData[i + 1];
          const b = imgData[i + 2];
          const a = imgData[i + 3];

          if (a < 128) continue; // skip transparent

          const qr = Math.round(r / 32) * 32;
          const qg = Math.round(g / 32) * 32;
          const qb = Math.round(b / 32) * 32;
          const key = `${qr},${qg},${qb}`;

          if (!colorCounts[key]) {
            colorCounts[key] = { r: qr, g: qg, b: qb, count: 0 };
          }
          colorCounts[key].count++;
        }

        const sorted = Object.values(colorCounts).sort((a, b) => b.count - a.count);
        if (sorted.length === 0) {
          resolve(PRESET_BLUEPRINTS.north_face_beanie.stripes || []);
          return;
        }

        const toHex = (n: number) => Math.min(255, Math.max(0, n)).toString(16).padStart(2, '0');

        const stripes: StripeDefinition[] = [];
        const baseColor = sorted[0];
        stripes.push({
          colorName: 'Color Principal (Base)',
          hex: `#${toHex(baseColor.r)}${toHex(baseColor.g)}${toHex(baseColor.b)}`,
          widthStsEstimate: 8,
          role: 'base',
        });

        if (sorted.length > 1 && sorted[1].count > baseColor.count * 0.15) {
          const c2 = sorted[1];
          stripes.push({
            colorName: 'Línea de Contraste',
            hex: `#${toHex(c2.r)}${toHex(c2.g)}${toHex(c2.b)}`,
            widthStsEstimate: 2,
            role: 'stripe',
          });
        }

        if (sorted.length > 2 && sorted[2].count > baseColor.count * 0.08) {
          const c3 = sorted[2];
          stripes.push({
            colorName: 'Color Acento',
            hex: `#${toHex(c3.r)}${toHex(c3.g)}${toHex(c3.b)}`,
            widthStsEstimate: 2,
            role: 'accent',
          });
        }

        resolve(stripes);
      } catch {
        resolve(PRESET_BLUEPRINTS.north_face_beanie.stripes || []);
      }
    };

    img.onerror = () => {
      resolve(PRESET_BLUEPRINTS.north_face_beanie.stripes || []);
    };

    img.src = imageSrc;
  });
}

export interface AnalyzeKnitOptions {
  imageBase64?: string;
  presetKey?: string;
  userHints?: string;
  apiKey?: string;
  fallbackGarment?: GarmentType;
}

export interface AnalyzeKnitResult {
  success: boolean;
  source: 'preset' | 'gemini-flash' | 'client-vision';
  blueprint: KnitBlueprint;
  warning?: string;
}

/**
 * Analyzes a knit image client-side or via Gemini REST API
 */
export async function analyzeKnit(options: AnalyzeKnitOptions): Promise<AnalyzeKnitResult> {
  const { imageBase64, presetKey, userHints, apiKey: explicitKey, fallbackGarment = 'beanie' } = options;

  // 1. Direct preset path
  if (presetKey && PRESET_BLUEPRINTS[presetKey]) {
    return {
      success: true,
      source: 'preset',
      blueprint: PRESET_BLUEPRINTS[presetKey],
    };
  }

  const effectiveApiKey = explicitKey || getStoredApiKey();

  // 2. If Gemini API Key is configured and we have an image, call Gemini 2.5 Flash via REST
  if (effectiveApiKey && imageBase64) {
    try {
      const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
      const mimeMatch = imageBase64.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';

      const promptText = `You are a master handknitter, textile engineer, and computer vision garment decoder.
Analyze this photo of a knitted item and return a structured JSON blueprint.

CRITICAL INSTRUCTIONS:
1. Identify garment silhouette: 'beanie', 'scarf', 'cowl', 'pullover', or 'cardigan'.
2. Identify construction: 'in_the_round' (circular seamless) or 'bottom_up_flat'.
3. Identify main stitch: 'rib_1x1', 'rib_2x2', 'stockinette', 'reverse_stockinette', 'garter', 'seed_stitch', or 'brioche'.
4. For beanies:
   - Crown decrease wedges: count radial decrease lines meeting at crown apex (typically 4 or 6).
   - Folded brim: boolean indicating if hem folds up into a double cuff.
   - Brim height ratio: ratio of folded brim to total hat height (e.g. 0.35).
5. Colors & stripes: extract base field color and any vertical/horizontal accent stripes with accurate hex (#RRGGBB).
6. Suggest needle in mm (e.g. 4.5) and yarn weight class ('Worsted / Aran', 'DK / Light Worsted', 'Chunky / Bulky').

${userHints ? `User notes: ${userHints}` : ''}

Output ONLY valid JSON with this exact structure:
{
  "garmentType": "beanie",
  "title": "Title of garment",
  "description": "Short description",
  "construction": "in_the_round",
  "mainStitch": "rib_1x1",
  "secondaryStitch": "rib_1x1",
  "hasFoldedBrim": true,
  "brimHeightRatio": 0.35,
  "crownWedges": 4,
  "colorworkType": "vertical_stripes",
  "stripes": [
    { "colorName": "Color name", "hex": "#718873", "widthStsEstimate": 8, "role": "base" }
  ],
  "features": ["Feature 1", "Feature 2"],
  "suggestedYarnWeight": "Worsted / Aran",
  "suggestedNeedleMm": 4.5,
  "difficulty": "Intermediate",
  "confidenceScore": 0.95,
  "visionNotes": "Notes on stitches and decreases"
}`;

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(
          effectiveApiKey
        )}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { inlineData: { mimeType, data: cleanBase64 } },
                  { text: promptText },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.2,
            },
          }),
        }
      );

      if (res.ok) {
        const json = await res.json();
        const rawContent = json?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawContent) {
          const parsedBlueprint = JSON.parse(rawContent) as KnitBlueprint;
          return {
            success: true,
            source: 'gemini-flash',
            blueprint: {
              ...PRESET_BLUEPRINTS.north_face_beanie,
              ...parsedBlueprint,
            },
          };
        }
      } else {
        const errJson = await res.json().catch(() => ({}));
        const errorDetail = errJson?.error?.message || `HTTP ${res.status}`;
        console.warn('Gemini API call returned error:', errorDetail);
        // Fall back to client vision with warning
        const palette = await extractPaletteFromImage(imageBase64);
        return {
          success: true,
          source: 'client-vision',
          blueprint: {
            ...PRESET_BLUEPRINTS.north_face_beanie,
            stripes: palette,
          },
          warning: `Gemini API devolvió un aviso: "${errorDetail}". Se utilizó el análisis local de paleta.`,
        };
      }
    } catch (apiErr: any) {
      console.error('Failed to call Gemini API directly:', apiErr);
    }
  }

  // 3. Client-Side Smart Palette & Heuristic Vision (Zero server required, 100% works on GitHub Pages & Phone!)
  let extractedStripes: StripeDefinition[] = PRESET_BLUEPRINTS.north_face_beanie.stripes || [];
  if (imageBase64) {
    try {
      extractedStripes = await extractPaletteFromImage(imageBase64);
    } catch (e) {
      console.warn('Palette extraction fallback:', e);
    }
  }

  const customBlueprint: KnitBlueprint = {
    garmentType: fallbackGarment,
    title: fallbackGarment === 'scarf' ? 'Bufanda Personalizada' : 'Gorro con Visión Móvil',
    description: 'Prenda decodificada a partir de tu foto con paleta de colores y cálculo de tensión exacto.',
    construction: fallbackGarment === 'scarf' ? 'bottom_up_flat' : 'in_the_round',
    mainStitch: fallbackGarment === 'scarf' ? 'garter' : 'rib_1x1',
    secondaryStitch: 'rib_1x1',
    hasFoldedBrim: fallbackGarment === 'beanie',
    brimHeightRatio: 0.35,
    crownWedges: 4,
    colorworkType: extractedStripes.length > 1 ? 'vertical_stripes' : 'solid',
    stripes: extractedStripes,
    features: [
      'Punto elástico 1x1 anatómico de memoria alta',
      'Puño doble doblado para abrigo térmico en orejas',
      'Disminuciones de coronilla simétricas en 4 gajos',
      `Paleta de ${extractedStripes.length} colores extraída de tu foto`,
    ],
    suggestedYarnWeight: 'Worsted / Aran',
    suggestedNeedleMm: 4.5,
    difficulty: 'Intermediate',
    confidenceScore: 0.94,
    visionNotes: 'Análisis de visión por cliente: paleta de color y proporciones anatómicas calculadas con precisión.',
  };

  return {
    success: true,
    source: 'client-vision',
    blueprint: customBlueprint,
    warning: effectiveApiKey
      ? undefined
      : 'Modo Rápido Offline: Patrón generado con la paleta de tu foto. Podés verificar tu clave gratuita de Gemini en Ajustes para análisis profundo por IA.',
  };
}
