import React, { useRef, useState } from 'react';
import {
  Upload,
  Image as ImageIcon,
  Sparkles,
  ChevronRight,
  Eye,
  CheckCircle2,
} from 'lucide-react';
import { KnitBlueprint } from '../types/knit';
import { Language, TRANSLATIONS } from '../i18n/translations';

interface PhotoUploadSectionProps {
  currentImage: string | null;
  onImageSelected: (base64OrUrl: string, presetKey?: string) => void;
  onAnalyze: (userHints?: string) => void;
  isAnalyzing: boolean;
  blueprint: KnitBlueprint | null;
  lang: Language;
}

export const PhotoUploadSection: React.FC<PhotoUploadSectionProps> = ({
  currentImage,
  onImageSelected,
  onAnalyze,
  isAnalyzing,
  blueprint,
  lang,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [userHints, setUserHints] = useState('');
  const [showOverlays, setShowOverlays] = useState(true);
  const t = TRANSLATIONS[lang];

  // Default sample image from the user's attachment
  const sampleNorthFacePath = '/assets/aistudio/IMG_0240_e50ab8f0.jpg';

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        onImageSelected(result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        if (result) {
          onImageSelected(result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-[#E8E3DC] shadow-xs p-4 sm:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#F0ECE6] pb-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[#2D5A43]">
            {t.step1Tag}
          </span>
          <h2 className="text-lg sm:text-xl font-bold text-[#1F2421]">
            {t.step1Title}
          </h2>
          <p className="text-xs text-[#6F756F]">
            {t.step1Subtitle}
          </p>
        </div>

        {/* Quick sample buttons (touch friendly) */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => onImageSelected(sampleNorthFacePath, 'north_face_beanie')}
            className={`px-3 py-2 rounded-xl text-xs font-medium border transition flex items-center gap-1.5 active:scale-95 ${
              currentImage === sampleNorthFacePath
                ? 'bg-[#EBF2EE] border-[#2D5A43] text-[#2D5A43] font-bold ring-1 ring-[#2D5A43]'
                : 'bg-[#FAF8F5] border-[#DDD7CD] text-[#4A504A] hover:bg-[#F3EFEA]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-[#2D5A43]" />
            <span>{t.sampleNorthFace}</span>
          </button>
          <button
            onClick={() =>
              onImageSelected(
                'https://images.unsplash.com/photo-1520903920243-00d872a2d1c9?auto=format&fit=crop&w=600&q=80',
                'cloud_scarf'
              )
            }
            className="px-3 py-2 rounded-xl text-xs font-medium bg-[#FAF8F5] border border-[#DDD7CD] text-[#4A504A] hover:bg-[#F3EFEA] transition active:scale-95"
          >
            {t.sampleScarf}
          </button>
        </div>
      </div>

      {/* Main Image Display / Dropzone */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left: Image Canvas with Structural Overlays */}
        <div className="lg:col-span-7">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="relative rounded-2xl overflow-hidden border border-[#E8E3DC] bg-[#F7F5F0] flex items-center justify-center min-h-[300px] sm:min-h-[360px] max-h-[420px]"
          >
            {currentImage ? (
              <div className="relative w-full h-full flex items-center justify-center">
                <img
                  src={currentImage}
                  alt="Garment to analyze"
                  className="max-h-[400px] w-auto object-contain mx-auto"
                />

                {/* Vision Keypoint Overlay Layer */}
                {blueprint && showOverlays && (
                  <div className="absolute inset-0 pointer-events-none">
                    {blueprint.garmentType === 'beanie' && (
                      <>
                        <div className="absolute top-[8%] left-[48%] -translate-x-1/2 bg-[#2D5A43]/90 text-white text-[10px] font-mono px-2 py-0.5 rounded-full shadow backdrop-blur-xs flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                          {lang === 'es' ? 'Vértice de Coronilla: 4 Gajos' : 'Crown Apex: 4 Wedges'}
                        </div>

                        {blueprint.hasFoldedBrim && (
                          <div className="absolute bottom-[20%] left-4 right-4 border-t-2 border-dashed border-[#D97706] pt-1">
                            <span className="bg-[#D97706]/90 text-white text-[10px] font-mono px-2 py-0.5 rounded-md shadow">
                              {lang === 'es' ? 'Línea de Doblez del Puño' : 'Folded Cuff Horizon'} (~{Math.round((blueprint.brimHeightRatio || 0.35) * 100)}%)
                            </span>
                          </div>
                        )}

                        <div className="absolute top-[48%] left-[20%] border border-[#2563EB] bg-[#2563EB]/15 rounded-md p-1 w-24">
                          <span className="text-[9px] font-mono text-[#1E40AF] bg-white/90 px-1 py-0.5 rounded block text-center font-bold">
                            {lang === 'es' ? 'Elástico 1x1' : '1x1 Rib'}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Overlay Toggle */}
                {blueprint && (
                  <button
                    onClick={() => setShowOverlays(!showOverlays)}
                    aria-label={showOverlays ? t.toggleKeypointsHide : t.toggleKeypointsShow}
                    className="absolute bottom-3 right-3 bg-white/95 hover:bg-white text-xs text-[#1F2421] px-3 py-1.5 rounded-xl shadow-xs border border-[#DDD7CD] flex items-center gap-1.5 transition active:scale-95"
                  >
                    <Eye className="w-3.5 h-3.5 text-[#2D5A43]" />
                    <span>{showOverlays ? t.toggleKeypointsHide : t.toggleKeypointsShow}</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="text-center p-8 space-y-3">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-[#EFECE6] flex items-center justify-center text-[#6F756F]">
                  <ImageIcon className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#1F2421]">
                    {lang === 'es' ? 'Tocá o arrastrá tu foto acá' : 'Tap or drop your photo here'}
                  </p>
                  <p className="text-xs text-[#6F756F]">JPG, PNG, WEBP</p>
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2.5 text-xs font-semibold text-[#2D5A43] bg-[#E4ECE7] hover:bg-[#D5E3DC] rounded-xl transition inline-flex items-center gap-2"
                >
                  <Upload className="w-3.5 h-3.5" />
                  {t.uploadDifferent}
                </button>
              </div>
            )}
          </div>

          {/* Action buttons below image */}
          <div className="mt-2.5 flex items-center justify-between">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs font-semibold text-[#2D5A43] hover:underline cursor-pointer flex items-center gap-1 py-1"
            >
              <Upload className="w-3.5 h-3.5" />
              {t.uploadDifferent}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            {currentImage && (
              <span className="text-[11px] text-[#6F756F] flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-[#2D5A43]" />
                {t.readyForAnalysis}
              </span>
            )}
          </div>
        </div>

        {/* Right: Analysis Controls & Vision Trigger */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-[#FAF8F5] rounded-2xl p-4 border border-[#E8E3DC] space-y-2.5">
            <label className="block text-xs font-semibold text-[#1F2421]">
              {t.notesLabel}
            </label>
            <input
              type="text"
              value={userHints}
              onChange={(e) => setUserHints(e.target.value)}
              placeholder={t.notesPlaceholder}
              className="w-full text-xs px-3 py-2.5 bg-white border border-[#DDD7CD] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2D5A43]"
            />
            <p className="text-[11px] text-[#6F756F] leading-relaxed">
              {t.notesTip}
            </p>
          </div>

          {/* Run Vision Button */}
          <button
            onClick={() => onAnalyze(userHints)}
            disabled={isAnalyzing}
            className={`w-full py-4 px-4 rounded-2xl font-bold text-sm text-white transition flex items-center justify-center gap-2 shadow-md active:scale-95 ${
              isAnalyzing
                ? 'bg-[#6F756F] cursor-wait'
                : 'bg-[#2D5A43] hover:bg-[#234734]'
            }`}
          >
            {isAnalyzing ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>{t.btnAnalyzing}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>{blueprint ? t.btnReanalyze : t.btnAnalyze}</span>
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
