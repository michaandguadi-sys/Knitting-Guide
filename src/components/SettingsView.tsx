import React, { useState } from 'react';
import {
  Globe,
  Ruler,
  RotateCcw,
  BookOpen,
  Check,
  Key,
  Smartphone,
  Eye,
  EyeOff,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  FlaskConical,
} from 'lucide-react';
import { KnitUserConstraints } from '../types/knit';
import { Language } from '../i18n/translations';
import {
  getStoredApiKey,
  setStoredApiKey,
  isApiKeyVerified,
  verifyGeminiApiKey,
  KeyVerificationResult,
} from '../utils/aiAnalyzer';

interface SettingsViewProps {
  constraints: KnitUserConstraints;
  onUpdateConstraints: (updated: KnitUserConstraints) => void;
  lang: Language;
  onToggleLang: () => void;
  onOpenCraftNotes: () => void;
  onResetAll: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  constraints,
  onUpdateConstraints,
  lang,
  onToggleLang,
  onOpenCraftNotes,
  onResetAll,
}) => {
  const isEs = lang === 'es';
  const [apiKey, setApiKey] = useState(getStoredApiKey());
  const [showKey, setShowKey] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<KeyVerificationResult | null>(() => {
    if (getStoredApiKey() && isApiKeyVerified()) {
      return {
        valid: true,
        message: '✓ Clave guardada y verificada anteriormente con Google Gemini 2.5 Flash.',
        model: 'gemini-2.5-flash',
      };
    }
    return null;
  });

  const handleVerifyAndSave = async () => {
    if (!apiKey.trim()) {
      setStoredApiKey('');
      setVerificationResult({
        valid: false,
        message: isEs ? 'Ingresá una clave antes de verificar.' : 'Please enter an API key to test.',
      });
      return;
    }

    setIsVerifying(true);
    setVerificationResult(null);

    try {
      const result = await verifyGeminiApiKey(apiKey.trim());
      setVerificationResult(result);
    } catch (err: any) {
      setVerificationResult({
        valid: false,
        message: err.message || 'Error inesperado durante la verificación.',
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleClearApiKey = () => {
    setApiKey('');
    setStoredApiKey('');
    setVerificationResult(null);
  };

  return (
    <div className="bg-white rounded-3xl border border-[#E8E3DC] shadow-xs p-4 sm:p-8 space-y-6 max-w-3xl mx-auto">
      <div className="border-b border-[#F0ECE6] pb-3">
        <h2 className="text-xl sm:text-2xl font-black text-[#1F2421]">
          {isEs ? 'Ajustes y Preferencias' : 'Settings & Preferences'}
        </h2>
        <p className="text-xs sm:text-sm text-[#6F756F] mt-1">
          {isEs
            ? 'Personalizá el idioma, tu muestra de tensión y verificá tu clave de Google Gemini.'
            : 'Customize language, tension gauge, and test your Google Gemini API key.'}
        </p>
      </div>

      {/* 1. Language Setting */}
      <div className="bg-[#FAF8F5] p-4 sm:p-5 rounded-2xl border border-[#E8E3DC] space-y-3">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-[#2D5A43]" />
          <h3 className="text-sm font-bold text-[#1F2421]">
            {isEs ? 'Idioma del Patrón y la App' : 'App & Pattern Language'}
          </h3>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            type="button"
            onClick={() => {
              if (lang !== 'es') onToggleLang();
            }}
            className={`p-3 rounded-2xl border text-left flex items-center justify-between transition cursor-pointer active:scale-95 touch-manipulation ${
              lang === 'es'
                ? 'bg-[#EBF2EE] border-[#2D5A43] ring-1 ring-[#2D5A43]'
                : 'bg-white border-[#DDD7CD] hover:bg-[#F3EFEA]'
            }`}
          >
            <div>
              <div className="font-bold text-xs sm:text-sm text-[#1F2421]">🇦🇷 Español</div>
              <div className="text-[11px] text-[#6F756F]">Terminología argentina</div>
            </div>
            {lang === 'es' && <Check className="w-4 h-4 text-[#2D5A43]" />}
          </button>

          <button
            type="button"
            onClick={() => {
              if (lang !== 'en') onToggleLang();
            }}
            className={`p-3 rounded-2xl border text-left flex items-center justify-between transition cursor-pointer active:scale-95 touch-manipulation ${
              lang === 'en'
                ? 'bg-[#EBF2EE] border-[#2D5A43] ring-1 ring-[#2D5A43]'
                : 'bg-white border-[#DDD7CD] hover:bg-[#F3EFEA]'
            }`}
          >
            <div>
              <div className="font-bold text-xs sm:text-sm text-[#1F2421]">🇬🇧 English</div>
              <div className="text-[11px] text-[#6F756F]">Standard CYC notation</div>
            </div>
            {lang === 'en' && <Check className="w-4 h-4 text-[#2D5A43]" />}
          </button>
        </div>
      </div>

      {/* 2. Google Gemini AI Key with Active Verification */}
      <div className="bg-[#FAF8F5] p-4 sm:p-5 rounded-2xl border border-[#E8E3DC] space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-[#2D5A43]" />
            <h3 className="text-sm font-bold text-[#1F2421]">
              {isEs ? 'Clave de Google Gemini y Verificación' : 'Google Gemini API Key & Verification'}
            </h3>
          </div>

          {/* Active status pill */}
          {verificationResult?.valid ? (
            <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>{isEs ? 'Conexión Activa y Verificada' : 'Connected & Verified'}</span>
            </span>
          ) : apiKey ? (
            <span className="text-[11px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <span>{isEs ? 'Sin Verificar' : 'Unverified'}</span>
            </span>
          ) : (
            <span className="text-[11px] font-bold text-[#6F756F] bg-[#EFECE6] px-2.5 py-0.5 rounded-full">
              {isEs ? 'Modo Rápido Offline' : 'Fast Offline Mode'}
            </span>
          )}
        </div>

        <p className="text-xs text-[#6F756F] leading-relaxed">
          {isEs
            ? 'Para verificar que tu clave de Gemini realmente funciona, ingresala abajo y tocá "Verificar y Guardar". Haremos una llamada de prueba directa a Google AI Studio para confirmar que tu cuota y permisos están activos.'
            : 'To verify your Gemini key is working, enter it below and tap "Verify & Save". We will make a live ping call to Google AI Studio to confirm your quota and permissions.'}
        </p>

        {/* Input box */}
        <div className="space-y-3">
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              placeholder="AIzaSy..."
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setVerificationResult(null);
              }}
              className="w-full text-xs sm:text-sm font-mono p-3 pr-10 bg-white border border-[#DDD7CD] rounded-xl focus:outline-[#2D5A43] shadow-2xs"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6F756F] hover:text-[#1F2421] p-1 cursor-pointer"
              title={showKey ? 'Ocultar' : 'Mostrar'}
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleVerifyAndSave}
              disabled={isVerifying}
              className="flex-1 sm:flex-none px-5 py-2.5 bg-[#2D5A43] hover:bg-[#234734] disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 active:scale-95 cursor-pointer touch-manipulation min-h-[42px] shadow-xs"
            >
              {isVerifying ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>{isEs ? 'Verificando con Google...' : 'Testing with Google...'}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>{isEs ? 'Verificar y Guardar' : 'Verify & Save'}</span>
                </>
              )}
            </button>

            {apiKey && (
              <button
                type="button"
                onClick={handleClearApiKey}
                className="px-4 py-2.5 bg-white border border-[#DDD7CD] text-[#6F756F] hover:text-red-600 rounded-xl text-xs font-semibold transition active:scale-95 cursor-pointer touch-manipulation min-h-[42px]"
              >
                {isEs ? 'Borrar Clave' : 'Clear Key'}
              </button>
            )}
          </div>
        </div>

        {/* Live Verification Feedback Card */}
        {verificationResult && (
          <div
            className={`p-3.5 rounded-2xl border flex items-start gap-3 animate-in fade-in ${
              verificationResult.valid
                ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
                : 'bg-red-50/80 border-red-300 text-red-950'
            }`}
          >
            {verificationResult.valid ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <div className="text-xs sm:text-sm font-bold">
                {verificationResult.valid
                  ? (isEs ? '¡Clave Verificada y Funcionando!' : 'Key Verified & Active!')
                  : (isEs ? 'Error en la verificación de la clave' : 'API Key Verification Failed')}
              </div>
              <p className="text-xs leading-relaxed opacity-90">
                {verificationResult.message}
              </p>
              {verificationResult.latencyMs && (
                <div className="text-[11px] opacity-75 font-mono">
                  {isEs ? 'Latencia del servidor:' : 'Server latency:'} {verificationResult.latencyMs} ms • Modelo: {verificationResult.model}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Info & Free Key Link */}
        <div className="pt-1 text-[11px] text-[#6F756F] space-y-1">
          <div>
            🔒 {isEs
              ? 'Tu clave se almacena de forma 100% privada en tu dispositivo y nunca pasa por un servidor externo.'
              : 'Your key is saved 100% privately in your browser and never touches an external server.'}
          </div>
          <div>
            {isEs ? '¿No tenés una clave de Gemini? Creá una gratis en ' : 'Need a Gemini key? Create one for free at '}
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#2D5A43] font-bold underline"
            >
              Google AI Studio
            </a>
          </div>
        </div>
      </div>

      {/* 3. Swatch Gauge Calibrator */}
      <div className="bg-[#FAF8F5] p-4 sm:p-5 rounded-2xl border border-[#E8E3DC] space-y-4">
        <div className="flex items-center gap-2">
          <Ruler className="w-4 h-4 text-[#2D5A43]" />
          <h3 className="text-sm font-bold text-[#1F2421]">
            {isEs ? 'Muestra de Tensión (10 x 10 cm)' : 'Gauge Swatch (10 x 10 cm)'}
          </h3>
        </div>
        <p className="text-xs text-[#6F756F]">
          {isEs
            ? 'Si tu mano teje más apretado o más flojo que el estándar (18 p / 24 vtas en 10 cm), ajustá acá para que el cálculo matemático sea exacto para tus medidas.'
            : 'If your tension differs from standard (18 sts / 24 rows in 10 cm), adjust here so calculations match your personal gauge.'}
        </p>

        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#4A504A] mb-1">
              {isEs ? 'Puntos en 10 cm' : 'Stitches in 10 cm'}
            </label>
            <input
              type="number"
              step="0.5"
              value={constraints.gaugeSts10cm}
              onChange={(e) =>
                onUpdateConstraints({
                  ...constraints,
                  gaugeSts10cm: parseFloat(e.target.value) || 18,
                })
              }
              className="w-full text-sm font-bold p-2.5 bg-white border border-[#DDD7CD] rounded-xl focus:outline-[#2D5A43]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#4A504A] mb-1">
              {isEs ? 'Vueltas en 10 cm' : 'Rows in 10 cm'}
            </label>
            <input
              type="number"
              step="0.5"
              value={constraints.gaugeRows10cm}
              onChange={(e) =>
                onUpdateConstraints({
                  ...constraints,
                  gaugeRows10cm: parseFloat(e.target.value) || 24,
                })
              }
              className="w-full text-sm font-bold p-2.5 bg-white border border-[#DDD7CD] rounded-xl focus:outline-[#2D5A43]"
            />
          </div>
        </div>
      </div>

      {/* 4. Phone Install / PWA instructions */}
      <div className="p-4 rounded-2xl bg-[#F4F6F5] border border-[#D5E3DC] space-y-2">
        <div className="flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-[#2D5A43]" />
          <h4 className="text-xs sm:text-sm font-bold text-[#1F2421]">
            {isEs ? '¿Cómo usar en tu teléfono como App nativa?' : 'How to install on your phone as a native app?'}
          </h4>
        </div>
        <p className="text-xs text-[#4A504A] leading-relaxed">
          {isEs
            ? '📱 En iPhone (Safari): Tocá el botón "Compartir" (ícono del cuadrado con flecha hacia arriba) y elegí "Agregar a pantalla de inicio".'
            : '📱 On iPhone (Safari): Tap the "Share" button and select "Add to Home Screen".'}
        </p>
        <p className="text-xs text-[#4A504A] leading-relaxed">
          {isEs
            ? '🤖 En Android (Chrome): Tocá los 3 puntos del menú y seleccioná "Instalar aplicación" o "Agregar a la pantalla principal".'
            : '🤖 On Android (Chrome): Tap the 3 dots menu and select "Install app" or "Add to Home Screen".'}
        </p>
      </div>

      {/* 5. Craft Notes & Deep Reference */}
      <div className="p-4 rounded-2xl bg-[#E4ECE7] border border-[#CDE1D4] flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <BookOpen className="w-5 h-5 text-[#2D5A43] flex-shrink-0" />
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-[#1F2421]">
              {isEs ? 'Guía para la Maestra Tejedora y Fuentes' : 'Master Knitter Guide & Citations'}
            </h4>
            <p className="text-[11px] text-[#2D5A43]">
              {isEs
                ? 'Explicaciones sobre disminuciones, elasticidad del punto y citas académicas.'
                : 'Explanations on decreases, ribbing elasticity, and MIT research.'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onOpenCraftNotes}
          className="px-3.5 py-2 bg-[#2D5A43] hover:bg-[#234734] text-white rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer whitespace-nowrap min-h-[38px]"
        >
          {isEs ? 'Abrir Guía' : 'Open Guide'}
        </button>
      </div>

      {/* 6. Reset App Data */}
      <div className="pt-2 border-t border-[#F0ECE6] flex items-center justify-between">
        <span className="text-xs text-[#6F756F]">
          {isEs ? '¿Querés volver al gorro original?' : 'Reset to default project?'}
        </span>
        <button
          type="button"
          onClick={onResetAll}
          className="px-3 py-1.5 rounded-xl border border-[#DDD7CD] text-xs font-semibold text-[#6F756F] hover:text-[#1F2421] hover:bg-[#FAF8F5] transition flex items-center gap-1.5 active:scale-95 cursor-pointer min-h-[36px]"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>{isEs ? 'Reiniciar todo' : 'Reset all'}</span>
        </button>
      </div>
    </div>
  );
};
