import React, { useState } from 'react';
import { ZoomIn, ZoomOut, Info } from 'lucide-react';
import { ChartGrid, ChartCell } from '../types/knit';
import { Language, TRANSLATIONS } from '../i18n/translations';

interface StitchChartProps {
  chartData: ChartGrid;
  title: string;
  lang: Language;
}

export const StitchChart: React.FC<StitchChartProps> = ({ chartData, title, lang }) => {
  const [selectedCell, setSelectedCell] = useState<ChartCell | null>(null);
  const [zoomLevel, setZoomLevel] = useState<'normal' | 'large'>('normal');
  const t = TRANSLATIONS[lang];
  const isEs = lang === 'es';

  return (
    <div className="bg-white rounded-3xl border border-[#E8E3DC] shadow-xs p-4 sm:p-7 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#F0ECE6] pb-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[#2D5A43]">
            {t.chartTag}
          </span>
          <h3 className="text-xl sm:text-2xl font-bold text-[#1F2421]">
            {t.chartTitle}
          </h3>
          <p className="text-xs sm:text-sm text-[#6F756F]">
            {chartData.readingNote || t.chartSubtitle}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoomLevel(zoomLevel === 'normal' ? 'large' : 'normal')}
            className="px-3.5 py-2 text-xs font-semibold bg-[#FAF8F5] border border-[#DDD7CD] hover:bg-[#F3EFEA] rounded-xl transition flex items-center gap-1.5 active:scale-95"
          >
            {zoomLevel === 'normal' ? <ZoomIn className="w-3.5 h-3.5" /> : <ZoomOut className="w-3.5 h-3.5" />}
            <span>{zoomLevel === 'normal' ? t.enlargeGrid : t.normalGrid}</span>
          </button>
        </div>
      </div>

      {/* Selected Cell Inspector */}
      {selectedCell && (
        <div className="bg-[#FAF8F5] rounded-2xl p-4 border border-[#E8E3DC] flex items-center justify-between text-xs sm:text-sm animate-in fade-in">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-xl bg-[#2D5A43] text-white flex items-center justify-center font-mono font-bold text-sm">
              {selectedCell.symbol}
            </span>
            <div>
              <span className="font-bold text-[#1F2421]">
                {isEs ? 'Vuelta' : 'Row'} {selectedCell.row}, {isEs ? 'Punto' : 'St'} {selectedCell.col}: {selectedCell.name}
              </span>
              <span className="text-[#6F756F] block text-xs">
                {selectedCell.stitchType === 'ssk'
                  ? (isEs ? 'Surjete simple (deslizar 2 puntos, tejer juntos retorcidos / disminución hacia la izquierda)' : 'Slip, slip, knit (Left decrease)')
                  : selectedCell.stitchType === 'k2tog'
                  ? (isEs ? '2 puntos juntos al derecho (disminución hacia la derecha)' : 'Knit 2 together (Right decrease)')
                  : selectedCell.stitchType === 'K'
                  ? (isEs ? 'Punto del derecho en la vuelta' : 'Knit on RS')
                  : selectedCell.stitchType === 'P'
                  ? (isEs ? 'Punto del revés en la vuelta' : 'Purl on RS')
                  : (isEs ? 'Punto ya disminuido en vueltas anteriores' : 'Inactive / decreased stitch')}
              </span>
            </div>
          </div>
          <button
            onClick={() => setSelectedCell(null)}
            className="text-xs font-semibold text-[#2D5A43] hover:underline p-1"
          >
            {isEs ? 'Cerrar' : 'Close'}
          </button>
        </div>
      )}

      {/* Chart Canvas */}
      <div className="overflow-x-auto pb-4">
        <div className="inline-block min-w-full">
          <div className="flex flex-col gap-1 items-center">
            {chartData.cells.map((rowCells, rIdx) => {
              const rowNumber = chartData.rowLabels[rIdx];
              return (
                <div key={rIdx} className="flex items-center gap-2">
                  {/* Row number left */}
                  <span className="w-7 text-right text-xs font-mono text-[#6F756F] font-semibold select-none">
                    {rowNumber}
                  </span>

                  {/* Grid cells */}
                  <div className="flex gap-0.5">
                    {rowCells.map((cell, cIdx) => {
                      const isNoStitch = cell.stitchType === 'no_stitch';
                      const cellSizeClass = zoomLevel === 'large' ? 'w-8 h-10 text-xs' : 'w-6 h-7 text-[10px]';

                      return (
                        <div
                          key={cIdx}
                          onClick={() => setSelectedCell(cell)}
                          className={`knit-chart-cell cursor-pointer select-none rounded-2xs ${cellSizeClass} ${
                            isNoStitch
                              ? 'bg-[#EFECE6]/50 border-transparent text-transparent cursor-default'
                              : cell.colorHex
                              ? 'text-[#1F2421] font-bold shadow-2xs'
                              : 'bg-white text-[#1F2421] hover:bg-emerald-50'
                          } ${
                            selectedCell?.row === cell.row && selectedCell?.col === cell.col
                              ? 'ring-2 ring-[#2D5A43] bg-emerald-100 z-10'
                              : ''
                          }`}
                          style={{
                            backgroundColor:
                              !isNoStitch && cell.colorHex ? `${cell.colorHex}22` : undefined,
                            borderColor:
                              !isNoStitch && cell.colorHex ? cell.colorHex : undefined,
                          }}
                        >
                          {!isNoStitch && cell.symbol}
                        </div>
                      );
                    })}
                  </div>

                  {/* Row number right */}
                  <span className="w-7 text-left text-xs font-mono text-[#6F756F] font-semibold select-none">
                    {rowNumber}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Stitch column markers */}
          <div className="flex items-center justify-center gap-2 pt-2">
            <span className="w-7"></span>
            <div className="flex gap-0.5">
              {Array.from({ length: chartData.cols }).map((_, idx) => (
                <div
                  key={idx}
                  className={`text-center font-mono text-[9px] text-[#8C938C] ${
                    zoomLevel === 'large' ? 'w-8' : 'w-6'
                  }`}
                >
                  {chartData.cols - idx}
                </div>
              ))}
            </div>
            <span className="w-7"></span>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-[#FAF8F5] rounded-2xl p-4 sm:p-5 border border-[#E8E3DC] space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-[#1F2421] flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-[#2D5A43]" />
          {t.chartLegendTitle}
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {chartData.legend.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2.5 bg-white p-2.5 rounded-xl border border-[#DDD7CD]">
              <span className="w-7 h-7 rounded-lg bg-[#E4ECE7] text-[#2D5A43] font-mono font-bold flex items-center justify-center text-xs">
                {item.symbol}
              </span>
              <div className="text-xs leading-tight">
                <span className="font-bold text-[#1F2421] block">{item.name}</span>
                <span className="text-[#6F756F] text-[11px]">{item.description}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
