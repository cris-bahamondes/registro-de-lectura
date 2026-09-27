import React, { useState, useEffect } from 'react';
import { X, Search, Loader2, Check, BookOpen, AlertCircle, Sparkles } from 'lucide-react';
import { searchBookCovers, CoverSearchResult, optimizeCoverImage } from '../lib/bookCoverService';

interface CoverSearchModalProps {
  isOpen: boolean;
  initialTitle: string;
  initialAuthor?: string;
  onClose: () => void;
  onSelectCover: (coverUrl: string) => void;
}

export const CoverSearchModal: React.FC<CoverSearchModalProps> = ({
  isOpen,
  initialTitle,
  initialAuthor = '',
  onClose,
  onSelectCover,
}) => {
  const [title, setTitle] = useState(initialTitle);
  const [author, setAuthor] = useState(initialAuthor);
  const [results, setResults] = useState<CoverSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedResult, setSelectedResult] = useState<CoverSearchResult | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTitle(initialTitle);
      setAuthor(initialAuthor);
      setSelectedResult(null);
      if (initialTitle.trim()) {
        executeSearch(initialTitle, initialAuthor);
      } else {
        setResults([]);
        setHasSearched(false);
      }
    }
  }, [isOpen, initialTitle, initialAuthor]);

  const executeSearch = async (t: string, a: string) => {
    if (!t.trim()) return;
    setIsLoading(true);
    setHasSearched(true);
    setSelectedResult(null);
    try {
      const data = await searchBookCovers(t, a);
      setResults(data);
      if (data.length > 0) {
        setSelectedResult(data[0]);
      }
    } catch (err) {
      console.warn('[CoverSearchModal] Search failed:', err);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeSearch(title, author);
  };

  const handleConfirm = async () => {
    if (!selectedResult) return;
    setIsApplying(true);
    try {
      // Pick largeUrl or thumbnailUrl, and optimize it to a compact data URL / secure HTTPS URL
      const targetUrl = selectedResult.largeUrl || selectedResult.thumbnailUrl;
      const optimized = await optimizeCoverImage(targetUrl);
      onSelectCover(optimized);
      onClose();
    } catch (e) {
      console.warn('[CoverSearchModal] Failed to optimize cover; applying direct URL', e);
      onSelectCover(selectedResult.largeUrl || selectedResult.thumbnailUrl);
      onClose();
    } finally {
      setIsApplying(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl w-full max-w-lg max-h-[90vh] shadow-2xl border border-zinc-200 flex flex-col overflow-hidden animate-in zoom-in-95 duration-150 text-left">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 bg-zinc-50/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-zinc-900 text-white flex items-center justify-center shadow-xs">
              <Sparkles className="w-4 h-4 text-amber-300" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-zinc-900 leading-tight">
                Buscar portada online
              </h2>
              <p className="text-[11px] font-medium text-zinc-500">
                Open Library y Google Libros
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-zinc-200/70 text-zinc-500 hover:text-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Form */}
        <form onSubmit={handleSubmit} className="p-4 border-b border-zinc-100 bg-white space-y-2.5 shrink-0">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1 relative">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Título del libro..."
                className="w-full bg-zinc-50 border border-zinc-300 rounded-xl pl-3 pr-8 py-2 text-xs font-semibold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-800 focus:bg-white"
              />
            </div>
            <div className="sm:w-40 relative">
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Autor (opcional)..."
                className="w-full bg-zinc-50 border border-zinc-300 rounded-xl px-3 py-2 text-xs font-semibold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-800 focus:bg-white"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading || !title.trim()}
              className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs shadow-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 shrink-0"
            >
              {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              <span>Buscar</span>
            </button>
          </div>
        </form>

        {/* Results Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[220px]">
          {isLoading ? (
            <div className="py-14 flex flex-col items-center justify-center text-center">
              <Loader2 className="w-8 h-8 animate-spin text-zinc-400 mb-2" />
              <p className="text-xs font-semibold text-zinc-600">Buscando portadas en catálogo digital...</p>
              <p className="text-[11px] text-zinc-400">Consultando ediciones oficiales de «{title}»</p>
            </div>
          ) : results.length > 0 ? (
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-[11px] font-bold text-zinc-600">
                  {results.length} portadas encontradas:
                </span>
                <span className="text-[10px] text-zinc-400">
                  Toca una para seleccionarla
                </span>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 sm:gap-3">
                {results.map((res) => {
                  const isSelected = selectedResult?.id === res.id;
                  return (
                    <button
                      key={res.id}
                      type="button"
                      onClick={() => setSelectedResult(res)}
                      className={`group relative aspect-[3/4.4] rounded-xl overflow-hidden border-2 transition-all p-0.5 text-left flex flex-col bg-zinc-100 ${
                        isSelected
                          ? 'border-zinc-900 ring-2 ring-zinc-900 shadow-md scale-[1.02]'
                          : 'border-zinc-200 hover:border-zinc-400'
                      }`}
                    >
                      <img
                        src={res.thumbnailUrl}
                        alt={res.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover rounded-lg"
                        loading="lazy"
                      />
                      {isSelected && (
                        <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-zinc-900 text-white flex items-center justify-center shadow-xs">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      )}
                      {res.year && (
                        <span className="absolute bottom-1 left-1 text-[9px] font-bold px-1 rounded bg-black/70 text-white backdrop-blur-xs">
                          {res.year}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : hasSearched ? (
            <div className="py-12 flex flex-col items-center justify-center text-center px-4">
              <div className="w-11 h-11 rounded-2xl bg-zinc-100 text-zinc-400 flex items-center justify-center mb-2.5">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-xs font-bold text-zinc-800 mb-1">
                No encontramos portadas para esta búsqueda
              </h3>
              <p className="text-[11px] text-zinc-500 max-w-xs mb-3">
                Intenta buscar solo con el título principal, sin subtítulos ni caracteres especiales.
              </p>
            </div>
          ) : (
            <div className="py-12 flex flex-col items-center justify-center text-center px-4">
              <BookOpen className="w-8 h-8 text-zinc-300 mb-2" />
              <p className="text-xs font-semibold text-zinc-500">
                Escribe el título del libro para buscar portadas
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 border-t border-zinc-100 bg-zinc-50/70 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-zinc-300 hover:bg-zinc-200 text-zinc-700 text-xs font-bold transition-colors"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={!selectedResult || isApplying}
            className="px-5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all disabled:opacity-50"
          >
            {isApplying ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Aplicando...</span>
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Usar esta portada</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
