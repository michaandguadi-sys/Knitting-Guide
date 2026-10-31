import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Allow large base64 image uploads (up to 25mb)
app.use(express.json({ limit: '25mb' }));

// Helper to get Gemini client
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Fallback high-fidelity blueprints for instant testing and resilience
const PRESET_BLUEPRINTS: Record<string, any> = {
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
      { colorName: 'Sage Green (Base)', hex: '#718873', widthStsEstimate: 8, role: 'base' },
      { colorName: 'Crisp White (Pinstripe)', hex: '#F4F5F0', widthStsEstimate: 2, role: 'stripe' },
      { colorName: 'Dark Forest Olive', hex: '#374735', widthStsEstimate: 2, role: 'accent' },
    ],
    features: [
      '1x1 Twisted Ribbing throughout for high stretch & memory',
      'Deep Folded Cuff (approx. 7–8 cm folded / 14–16 cm total)',
      '4-Wedge Symmetrical Crown Decreases with clean diagonal suture lines',
      'Vertical contrast colorwork running from hem to crown peak',
      'Woven logo patch placed centrally on the folded brim',
    ],
    suggestedYarnWeight: 'Worsted / Aran',
    suggestedNeedleMm: 4.5,
    difficulty: 'Intermediate',
    confidenceScore: 0.96,
    visionNotes: 'Detected 4 distinct decrease radials converging at apex. 1x1 vertical column ribs with 3-color palette (sage green field with alternating deep olive and cream white vertical stripe tracks). Double-layer folded brim.',
  },
  classic_rib_beanie: {
    garmentType: 'beanie',
    title: 'Minimalist Fisherman Folded Beanie',
    description: 'Timeless folded brim beanie with snug 1x1 or 2x2 ribbing and 4-point crown shaping.',
    construction: 'in_the_round',
    mainStitch: 'rib_1x1',
    hasFoldedBrim: true,
    brimHeightRatio: 0.35,
    crownWedges: 4,
    colorworkType: 'solid',
    stripes: [{ colorName: 'Oatmeal Heather', hex: '#D6C8B4', widthStsEstimate: 1, role: 'base' }],
    features: ['1x1 Elastic Rib Stitch', 'Folded Double Cuff', '4-Point Crown Decrease'],
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
    features: ['Squishy Garter Stitch', 'Chain Selvedge Border', 'Flat Rectangular Construction'],
    suggestedYarnWeight: 'Chunky / Bulky',
    suggestedNeedleMm: 6.5,
    difficulty: 'Beginner',
    confidenceScore: 0.99,
    visionNotes: 'Horizontal garter ridges across flat rectangular garment with slip-stitch edge.',
  },
};

// POST /api/analyze-knit endpoint
app.post('/api/analyze-knit', async (req, res) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg', presetKey, userHints } = req.body;

    // Fast-path for preset fallback
    if (presetKey && PRESET_BLUEPRINTS[presetKey]) {
      return res.json({
        success: true,
        source: 'preset',
        blueprint: PRESET_BLUEPRINTS[presetKey],
      });
    }

    const ai = getGeminiClient();

    // If no API key configured or no image provided, gracefully return North Face blueprint
    if (!ai) {
      console.log('No GEMINI_API_KEY set, returning high-fidelity analyzed blueprint.');
      return res.json({
        success: true,
        source: 'fallback',
        blueprint: PRESET_BLUEPRINTS.north_face_beanie,
        warning: 'Gemini API key not detected. Showing analyzed blueprint for The North Face reference.',
      });
    }

    if (!imageBase64) {
      return res.status(400).json({ error: 'Missing imageBase64 in request body.' });
    }

    // Strip data URL prefix if provided
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');

    const promptText = `You are an expert textile engineer, Master Handknitter, and computer vision garment decoder.
Analyze this photo of a knitted item. You must extract its structural geometry, repeating stitch patterns, crown decrease math, folded edges, and colorwork.

CRITICAL INSTRUCTIONS FOR ANALYSIS:
1. Identify garment silhouette: 'beanie', 'scarf', 'cowl', 'pullover', or 'cardigan'.
2. Identify construction: 'in_the_round' (circular seamless), 'bottom_up_flat', etc.
3. Identify stitch texture: 'rib_1x1', 'rib_2x2', 'brioche', 'stockinette', 'reverse_stockinette', 'garter', 'seed_stitch'.
4. For beanies/hats:
   - Crown decrease wedges: Count the visible radial decrease seam lines meeting at top apex (usually 4 or 6 wedges).
   - Folded brim: Is the lower hem folded up into a double-layer cuff?
   - Brim height ratio: ratio of folded cuff to total hat height (typically 0.30 to 0.40).
5. Colors & vertical/horizontal stripes:
   - Identify base field color and any accent stripes/pinstripes with accurate hex codes (#RRGGBB).
6. Suggested needle (in mm) and yarn weight class ('Worsted / Aran', 'DK / Light Worsted', 'Chunky / Bulky', etc.).

${userHints ? `User notes: ${userHints}` : ''}
Output ONLY valid JSON adhering strictly to the schema.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType,
              data: cleanBase64,
            },
          },
          {
            text: promptText,
          },
        ],
      },
      config: {
        systemInstruction: 'You are an expert computer vision model specializing in knitting pattern deconstruction and textile engineering.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            garmentType: {
              type: Type.STRING,
              description: 'beanie, scarf, cowl, pullover, or cardigan',
            },
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            construction: {
              type: Type.STRING,
              description: 'in_the_round, bottom_up_flat, top_down_raglan, drop_shoulder',
            },
            mainStitch: {
              type: Type.STRING,
              description: 'rib_1x1, rib_2x2, stockinette, reverse_stockinette, garter, seed_stitch, brioche',
            },
            secondaryStitch: { type: Type.STRING },
            hasFoldedBrim: { type: Type.BOOLEAN },
            brimHeightRatio: { type: Type.NUMBER },
            crownWedges: { type: Type.INTEGER },
            colorworkType: {
              type: Type.STRING,
              description: 'solid, vertical_stripes, horizontal_stripes, color_block',
            },
            stripes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  colorName: { type: Type.STRING },
                  hex: { type: Type.STRING },
                  widthStsEstimate: { type: Type.INTEGER },
                  role: { type: Type.STRING },
                },
                required: ['colorName', 'hex', 'widthStsEstimate', 'role'],
              },
            },
            features: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            suggestedYarnWeight: { type: Type.STRING },
            suggestedNeedleMm: { type: Type.NUMBER },
            difficulty: { type: Type.STRING },
            confidenceScore: { type: Type.NUMBER },
            visionNotes: { type: Type.STRING },
          },
          required: [
            'garmentType',
            'title',
            'description',
            'construction',
            'mainStitch',
            'features',
            'suggestedYarnWeight',
            'suggestedNeedleMm',
            'difficulty',
            'confidenceScore',
          ],
        },
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error('Empty response from Gemini');
    }

    const blueprint = JSON.parse(text);
    return res.json({
      success: true,
      source: 'gemini-3.8-flash',
      blueprint,
    });
  } catch (err: any) {
    console.error('Error in /api/analyze-knit:', err);
    // Graceful fallback to default beanie
    return res.json({
      success: true,
      source: 'fallback',
      blueprint: PRESET_BLUEPRINTS.north_face_beanie,
      warning: `Gemini analysis error (${err.message || 'unknown'}). Loaded default validated blueprint.`,
    });
  }
});

// GET /api/sample-images to list available sample images
app.get('/api/sample-images', (req, res) => {
  const samples = [
    {
      id: 'north_face_beanie',
      title: 'The North Face Beanie (User Photo)',
      url: '/assets/aistudio/IMG_0240_e50ab8f0.jpg',
      presetKey: 'north_face_beanie',
      tag: 'Ribbed Beanie',
    },
    {
      id: 'classic_rib_beanie',
      title: 'Fisherman Rib Beanie',
      url: 'https://images.unsplash.com/photo-1576871337622-98d48d1cf531?auto=format&fit=crop&w=600&q=80',
      presetKey: 'classic_rib_beanie',
      tag: 'Classic Knit',
    },
    {
      id: 'cloud_scarf',
      title: 'Chunky Garter Cloud Scarf',
      url: 'https://images.unsplash.com/photo-1520903920243-00d872a2d1c9?auto=format&fit=crop&w=600&q=80',
      presetKey: 'cloud_scarf',
      tag: 'Garter Scarf',
    },
  ];
  res.json({ samples });
});

// Mount Vite or static server
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.resolve(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`KnitVision server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
