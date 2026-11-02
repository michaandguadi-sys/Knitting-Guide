import React, { useState } from 'react';
import {
  FolderHeart,
  BookmarkCheck,
  Plus,
  Trash2,
  Calendar,
  Sparkles,
  ArrowRight,
  Edit3,
  Check,
  CheckCircle2,
} from 'lucide-react';
import { SavedProject, CompiledPattern } from '../types/knit';
import { Language } from '../i18n/translations';

interface SavedProjectsViewProps {
  savedProjects: SavedProject[];
  currentPattern: CompiledPattern | null;
  onLoadProject: (project: SavedProject) => void;
  onSaveCurrentAsProject: (projectName: string, recipientName: string) => void;
  onDeleteProject: (projectId: string) => void;
  onUpdateNotes: (projectId: string, notes: string) => void;
  lang: Language;
}

export const SavedProjectsView: React.FC<SavedProjectsViewProps> = ({
  savedProjects,
  currentPattern,
  onLoadProject,
  onSaveCurrentAsProject,
  onDeleteProject,
  onUpdateNotes,
  lang,
}) => {
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [tempNotes, setTempNotes] = useState('');

  const isEs = lang === 'es';

  const handleStartSave = () => {
    setNewProjectName(
      isEs
        ? `${currentPattern?.title ?? 'Mi prenda'} (${new Date().toLocaleDateString('es-AR')})`
        : `${currentPattern?.title ?? 'My piece'} (${new Date().toLocaleDateString('en-US')})`
    );
    setShowSaveModal(true);
  };

  const handleConfirmSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    onSaveCurrentAsProject(newProjectName.trim(), recipientName.trim());
    setShowSaveModal(false);
    setNewProjectName('');
    setRecipientName('');
  };

  return (
    <div className="bg-white rounded-3xl border border-[#E8E3DC] shadow-xs p-4 sm:p-7 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#F0ECE6] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-[#E4ECE7] text-[#2D5A43] flex items-center justify-center">
              <FolderHeart className="w-4 h-4" />
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-[#1F2421]">
              {isEs ? 'Mis Tejidos y Progreso' : 'My Saved Projects & Progress'}
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-[#6F756F] mt-1">
            {isEs
              ? 'Tus labores guardadas. Cerrá tranquila la app que tu progreso queda grabado automáticamente.'
              : 'Your saved knitting projects. Close the app anytime; your progress is auto-saved.'}
          </p>
        </div>

        {/* Save Current Pattern Button */}
        <button
          type="button"
          onClick={handleStartSave}
          className="px-4 py-2.5 rounded-2xl bg-[#2D5A43] hover:bg-[#234734] text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-xs transition active:scale-95 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{isEs ? 'Guardar labor actual' : 'Save current project'}</span>
        </button>
      </div>

      {/* Projects List */}
      {savedProjects.length === 0 ? (
        <div className="text-center py-12 px-4 rounded-3xl bg-[#FAF8F5] border border-dashed border-[#DDD7CD] space-y-3">
          <FolderHeart className="w-12 h-12 mx-auto text-[#8C938C]" />
          <h3 className="text-base font-bold text-[#1F2421]">
            {isEs ? 'Todavía no guardaste labores' : 'No saved projects yet'}
          </h3>
          <p className="text-xs text-[#6F756F] max-w-sm mx-auto">
            {isEs
              ? 'Tocá el botón "Guardar labor actual" para guardar el gorro con su tamaño, vueltas y tus anotaciones.'
              : 'Tap "Save current project" to store your pattern, current row count, and personal notes.'}
          </p>
          <button
            type="button"
            onClick={handleStartSave}
            className="px-4 py-2 rounded-xl bg-[#2D5A43] text-white font-semibold text-xs transition active:scale-95"
          >
            {isEs ? 'Guardar ahora' : 'Save now'}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {savedProjects.map((proj) => {
            const totalSteps = proj.pattern.allRows.length || 1;
            const completedCount = Object.values(proj.completedSteps || {}).filter(Boolean).length;
            const percent = Math.round((completedCount / totalSteps) * 100);
            const isEditingNotes = editingNotesId === proj.id;

            return (
              <div
                key={proj.id}
                className="bg-[#FAF8F5] rounded-3xl p-5 border border-[#E8E3DC] space-y-4 hover:border-[#2D5A43] transition flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base sm:text-lg font-bold text-[#1F2421]">
                        {proj.name}
                      </h3>
                      {proj.recipientName && (
                        <span className="text-xs text-[#2D5A43] font-semibold block">
                          🎁 {isEs ? `Para: ${proj.recipientName}` : `For: ${proj.recipientName}`}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => onDeleteProject(proj.id)}
                      className="p-1.5 text-[#8C938C] hover:text-rose-600 rounded-lg transition"
                      title={isEs ? 'Borrar proyecto' : 'Delete project'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Date and Specs */}
                  <div className="flex items-center gap-3 text-xs text-[#6F756F]">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(proj.updatedAt || proj.savedAt).toLocaleDateString(
                        isEs ? 'es-AR' : 'en-US'
                      )}
                    </span>
                    <span>•</span>
                    <span>
                      {proj.pattern.calculatedGauge.castOnSts} {isEs ? 'puntos' : 'sts'}
                    </span>
                    <span>•</span>
                    <span>{proj.pattern.constraints.needleSizeMm} mm</span>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1 pt-1">
                    <div className="flex items-center justify-between text-xs text-[#4A504A]">
                      <span className="font-semibold">
                        {isEs ? 'Paso' : 'Step'} {(proj.currentStepIndex || 0) + 1} {isEs ? 'de' : 'of'}{' '}
                        {totalSteps} ({completedCount} {isEs ? 'listos' : 'done'})
                      </span>
                      <span className="font-bold text-[#2D5A43]">{percent}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-[#EFECE6] overflow-hidden">
                      <div
                        className="h-full bg-[#2D5A43] rounded-full transition-all"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>

                  {/* Knitter Notes */}
                  <div className="bg-white rounded-2xl p-3 border border-[#E8E3DC] text-xs space-y-1">
                    <div className="flex items-center justify-between text-[#6F756F] font-semibold">
                      <span>{isEs ? 'Mis Anotaciones:' : 'Knitter Notes:'}</span>
                      {!isEditingNotes && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingNotesId(proj.id);
                            setTempNotes(proj.notes || '');
                          }}
                          className="text-[#2D5A43] hover:underline flex items-center gap-1"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>{isEs ? 'Editar' : 'Edit'}</span>
                        </button>
                      )}
                    </div>
                    {isEditingNotes ? (
                      <div className="space-y-2 pt-1">
                        <textarea
                          value={tempNotes}
                          onChange={(e) => setTempNotes(e.target.value)}
                          placeholder={
                            isEs
                              ? 'Ej: Usé aguja de madera, lana color verde salvia...'
                              : 'e.g. Used bamboo needles, added 2 extra rows...'
                          }
                          className="w-full text-xs p-2 bg-[#FAF8F5] border border-[#DDD7CD] rounded-xl focus:ring-1 focus:ring-[#2D5A43]"
                          rows={2}
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingNotesId(null)}
                            className="px-2 py-1 text-xs text-[#6F756F]"
                          >
                            {isEs ? 'Cancelar' : 'Cancel'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onUpdateNotes(proj.id, tempNotes);
                              setEditingNotesId(null);
                            }}
                            className="px-3 py-1 bg-[#2D5A43] text-white rounded-lg text-xs font-semibold"
                          >
                            {isEs ? 'Guardar nota' : 'Save'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-[#4A504A] italic">
                        {proj.notes ||
                          (isEs ? 'Sin notas. Tocá editar para agregar.' : 'No notes. Tap edit to add.')}
                      </p>
                    )}
                  </div>
                </div>

                {/* Continue button */}
                <button
                  type="button"
                  onClick={() => onLoadProject(proj)}
                  className="w-full py-3 px-4 rounded-2xl bg-[#2D5A43] hover:bg-[#234734] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer shadow-xs"
                >
                  <span>{isEs ? 'Continuar tejiendo esta labor' : 'Continue knitting this project'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <form
            onSubmit={handleConfirmSave}
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#E8E3DC] space-y-4"
          >
            <h3 className="text-lg font-bold text-[#1F2421]">
              {isEs ? 'Guardar labor en Mis Tejidos' : 'Save Project to My Projects'}
            </h3>
            <p className="text-xs text-[#6F756F]">
              {isEs
                ? 'Ponéle un nombre fácil para reconocerlo cuando vuelvas a tejer.'
                : 'Give this project a name so you can easily pick it up later.'}
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#1F2421] mb-1">
                  {isEs ? 'Nombre de la labor' : 'Project Name'}
                </label>
                <input
                  type="text"
                  required
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="w-full text-sm p-3 bg-[#FAF8F5] border border-[#DDD7CD] rounded-xl font-bold focus:ring-2 focus:ring-[#2D5A43]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1F2421] mb-1">
                  {isEs ? '¿Para quién es? (Opcional)' : 'Recipient (Optional)'}
                </label>
                <input
                  type="text"
                  placeholder={isEs ? 'Ej: Juan, Mamá, Para mí' : 'e.g. My daughter, For myself'}
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  className="w-full text-xs p-3 bg-[#FAF8F5] border border-[#DDD7CD] rounded-xl font-medium focus:ring-2 focus:ring-[#2D5A43]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 text-xs font-semibold text-[#6F756F] hover:bg-[#F3EFEA] rounded-xl"
              >
                {isEs ? 'Cancelar' : 'Cancel'}
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-[#2D5A43] hover:bg-[#234734] text-white rounded-xl text-xs font-bold shadow-xs active:scale-95"
              >
                {isEs ? 'Guardar labor' : 'Save Project'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
