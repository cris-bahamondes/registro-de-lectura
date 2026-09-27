import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Search,
  Check,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  BookOpen,
  ArrowRight,
  ListFilter,
  CheckCircle2,
  FileText,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Book } from '../types';
import { isCorruptedOrPlaceholderTitle } from '../lib/syncService';
import { searchBookMetadata, BookMetadataResult } from '../lib/bookCoverService';
import { BookCoverImage } from './BookCoverImage';

const CATEGORIES = [
  'Novela',
  'Ficción',
  'No Ficción',
  'Ensayo',
  'Historia',
  'Filosofía',
  'Ciencia Ficción',
  'Fantasía',
  'Misterio / Thriller',
  'Terror',
  'Poesía',
  'Biografía',
  'Autoayuda',
  'Desarrollo Personal',
  'Negocios / Finanzas',
  'Arte / Diseño',
  'Cómic / Manga',
  'General',
];

interface QuickTitleFixModalProps {
  isOpen: boolean;
  onClose: () => void;
  books: Book[];
  onUpdateBook: (updated: Book) => void;
  initialBookId?: string | null;
}

export const QuickTitleFixModal: React.FC<QuickTitleFixModalProps> = ({
  isOpen,
  onClose,
  books,
  onUpdateBook,
  initialBookId,
}) => {
  const [activeTab, setActiveTab] = useState<'assistant' | 'batch'>('assistant');
  const [currentIndex, setCurrentIndex] = useState(0);

  // Filter books with provisional titles
  const provisionalBooks = useMemo(() => {
    return books.filter((b) => isCorruptedOrPlaceholderTitle(b.title));
  }, [books]);

  // Track initial book ID selection
  useEffect(() => {
    if (initialBookId && provisionalBooks.length > 0) {
      const idx = provisionalBooks.findIndex((b) => b.id === initialBookId);
      if (idx !== -1) {
        setCurrentIndex(idx);
      }
    }
  }, [initialBookId, provisionalBooks]);

  // Keep index within bounds
  useEffect(() => {
    if (currentIndex >= provisionalBooks.length && provisionalBooks.length > 0) {
      setCurrentIndex(provisionalBooks.length - 1);
    }
  }, [provisionalBooks.length, currentIndex]);

  const currentBook = provisionalBooks[currentIndex];

  // Form State
  const [titleInput, setTitleInput] = useState('');
  const [authorInput, setAuthorInput] = useState('');
  const [pagesInput, setPagesInput] = useState<number | ''>('');
  const [categoryInput, setCategoryInput] = useState('General');

  // Search suggestions
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<BookMetadataResult[]>([]);
  const [justSavedNotice, setJustSavedNotice] = useState<string | null>(null);

  // Batch paste state
  const [batchText, setBatchText] = useState('');
  const [batchPreview, setBatchPreview] = useState<{ title: string; author?: string }[]>([]);
  const [batchFeedback, setBatchFeedback] = useState<string | null>(null);

  // Populate inputs when currentBook changes
  useEffect(() => {
    if (currentBook) {
      setTitleInput('');
      setAuthorInput(currentBook.author && currentBook.author !== 'General' ? currentBook.author : '');
      setPagesInput(currentBook.totalPages && currentBook.totalPages > 0 ? currentBook.totalPages : '');
      setCategoryInput(currentBook.category || 'General');
      setSearchQuery('');
      setSearchResults([]);
      setJustSavedNotice(null);
    }
  }, [currentBook?.id]);

  // Live search debounce
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed || trimmed.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const results = await searchBookMetadata(trimmed);
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Apply suggestion
  const handleApplySuggestion = (suggestion: BookMetadataResult) => {
    setTitleInput(suggestion.title);
    if (suggestion.author) setAuthorInput(suggestion.author);
    if (suggestion.totalPages) setPagesInput(suggestion.totalPages);
    if (suggestion.category) {
      const matchedCat = CATEGORIES.find((c) =>
        suggestion.category?.toLowerCase().includes(c.toLowerCase())
      );
      if (matchedCat) setCategoryInput(matchedCat);
    }
    setSearchResults([]);
    setSearchQuery('');
  };

  // Save current book
  const handleSaveCurrent = (andNext = true) => {
    if (!currentBook) return;

    const cleanTitle = titleInput.trim();
    if (!cleanTitle) {
      alert('Por favor introduce un título para el libro.');
      return;
    }

    const updated: Book = {
      ...currentBook,
      title: cleanTitle,
      author: authorInput.trim() || 'Autor desconocido',
      totalPages: typeof pagesInput === 'number' && pagesInput > 0 ? pagesInput : (currentBook.totalPages || 0),
      category: categoryInput || currentBook.category || 'General',
      updatedAt: new Date().toISOString(),
    };

    onUpdateBook(updated);
    setJustSavedNotice(`"${cleanTitle}" guardado`);

    if (andNext) {
      setTimeout(() => {
        setJustSavedNotice(null);
      }, 2000);
    }
  };

  // Skip to next book
  const handleSkip = () => {
    if (currentIndex < provisionalBooks.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  // Go to previous book
  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  // Handle batch parsing
  const handleParseBatchText = (text: string) => {
    setBatchText(text);
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    const parsed = lines.map((line) => {
      // Check if separated by "-" or ";" or ","
      if (line.includes(' - ')) {
        const [t, a] = line.split(' - ');
        return { title: t.trim(), author: a ? a.trim() : undefined };
      }
      if (line.includes(';')) {
        const [t, a] = line.split(';');
        return { title: t.trim(), author: a ? a.trim() : undefined };
      }
      return { title: line };
    });

    setBatchPreview(parsed);
  };

  // Apply batch titles sequentially to provisional books
  const handleApplyBatch = () => {
    if (batchPreview.length === 0 || provisionalBooks.length === 0) return;

    const countToApply = Math.min(batchPreview.length, provisionalBooks.length);
    for (let i = 0; i < countToApply; i++) {
      const b = provisionalBooks[i];
      const p = batchPreview[i];
      const updated: Book = {
        ...b,
        title: p.title,
        author: p.author || b.author || 'Autor desconocido',
        updatedAt: new Date().toISOString(),
      };
      onUpdateBook(updated);
    }

    setBatchFeedback(`¡Se aplicaron ${countToApply} títulos correctamente!`);
    setTimeout(() => {
      setBatchFeedback(null);
      setBatchText('');
      setBatchPreview([]);
      setActiveTab('assistant');
    }, 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-zinc-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-zinc-900 leading-tight">
                Asistente de Corrección de Títulos
              </h2>
              <p className="text-[11px] text-zinc-500">
                {provisionalBooks.length > 0
                  ? `${provisionalBooks.length} libro${provisionalBooks.length > 1 ? 's' : ''} pendiente${provisionalBooks.length > 1 ? 's' : ''} de título`
                  : 'Todos los libros tienen títulos válidos'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tab switch */}
            <div className="flex items-center bg-zinc-200/80 p-0.5 rounded-xl text-xs font-semibold">
              <button
                onClick={() => setActiveTab('assistant')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  activeTab === 'assistant' ? 'bg-white text-zinc-900 shadow-2xs' : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                Paso a paso
              </button>
              <button
                onClick={() => setActiveTab('batch')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  activeTab === 'batch' ? 'bg-white text-zinc-900 shadow-2xs' : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                Lote / Lista
              </button>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-zinc-200/60 text-zinc-400 hover:text-zinc-700 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {provisionalBooks.length === 0 ? (
            /* Celebration state */
            <div className="py-12 text-center space-y-3">
              <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-200">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-zinc-900">¡Excelente trabajo!</h3>
              <p className="text-xs text-zinc-600 max-w-md mx-auto">
                No hay más libros con nombres provisionales. Todos tus libros tienen su título y portada organizados.
              </p>
              <button
                onClick={onClose}
                className="mt-4 px-6 py-2.5 bg-zinc-900 hover:bg-black text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
              >
                Volver a la biblioteca
              </button>
            </div>
          ) : activeTab === 'assistant' ? (
            /* Assistant Step by Step */
            <div className="space-y-4">
              {/* Progress counter & bar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-zinc-600">
                  <span>
                    Libro {currentIndex + 1} de {provisionalBooks.length}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={handlePrev}
                      disabled={currentIndex === 0}
                      className="p-1 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      title="Libro anterior"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={handleSkip}
                      disabled={currentIndex >= provisionalBooks.length - 1}
                      className="p-1 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      title="Siguiente libro"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden border border-zinc-200/60">
                  <div
                    className="bg-zinc-900 h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.round(((currentIndex + 1) / provisionalBooks.length) * 100)}%`,
                    }}
                  />
                </div>
              </div>

              {/* Just saved notice banner */}
              {justSavedNotice && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 animate-in fade-in">
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>{justSavedNotice}</span>
                </div>
              )}

              {/* Main Card: Cover on Left, Form & Search on Right */}
              {currentBook && (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start bg-zinc-50/70 p-4 rounded-2xl border border-zinc-200/80">
                  {/* Left Column: Big Cover Image Preview */}
                  <div className="md:col-span-5 flex flex-col items-center">
                    <div className="w-full max-w-[210px] aspect-[3/4.2] rounded-xl overflow-hidden shadow-md bg-white border border-zinc-200 relative group">
                      <BookCoverImage
                        src={currentBook.coverImage}
                        alt={currentBook.title}
                        bookId={currentBook.id}
                        fallbackTitle={currentBook.title}
                        coverColor={currentBook.coverColor}
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute bottom-2 left-2 text-[9px] font-mono font-bold bg-black/75 text-zinc-300 px-2 py-0.5 rounded-md backdrop-blur-xs">
                        ID: {currentBook.id.slice(0, 10)}
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-2 text-center max-w-[210px]">
                      Mira el título y autor en la portada e ingrésalos a la derecha.
                    </p>
                  </div>

                  {/* Right Column: Search + Direct Inputs */}
                  <div className="md:col-span-7 space-y-3">
                    {/* Live search input */}
                    <div className="relative">
                      <label className="block text-[11px] font-bold text-zinc-700 mb-1">
                        🔍 Buscar en biblioteca global (autocompletar)
                      </label>
                      <div className="relative">
                        <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="Escribe 2 o 3 letras de la portada para buscar..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full bg-white rounded-xl pl-9 pr-8 py-2 text-xs text-zinc-900 border border-zinc-200 shadow-2xs focus:ring-2 focus:ring-zinc-800 focus:outline-none"
                        />
                        {isSearching && (
                          <Loader2 className="w-4 h-4 text-zinc-400 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
                        )}
                        {searchQuery && !isSearching && (
                          <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 text-xs p-1"
                          >
                            ✕
                          </button>
                        )}
                      </div>

                      {/* Dropdown Results */}
                      {searchResults.length > 0 && (
                        <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-zinc-200 max-h-56 overflow-y-auto z-30 p-1.5 space-y-1 animate-in fade-in">
                          <p className="text-[10px] font-bold text-zinc-400 px-2 py-0.5 uppercase tracking-wider">
                            Sugerencias encontradas (haz clic para aplicar)
                          </p>
                          {searchResults.map((res, idx) => (
                            <button
                              key={idx}
                              onClick={() => handleApplySuggestion(res)}
                              className="w-full text-left p-2 rounded-lg hover:bg-zinc-100 flex items-center justify-between gap-2 text-xs transition-colors cursor-pointer group"
                            >
                              <div className="flex-1 truncate">
                                <p className="font-bold text-zinc-900 group-hover:text-black truncate">
                                  {res.title}
                                </p>
                                <p className="text-[10px] text-zinc-500 truncate">
                                  {res.author} {res.year ? `(${res.year})` : ''} {res.totalPages ? `• ${res.totalPages} págs` : ''}
                                </p>
                              </div>
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-zinc-200 text-zinc-700 shrink-0">
                                Usar
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Direct Inputs */}
                    <div className="space-y-2.5 pt-1">
                      <div>
                        <label className="block text-[11px] font-bold text-zinc-700 mb-0.5">
                          Título del libro *
                        </label>
                        <input
                          type="text"
                          value={titleInput}
                          onChange={(e) => setTitleInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSaveCurrent(true);
                            }
                          }}
                          placeholder="Ej. El Principito, Sapiens, etc."
                          className="w-full bg-white rounded-xl px-3 py-2 text-xs font-semibold text-zinc-900 border border-zinc-200 shadow-2xs focus:ring-2 focus:ring-zinc-800 focus:outline-none"
                          autoFocus
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-bold text-zinc-700 mb-0.5">
                            Autor
                          </label>
                          <input
                            type="text"
                            value={authorInput}
                            onChange={(e) => setAuthorInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleSaveCurrent(true);
                              }
                            }}
                            placeholder="Nombre del autor"
                            className="w-full bg-white rounded-xl px-3 py-2 text-xs text-zinc-900 border border-zinc-200 shadow-2xs focus:ring-2 focus:ring-zinc-800 focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-zinc-700 mb-0.5">
                            Páginas totales
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={pagesInput}
                            onChange={(e) =>
                              setPagesInput(e.target.value ? parseInt(e.target.value, 10) : '')
                            }
                            placeholder="Opcional"
                            className="w-full bg-white rounded-xl px-3 py-2 text-xs text-zinc-900 border border-zinc-200 shadow-2xs focus:ring-2 focus:ring-zinc-800 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-zinc-700 mb-0.5">
                          Categoría
                        </label>
                        <select
                          value={categoryInput}
                          onChange={(e) => setCategoryInput(e.target.value)}
                          className="w-full bg-white rounded-xl px-3 py-2 text-xs text-zinc-900 border border-zinc-200 shadow-2xs focus:ring-2 focus:ring-zinc-800 focus:outline-none"
                        >
                          {CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 pt-3">
                      <button
                        onClick={() => handleSaveCurrent(true)}
                        className="flex-1 px-4 py-2.5 bg-zinc-900 hover:bg-black text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer"
                      >
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span>Guardar y siguiente</span>
                      </button>

                      <button
                        onClick={handleSkip}
                        className="px-3 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-semibold rounded-xl text-xs transition-all cursor-pointer"
                      >
                        Omitir
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Batch Mode: Paste list of titles */
            <div className="space-y-4">
              <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-200 space-y-2">
                <div className="flex items-center gap-2 text-zinc-900 font-bold text-xs">
                  <FileText className="w-4 h-4 text-zinc-600" />
                  <span>Pegar lista de títulos en bloque</span>
                </div>
                <p className="text-[11px] text-zinc-600">
                  Si tienes una lista de tus libros (por ejemplo de un Excel o notas), pégala aquí (un libro por línea). Se asignarán en orden a tus {provisionalBooks.length} libros provisionales. Formato opcional: <code>Título - Autor</code> o solo <code>Título</code>.
                </p>
                <textarea
                  rows={8}
                  value={batchText}
                  onChange={(e) => handleParseBatchText(e.target.value)}
                  placeholder={`Ejemplo:\nÚltimo año de inocencia - Daisy Alpert Florin\nSantas - Santiago Campione\nEste horrible deseo de amarte\nLas mujeres de la guerra`}
                  className="w-full bg-white rounded-xl p-3 text-xs font-mono text-zinc-900 border border-zinc-200 focus:ring-2 focus:ring-zinc-800 focus:outline-none"
                />

                {batchPreview.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <p className="text-xs font-bold text-zinc-700">
                      Vista previa ({batchPreview.length} títulos detectados):
                    </p>
                    <div className="max-h-36 overflow-y-auto bg-white rounded-xl border border-zinc-200 p-2 text-[11px] space-y-1">
                      {batchPreview.slice(0, 10).map((p, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 truncate">
                          <span className="font-bold text-zinc-400">{idx + 1}.</span>
                          <span className="font-semibold text-zinc-900">{p.title}</span>
                          {p.author && <span className="text-zinc-500">({p.author})</span>}
                        </div>
                      ))}
                      {batchPreview.length > 10 && (
                        <p className="text-[10px] text-zinc-400 italic">
                          ... y {batchPreview.length - 10} más
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {batchFeedback && (
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{batchFeedback}</span>
                  </div>
                )}

                <div className="pt-2">
                  <button
                    onClick={handleApplyBatch}
                    disabled={batchPreview.length === 0}
                    className="w-full py-2.5 bg-zinc-900 hover:bg-black disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                  >
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>
                      Aplicar {Math.min(batchPreview.length, provisionalBooks.length)} títulos a libros provisionales
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-zinc-100 flex items-center justify-between bg-zinc-50/50">
          <span className="text-[11px] text-zinc-500">
            Los cambios se guardan de forma permanente e instantánea en tu dispositivo y nube.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-zinc-200 hover:bg-zinc-300 text-zinc-800 text-xs font-semibold cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
