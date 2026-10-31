import React from 'react';
import {
  Layers,
  Cpu,
  Calculator,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';

export const ArchitectureView: React.FC = () => {
  return (
    <div className="bg-white rounded-2xl border border-[#E8E3DC] shadow-xs p-6 sm:p-8 space-y-8">
      {/* Title */}
      <div className="border-b border-[#F0ECE6] pb-4">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#2D5A43]">
          System Architecture & Engineering Specification
        </span>
        <h2 className="text-2xl font-black text-[#1F2421] tracking-tight mt-1">
          Two-Pipeline Engineering: Vision Decoder + Generative Math
        </h2>
        <p className="text-sm text-[#6F756F] mt-1 max-w-3xl">
          Why base LLMs fail at knitting patterns, and how the decoupled InverseKnit-style pipeline guarantees 100% mathematical stitch conservation.
        </p>
      </div>

      {/* 2-Pipeline Flow Diagram */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pipeline 1 */}
        <div className="bg-[#FAF8F5] p-5 rounded-xl border border-[#E8E3DC] space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-[#2D5A43] text-white flex items-center justify-center font-bold text-xs">
              1
            </span>
            <h3 className="text-base font-bold text-[#1F2421]">
              Pipeline 1: Computer Vision ("The Decoder")
            </h3>
          </div>
          <p className="text-xs text-[#6F756F] leading-relaxed">
            Extracts structural classification, construction style, repeating stitch textures, and crown shaping geometry.
          </p>

          <div className="bg-white p-3.5 rounded-lg border border-[#DDD7CD] space-y-2 text-xs">
            <div className="font-semibold text-[#1F2421]">Feature Extraction Nodes:</div>
            <ul className="space-y-1 text-[#4A504A] list-disc list-inside">
              <li><strong>Silhouette:</strong> Beanie vs Scarf vs Pullover</li>
              <li><strong>Construction:</strong> In-the-round vs flat, bottom-up vs top-down</li>
              <li><strong>Stitch Parsing:</strong> 1x1 / 2x2 Ribbing, Brioche, Stockinette, Garter</li>
              <li><strong>Crown Decreases:</strong> Radial wedge count (4 vs 6 wedges)</li>
              <li><strong>Brim Horizon:</strong> Folded cuff detection & proportional height ratio</li>
              <li><strong>Color Matrix:</strong> Pinstripe & accent color hex isolation</li>
            </ul>
          </div>

          <div className="p-3 bg-[#E4ECE7] text-[#2D5A43] rounded-lg text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>Output: Strictly Validated JSON Blueprint (No Free-Text Math)</span>
          </div>
        </div>

        {/* Pipeline 2 */}
        <div className="bg-[#FAF8F5] p-5 rounded-xl border border-[#E8E3DC] space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-[#1C3A2B] text-white flex items-center justify-center font-bold text-xs">
              2
            </span>
            <h3 className="text-base font-bold text-[#1F2421]">
              Pipeline 2: Generative Math Engine ("The Compiler")
            </h3>
          </div>
          <p className="text-xs text-[#6F756F] leading-relaxed">
            Deterministic TypeScript / Python algorithms that enforce exact stitch repeat divisible numbers and decrease lines.
          </p>

          <div className="bg-white p-3.5 rounded-lg border border-[#DDD7CD] space-y-2 text-xs">
            <div className="font-semibold text-[#1F2421]">Deterministic Transformations:</div>
            <ul className="space-y-1 text-[#4A504A] list-disc list-inside font-mono text-[11px]">
              <li><strong>Scaling:</strong> Gx = sts/10, Gy = rows/10</li>
              <li><strong>Divisibility:</strong> S = roundToMultiple(target * Gx, lcm(repeat, 2 * Wedges))</li>
              <li><strong>Symmetry:</strong> Equal decrease distribution per round (2 * W sts/round)</li>
              <li><strong>Zero Hallucinations:</strong> Verified row-by-row state conservation</li>
              <li><strong>Yarn Calculation:</strong> Garment surface area * fabric density (g/cm²)</li>
            </ul>
          </div>

          <div className="p-3 bg-[#E4ECE7] text-[#2D5A43] rounded-lg text-xs font-semibold flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 flex-shrink-0" />
            <span>Result: 100% Workable, Tested, Gauge-Calibrated Pattern</span>
          </div>
        </div>
      </div>

      {/* The Product Moat / Competitive Matrix */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-[#1F2421] flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-[#2D5A43]" />
          Market Mapping & Competitive Moat
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border border-[#E8E3DC] rounded-xl overflow-hidden">
            <thead className="bg-[#FAF8F5] text-[#1F2421] font-bold border-b border-[#E8E3DC]">
              <tr>
                <th className="p-3">Platform</th>
                <th className="p-3">Input Method</th>
                <th className="p-3">Primary Output</th>
                <th className="p-3">Limitation / Weakness</th>
                <th className="p-3">KnitVision Advantage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0ECE6]">
              <tr>
                <td className="p-3 font-semibold text-[#1F2421]">La Maille</td>
                <td className="p-3">Photo upload</td>
                <td className="p-3">Row-by-row pattern</td>
                <td className="p-3 text-[#B45309]">Limited custom gauge recalculations</td>
                <td className="p-3 font-medium text-[#2D5A43]">Instant live gauge recalibration & swatch tuner</td>
              </tr>
              <tr>
                <td className="p-3 font-semibold text-[#1F2421]">Knittable AI</td>
                <td className="p-3">Text / Photo</td>
                <td className="p-3">Directions + symbols</td>
                <td className="p-3 text-[#B45309]">Locked behind paywall; LLM math hallucinations</td>
                <td className="p-3 font-medium text-[#2D5A43]">Pure deterministic TypeScript math (0 hallucinations)</td>
              </tr>
              <tr>
                <td className="p-3 font-semibold text-[#1F2421]">Stitch Fiddle</td>
                <td className="p-3">Photo / Pixel map</td>
                <td className="p-3">2D color pixel chart</td>
                <td className="p-3 text-[#B45309]">No garment construction, no crown/raglan shaping</td>
                <td className="p-3 font-medium text-[#2D5A43]">Full 3D shaping: crown decreases, folded cuffs, raglans</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
