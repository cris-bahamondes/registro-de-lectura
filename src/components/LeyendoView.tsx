import React, { useState } from 'react';
import { Book, Chapter, UserProfile, TabType } from '../types';
import { StarRating } from './StarRating';
import { formatChapterDisplayTitle } from '../lib/romanUtils';
import { RomanChapterText } from './RomanChapterText';
import { getBookGenres } from '../lib/genreUtils';
import { calculateBookActiveReadingDays, formatReadingDays } from '../lib/readingDaysUtils';
import {
  CheckCircle2,
  BookOpen,
  Plus,
  Check,
  ChevronRight,
  Flag,
  Layers,
  Sparkles,
  Trash2,
  Bookmark,
  Cloud,
  RefreshCw,
  Search,
  Save,
  Calendar,
} from 'lucide-react';
import { CoverSearchModal } from './CoverSearchModal';
import { BookCoverImage } from './BookCoverImage';

interface LeyendoViewProps {
  activeBook: Book | null;
  pendingBooks: Book[];
  parallelBooks?: Book[];
  onOpenAddBookModal: () => void;
  onOpenParallelModal?: () => void;
  onSelectActiveBook: (bookId: string) => void;
  onUpdatePage: (bookId: string, newPage: number) => void;
  onOpenChaptersModal: (book: Book) => void;
  onToggleChapterRead: (bookId: string, chapterId: string) => void;
  onUnmarkAllChapters?: (bookId: string) => void;
  onFinishBook: (book: Book) => void;
  onAbandonBook: (book: Book) => void;
  onSaveBook?: (book: Book) => void;
  onSyncBookProgress?: (book: Book) => Promise<void> | void;
  onUpdateStartDate?: (bookId: string, newDate: string) => void;
  onUpdateEndDate?: (bookId: string, newDate: string) => void;
  onViewBookDetail?: (book: Book) => void;
  onUpdateBookCover?: (bookId: string, coverUrl: string) => void;
  user?: UserProfile;
  isSyncing?: boolean;
  onManualSync?: () => void;
  onNavigateToTab?: (tab: TabType) => void;
  totalBooksCount?: number;
}

export const LeyendoView: React.FC<LeyendoViewProps> = ({
  activeBook,
  pendingBooks,
  parallelBooks = [],
  onOpenAddBookModal,
  onOpenParallelModal,
  onSelectActiveBook,
  onUpdatePage,
  onOpenChaptersModal,
  onToggleChapterRead,
  onUnmarkAllChapters,
  onFinishBook,
  onAbandonBook,
  onSaveBook,
  onSyncBookProgress,
  onUpdateStartDate,
  onUpdateEndDate,
  onViewBookDetail,
  onUpdateBookCover,
  user,
  isSyncing = false,
  onManualSync,
  onNavigateToTab,
  totalBooksCount = 0,
}) => {
  const [pageInputVal, setPageInputVal] = useState('');
  const [showSwitchBookModal, setShowSwitchBookModal] = useState(false);
  const [isCoverSearchOpen, setIsCoverSearchOpen] = useState(false);
  const [isSyncingThisBook, setIsSyncingThisBook] = useState(false);

  // Sync only the current active book's progress
  const handleSyncThisBook = async () => {
    if (!activeBook || isSyncingThisBook) return;
    setIsSyncingThisBook(true);
    try {
      let target = activeBook;
      const parsedVal = parseInt(pageInputVal, 10);
      if (
        !isNaN(parsedVal) &&
        parsedVal >= 0 &&
        parsedVal <= activeBook.totalPages &&
        parsedVal !== activeBook.currentPage
      ) {
        onUpdatePage(activeBook.id, parsedVal);
        target = { ...activeBook, currentPage: parsedVal };
      }

      if (onSyncBookProgress) {
        await onSyncBookProgress(target);
      } else if (onSaveBook) {
        await onSaveBook(target);
      } else if (onManualSync) {
        await onManualSync();
      }
    } finally {
      setIsSyncingThisBook(false);
    }
  };

  // Keep pageInput in sync with active book (must be called unconditionally before any early returns)
  React.useEffect(() => {
    if (activeBook) {
      setPageInputVal(activeBook.currentPage.toString());
    }
  }, [activeBook?.id, activeBook?.currentPage]);

  // Check if chapters are out of sync with current page (must be declared before any early returns)
  const hasOutOfSyncChapters = React.useMemo(() => {
    if (!activeBook?.chapters || activeBook.chapters.length === 0) return false;
    return activeBook.chapters.some(
      (c) => c.endPage > 0 && (c.endPage <= activeBook.currentPage !== c.isRead)
    );
  }, [activeBook?.chapters, activeBook?.currentPage]);

  // If no book is currently being read (matches screenshot 3)
  if (!activeBook) {
    return (
      <div className="px-4 py-3">
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-zinc-200/80 text-center flex flex-col items-center justify-center max-w-md mx-auto my-6">
          {/* Open Book Image matching requested graphic */}
          <div className="w-20 h-20 mb-5 flex items-center justify-center">
            <img
              src="/libro-abierto.svg"
              alt="Libro abierto"
              className="w-16 h-16 object-contain"
            />
          </div>

          <h2 className="text-xl font-extrabold text-zinc-900 mb-2 leading-tight">
            No tienes un libro en lectura activa
          </h2>

          <p className="text-zinc-500 text-sm mb-6 max-w-xs leading-relaxed">
            Selecciona o agrega un libro para comenzar a medir tu avance.
          </p>

          <button
            onClick={onOpenAddBookModal}
            className="w-full py-3.5 px-6 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-[15px] shadow-sm hover:shadow-md active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Añadir un Libro</span>
          </button>

          {/* Multi-device sync helper for logged in accounts */}
          {user && !user.isGuest && onManualSync && (
            <div className="mt-4 w-full p-4 rounded-2xl bg-zinc-50 border border-zinc-200/90 text-left">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-cyan-100 text-cyan-800 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                  <Cloud className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-bold text-zinc-900">¿Tienes libros en otro dispositivo?</h4>
                  <p className="text-[11px] text-zinc-600 mt-0.5 leading-relaxed">
                    Si agregaste libros desde tu teléfono o computadora con tu cuenta <span className="font-semibold text-zinc-800">{user.email}</span>, pulsa para descargarlos aquí.
                  </p>
                  <button
                    onClick={onManualSync}
                    disabled={isSyncing}
                    className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 active:scale-95 text-white text-xs font-bold shadow-2xs transition-all cursor-pointer disabled:opacity-60"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-cyan-400' : ''}`} />
                    <span>{isSyncing ? 'Sincronizando con la nube...' : 'Sincronizar ahora con la nube'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Shortcut to Library if user has books in library that are pending or read */}
          {totalBooksCount > 0 && onNavigateToTab && (
            <div className="mt-3 w-full">
              <button
                onClick={() => onNavigateToTab('biblioteca')}
                className="w-full py-2.5 px-4 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5 text-zinc-600" />
                <span>Ver mi Biblioteca ({totalBooksCount} {totalBooksCount === 1 ? 'libro' : 'libros'})</span>
              </button>
            </div>
          )}

          {pendingBooks.length > 0 && (
            <div className="mt-6 w-full pt-4 border-t border-zinc-100">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
                O continúa uno de tus pendientes:
              </p>
              <div className="space-y-2">
                {pendingBooks.slice(0, 3).map((book) => (
                  <button
                    key={book.id}
                    onClick={() => onSelectActiveBook(book.id)}
                    className="w-full p-2.5 rounded-xl bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 flex items-center justify-between text-left transition-all group"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <div className="w-8 h-11 rounded-sm bg-zinc-200 overflow-hidden shrink-0 shadow-2xs">
                        <BookCoverImage
                          src={book.coverImage}
                          alt={book.title}
                          bookId={book.id}
                          fallbackTitle={book.title}
                          coverColor={book.coverColor}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="truncate">
                        <p className="text-xs font-bold text-zinc-900 truncate group-hover:text-black">
                          {book.title}
                        </p>
                        <p className="text-[11px] text-zinc-500 truncate">{book.author}</p>
                      </div>
                    </div>
                    <span className="text-[11px] font-bold text-zinc-900 bg-white px-2 py-1 rounded-lg border border-zinc-200 shadow-2xs shrink-0 flex items-center gap-1">
                      Leer <ChevronRight className="w-3 h-3" />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Active book details
  const percentage = Math.min(100, Math.round((activeBook.currentPage / activeBook.totalPages) * 100)) || 0;
  const remainingPages = Math.max(0, activeBook.totalPages - activeBook.currentPage);
  const completedChaptersCount = (activeBook.chapters || []).filter((c) => c.isRead).length;

  return (
    <div className="px-4 py-2 space-y-4 max-w-lg mx-auto pb-12">
      {/* Active Book Card */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-zinc-200/80 relative overflow-hidden">
        {/* Top Header info */}
        <div className="flex gap-4 items-start">
          {/* Cover (Tocar para ver ficha de lectura) */}
          <div
            onClick={() => onViewBookDetail?.(activeBook)}
            className="w-24 h-36 rounded-xl overflow-hidden shadow-md shrink-0 bg-zinc-200 relative border border-zinc-300 cursor-pointer hover:opacity-95 active:scale-95 transition-all group"
            title="Toca la imagen para ver la ficha completa del libro"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onViewBookDetail?.(activeBook);
              }
            }}
          >
            <BookCoverImage
              src={activeBook.coverImage}
              alt={activeBook.title}
              bookId={activeBook.id}
              fallbackTitle={activeBook.title}
              coverColor={activeBook.coverColor}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <span className="absolute bottom-1 right-1 text-[9px] font-bold px-1.5 py-0.5 rounded-sm bg-black/70 text-white backdrop-blur-xs uppercase">
              {activeBook.format}
            </span>
          </div>

          {/* Book Info */}
          <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
            <div>
              <div className="flex items-center justify-between gap-1.5 flex-wrap mb-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-zinc-900 text-white border border-zinc-900">
                    Leyendo ahora
                  </span>
                  {(() => {
                    const genres = getBookGenres(activeBook);
                    const displayGenres = genres.length > 0 ? genres : [activeBook.category || 'General'];
                    return displayGenres.map((g) => (
                      <span
                        key={g}
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700 border border-zinc-200 truncate max-w-[120px]"
                      >
                        {g}
                      </span>
                    ));
                  })()}
                </div>

                {parallelBooks.length > 1 && onOpenParallelModal && (
                  <button
                    type="button"
                    onClick={onOpenParallelModal}
                    className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-zinc-200 text-zinc-900 hover:bg-zinc-300 border border-zinc-300 transition-all flex items-center gap-1 shadow-2xs cursor-pointer"
                    title="Ver libros en lectura paralela"
                  >
                    <span>{parallelBooks.length} en paralelo</span>
                    <ChevronRight className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>

              <h2 className="text-lg font-bold text-zinc-900 leading-snug line-clamp-2">
                {activeBook.title}
              </h2>

              <p className="text-xs text-zinc-600 font-medium mb-1 truncate">
                {activeBook.author}
              </p>

              {/* Quick cover finder button if missing cover */}
              {!activeBook.coverImage && (
                <div className="mb-2">
                  <button
                    type="button"
                    onClick={() => setIsCoverSearchOpen(true)}
                    className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2.5 py-1 rounded-xl transition-colors shadow-2xs cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    <span>Buscar portada para este libro</span>
                  </button>
                </div>
              )}

              {activeBook.saga && (
                <p className="text-[11px] text-zinc-700 font-semibold truncate mb-1">
                  📚 Saga: {activeBook.saga}
                </p>
              )}

              {activeBook.description && (
                <p
                  className="text-[11px] text-zinc-600 leading-snug line-clamp-3 mb-1.5 italic hover:line-clamp-none transition-all cursor-default"
                  title={activeBook.description}
                >
                  "{activeBook.description}"
                </p>
              )}
            </div>

            <div className="pt-2 border-t border-zinc-100">
              <StarRating rating={activeBook.rating} size="sm" />
            </div>
          </div>
        </div>

        {/* Progress Bar & Percentage */}
        <div className="mt-5 pt-4 border-t border-zinc-100">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-zinc-900">Progreso de lectura</span>
            <span className="text-sm font-extrabold text-zinc-950">{percentage}%</span>
          </div>

          {/* Gradient Progress Bar */}
          <div className="w-full h-3 bg-zinc-200 rounded-full overflow-hidden p-0.5">
            <div
              className="h-full bg-gradient-to-r from-zinc-600 via-zinc-800 to-zinc-950 rounded-full transition-all duration-300"
              style={{ width: `${percentage}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-zinc-500 mt-1.5">
            <span>
              Página <strong className="text-zinc-900">{activeBook.currentPage}</strong> de{' '}
              {activeBook.totalPages}
            </span>
            <span>
              Quedan <strong className="text-zinc-900">{remainingPages}</strong> págs
            </span>
          </div>
        </div>

        {/* Actualizar página: Solo con números */}
        <div className="mt-4 bg-zinc-50 rounded-2xl p-3 border border-zinc-200">
          <label className="block text-xs font-bold text-zinc-900 mb-1.5">
            Actualizar página
          </label>
          
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="number"
                min="0"
                max={activeBook.totalPages}
                value={pageInputVal}
                onChange={(e) => {
                  setPageInputVal(e.target.value);
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val)) {
                    onUpdatePage(activeBook.id, Math.max(0, Math.min(activeBook.totalPages, val)));
                  }
                }}
                className="w-full bg-white border border-zinc-300 rounded-xl px-3 py-2 text-sm font-extrabold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-800"
                placeholder="Número de página..."
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-400 pointer-events-none">
                / {activeBook.totalPages}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onUpdatePage(activeBook.id, Math.max(0, activeBook.currentPage - 1))}
                className="w-9 h-9 bg-white hover:bg-zinc-200 rounded-xl border border-zinc-300 text-sm font-extrabold text-zinc-900 flex items-center justify-center active:scale-95 transition-all shadow-2xs"
              >
                -
              </button>
              <button
                type="button"
                onClick={() => onUpdatePage(activeBook.id, Math.min(activeBook.totalPages, activeBook.currentPage + 1))}
                className="w-9 h-9 bg-zinc-900 hover:bg-zinc-800 rounded-xl text-sm font-extrabold text-white flex items-center justify-center active:scale-95 transition-all shadow-2xs"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* 3 Metric Pills */}
        <div className="grid grid-cols-3 gap-2 mt-4 text-center">
          <div className="bg-zinc-50 rounded-2xl p-2.5 border border-zinc-200">
            <span className="text-[10px] text-zinc-500 block leading-tight font-medium">
              Capítulos
            </span>
            <span className="text-sm font-extrabold text-zinc-900">
              {completedChaptersCount} / {(activeBook.chapters || []).length}
            </span>
          </div>

          <div className="bg-zinc-50 rounded-2xl p-2.5 border border-zinc-200">
            <span className="text-[10px] text-zinc-500 block leading-tight font-medium">
              Págs leídas
            </span>
            <span className="text-sm font-extrabold text-zinc-900">
              {activeBook.currentPage}
            </span>
          </div>

          <div className="bg-zinc-50 rounded-2xl p-2.5 border border-zinc-200">
            <span className="text-[10px] text-zinc-500 block leading-tight font-medium">
              Días activo
            </span>
            <span className="text-sm font-extrabold text-zinc-900">
              {formatReadingDays(calculateBookActiveReadingDays(activeBook))}
            </span>
          </div>
        </div>

        {/* Static Start Date Info (Read-only) */}
        {activeBook.startDate && (
          <div className="mt-3 bg-zinc-50 rounded-2xl p-2.5 border border-zinc-200 flex items-center justify-between text-xs font-semibold text-zinc-700">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-zinc-500" />
              <span>Fecha de inicio de lectura</span>
            </div>
            <span className="font-extrabold text-zinc-900">{activeBook.startDate}</span>
          </div>
        )}

        {/* Primary Actions: Sincronizar, Terminado & Abandonar */}
        <div className="flex gap-2 mt-5">
          <button
            type="button"
            disabled={isSyncingThisBook}
            onClick={handleSyncThisBook}
            className="flex-1 py-3 px-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-1.5 border border-emerald-600 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
            title="Sincronizar el avance de este libro con la nube y otros dispositivos"
          >
            <RefreshCw className={`w-4 h-4 text-white ${isSyncingThisBook ? 'animate-spin' : ''}`} />
            <span>{isSyncingThisBook ? 'Sincronizando...' : 'Sincronizar'}</span>
          </button>

          <button
            onClick={() => onFinishBook(activeBook)}
            className="flex-1 py-3 px-3 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-white font-black text-xs shadow-xs active:scale-98 transition-all flex items-center justify-center gap-1.5 border border-zinc-900 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4 text-white" />
            <span>Terminado</span>
          </button>

          <button
            onClick={() => onAbandonBook(activeBook)}
            className="py-3 px-3 rounded-2xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold text-xs border border-zinc-300 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Flag className="w-4 h-4" />
            <span>Abandonar</span>
          </button>
        </div>
      </div>

      {/* Chapters Card with Unlimited Chapters & Quick Add */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-zinc-200/80">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-zinc-900" />
            <div>
              <h3 className="font-bold text-sm text-zinc-900">Capítulos del Libro</h3>
              <p className="text-[10px] text-zinc-500 font-medium">
                {(activeBook.chapters || []).length} capítulos registrados • {completedChaptersCount} leídos
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {hasOutOfSyncChapters && (
              <button
                type="button"
                onClick={() => onUpdatePage(activeBook.id, activeBook.currentPage)}
                className="text-[11px] font-bold text-zinc-800 hover:text-black bg-zinc-200/80 hover:bg-zinc-300 px-2 py-1 rounded-lg border border-zinc-300 transition-colors cursor-pointer flex items-center gap-1"
                title={`Sincronizar capítulos leídos con la página actual (${activeBook.currentPage})`}
              >
                Alinear con pág. {activeBook.currentPage}
              </button>
            )}
            {completedChaptersCount > 0 && onUnmarkAllChapters && (
              <button
                type="button"
                onClick={() => onUnmarkAllChapters(activeBook.id)}
                className="text-[11px] font-bold text-zinc-600 hover:text-zinc-900 bg-zinc-100 hover:bg-zinc-200 px-2 py-1 rounded-lg border border-zinc-300 transition-colors cursor-pointer"
                title="Desmarcar todos los capítulos leídos"
              >
                Desmarcar todos
              </button>
            )}
            <button
              onClick={() => onOpenChaptersModal(activeBook)}
              className="text-xs font-bold text-zinc-900 hover:text-black flex items-center gap-1 bg-zinc-100 hover:bg-zinc-200 px-2.5 py-1 rounded-lg border border-zinc-300 shadow-2xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Gestionar
            </button>
          </div>
        </div>

        {/* Chapters list */}
        {(activeBook.chapters || []).length === 0 ? (
          <div className="py-6 text-center text-zinc-400 text-xs">
            <p className="mb-2">No has agregado capítulos para este libro todavía.</p>
            <button
              onClick={() => onOpenChaptersModal(activeBook)}
              className="px-3 py-1.5 bg-zinc-100 text-zinc-900 font-bold text-xs rounded-xl border border-zinc-300 hover:bg-zinc-200 transition-colors cursor-pointer"
            >
              Añadir todos los capítulos
            </button>
          </div>
        ) : activeBook.hasParts && (activeBook.parts || []).length > 0 ? (
          /* Grouped by Parts */
          <div className="space-y-3.5 max-h-80 overflow-y-auto pr-1">
            {(activeBook.parts || []).map((partName) => {
              const partChapters = (activeBook.chapters || []).filter((c) => c.part === partName);
              const readInPart = partChapters.filter((c) => c.isRead).length;

              return (
                <div key={partName} className="space-y-1.5 bg-zinc-50/70 p-2.5 rounded-2xl border border-zinc-200">
                  <div className="flex items-center justify-between px-1 pb-0.5">
                    <div className="flex items-center gap-1.5">
                      <Bookmark className="w-3.5 h-3.5 text-zinc-900" />
                      <span className="font-extrabold text-zinc-900 text-xs">{partName}</span>
                    </div>
                    <span className="text-[10px] font-bold text-zinc-500">
                      {readInPart} de {partChapters.length} leídos
                    </span>
                  </div>

                  {partChapters.length === 0 ? (
                    <p className="text-[10px] text-zinc-400 italic px-1 py-1">Sin capítulos en esta parte.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {partChapters.map((chapter) => {
                        const chapterPages = Math.max(1, chapter.endPage - chapter.startPage + 1);

                        return (
                          <div
                            key={chapter.id}
                            onClick={() => onToggleChapterRead(activeBook.id, chapter.id)}
                            className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                              chapter.isRead
                                ? 'bg-zinc-100 border-zinc-300 text-zinc-600'
                                : 'bg-white border-zinc-200 text-zinc-900 hover:bg-zinc-100/80 shadow-2xs'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <div
                                className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 border transition-all ${
                                  chapter.isRead
                                    ? 'bg-zinc-900 border-zinc-900 text-white'
                                    : 'border-zinc-300 bg-white'
                                }`}
                              >
                                {chapter.isRead && <Check className="w-3.5 h-3.5 stroke-[3] text-white" />}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <div
                                    className={`truncate ${
                                      chapter.isRead ? 'line-through opacity-75 text-zinc-500' : 'text-zinc-900'
                                    }`}
                                  >
                                    <RomanChapterText title={chapter.title} romanSize="text-[18px]" isRead={chapter.isRead} />
                                  </div>
                                  <span
                                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md font-mono tracking-tight shrink-0 ${
                                      chapter.isRead
                                        ? 'bg-zinc-200 text-zinc-600'
                                        : 'bg-zinc-200/90 text-zinc-800 border border-zinc-300/70'
                                    }`}
                                    title={`Contiene ${chapterPages} páginas`}
                                  >
                                    {chapterPages} {chapterPages === 1 ? 'pág' : 'págs'}
                                  </span>
                                </div>
                                <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold text-zinc-700 bg-zinc-100 px-1.5 py-0.5 rounded border border-zinc-250 whitespace-nowrap shrink-0 mt-0.5">
                                  <span className="text-[9px] font-sans font-bold text-zinc-500 uppercase">Págs</span>
                                  <span>{chapter.startPage} – {chapter.endPage}</span>
                                </span>
                              </div>
                            </div>

                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                                chapter.isRead
                                  ? 'bg-zinc-900 text-white border border-zinc-900'
                                  : 'bg-zinc-200 text-zinc-800 border border-zinc-300'
                              }`}
                            >
                              {chapter.isRead ? 'Leído' : 'Pendiente'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Any unassigned chapters */}
            {(activeBook.chapters || []).some((c) => !c.part || !(activeBook.parts || []).includes(c.part)) && (
              <div className="space-y-1.5 bg-zinc-50/70 p-2.5 rounded-2xl border border-dashed border-zinc-300">
                <span className="font-extrabold text-zinc-600 text-xs px-1">Sin Parte Asignada</span>
                <div className="space-y-1.5">
                  {(activeBook.chapters || [])
                    .filter((c) => !c.part || !(activeBook.parts || []).includes(c.part))
                    .map((chapter) => {
                      const chapterPages = Math.max(1, chapter.endPage - chapter.startPage + 1);

                      return (
                        <div
                          key={chapter.id}
                          onClick={() => onToggleChapterRead(activeBook.id, chapter.id)}
                          className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                            chapter.isRead
                              ? 'bg-zinc-100 border-zinc-300 text-zinc-600'
                              : 'bg-white border-zinc-200 text-zinc-900 hover:bg-zinc-100/80 shadow-2xs'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div
                              className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 border transition-all ${
                                chapter.isRead
                                  ? 'bg-zinc-900 border-zinc-900 text-white'
                                  : 'border-zinc-300 bg-white'
                              }`}
                            >
                              {chapter.isRead && <Check className="w-3.5 h-3.5 stroke-[3] text-white" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <div
                                  className={`truncate ${
                                    chapter.isRead ? 'line-through opacity-75 text-zinc-500' : 'text-zinc-900'
                                  }`}
                                >
                                  <RomanChapterText title={chapter.title} romanSize="text-[18px]" isRead={chapter.isRead} />
                                </div>
                                <span
                                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md font-mono tracking-tight shrink-0 ${
                                    chapter.isRead
                                      ? 'bg-zinc-200 text-zinc-600'
                                      : 'bg-zinc-200/90 text-zinc-800 border border-zinc-300/70'
                                  }`}
                                  title={`Contiene ${chapterPages} páginas`}
                                >
                                  {chapterPages} {chapterPages === 1 ? 'pág' : 'págs'}
                                </span>
                              </div>
                              <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold text-zinc-700 bg-zinc-100 px-1.5 py-0.5 rounded border border-zinc-250 whitespace-nowrap shrink-0 mt-0.5">
                                <span className="text-[9px] font-sans font-bold text-zinc-500 uppercase">Págs</span>
                                <span>{chapter.startPage} – {chapter.endPage}</span>
                              </span>
                            </div>
                          </div>

                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                              chapter.isRead
                                ? 'bg-zinc-900 text-white border border-zinc-900'
                                : 'bg-zinc-200 text-zinc-800 border border-zinc-300'
                            }`}
                          >
                            {chapter.isRead ? 'Leído' : 'Pendiente'}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {(activeBook.chapters || []).map((chapter) => {
              const chapterPages = Math.max(1, chapter.endPage - chapter.startPage + 1);

              return (
                <div
                  key={chapter.id}
                  onClick={() => onToggleChapterRead(activeBook.id, chapter.id)}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    chapter.isRead
                      ? 'bg-zinc-100 border-zinc-300 text-zinc-600'
                      : 'bg-zinc-50/70 border-zinc-200 text-zinc-900 hover:bg-zinc-100'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div
                      className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 border transition-all ${
                        chapter.isRead
                          ? 'bg-zinc-900 border-zinc-900 text-white'
                          : 'border-zinc-300 bg-white'
                      }`}
                    >
                      {chapter.isRead && <Check className="w-3.5 h-3.5 stroke-[3] text-white" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div
                          className={`truncate ${
                            chapter.isRead ? 'line-through opacity-75 text-zinc-500' : 'text-zinc-900'
                          }`}
                        >
                          <RomanChapterText title={chapter.title} romanSize="text-[18px]" isRead={chapter.isRead} />
                        </div>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md font-mono tracking-tight shrink-0 ${
                            chapter.isRead
                              ? 'bg-zinc-200 text-zinc-600'
                              : 'bg-zinc-200/90 text-zinc-800 border border-zinc-300/70'
                          }`}
                          title={`Contiene ${chapterPages} páginas`}
                        >
                          {chapterPages} {chapterPages === 1 ? 'pág' : 'págs'}
                        </span>
                      </div>
                      <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold text-zinc-700 bg-zinc-100 px-1.5 py-0.5 rounded border border-zinc-250 whitespace-nowrap shrink-0 mt-0.5">
                        <span className="text-[9px] font-sans font-bold text-zinc-500 uppercase">Págs</span>
                        <span>{chapter.startPage} – {chapter.endPage}</span>
                      </span>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                      chapter.isRead
                        ? 'bg-zinc-900 text-white border border-zinc-900'
                        : 'bg-zinc-200 text-zinc-800 border border-zinc-300'
                    }`}
                  >
                    {chapter.isRead ? 'Leído' : 'Pendiente'}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {(activeBook.chapters || []).length > 0 && (
          <div className="pt-3 mt-2 border-t border-zinc-100 flex justify-end">
            <button
              onClick={() => onOpenChaptersModal(activeBook)}
              className="text-xs font-bold text-zinc-900 hover:underline flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Agregar más capítulos
            </button>
          </div>
        )}
      </div>

      {/* Switch active book helper */}
      {pendingBooks.length > 0 && (
        <div className="text-center pt-1">
          <button
            onClick={() => setShowSwitchBookModal(!showSwitchBookModal)}
            className="text-xs font-bold text-zinc-700 hover:text-zinc-950 underline"
          >
            {showSwitchBookModal ? 'Ocultar otros libros' : 'Cambiar a otro libro de mi biblioteca'}
          </button>

          {showSwitchBookModal && (
            <div className="mt-3 bg-white rounded-2xl p-3 border border-zinc-200 shadow-xs space-y-2">
              {pendingBooks.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between p-2 hover:bg-zinc-50 rounded-xl transition-colors text-left"
                >
                  <div className="truncate mr-2">
                    <p className="text-xs font-bold text-zinc-900 truncate">{b.title}</p>
                    <p className="text-[10px] text-zinc-500">{b.author}</p>
                  </div>
                  <button
                    onClick={() => {
                      onSelectActiveBook(b.id);
                      setShowSwitchBookModal(false);
                    }}
                    className="px-2.5 py-1 bg-zinc-200 text-zinc-900 text-[11px] font-bold rounded-lg hover:bg-zinc-900 hover:text-white transition-colors shrink-0"
                  >
                    Activar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Cover Search Modal for Active Book */}
      {activeBook && (
        <CoverSearchModal
          isOpen={isCoverSearchOpen}
          initialTitle={activeBook.title}
          initialAuthor={activeBook.author}
          onClose={() => setIsCoverSearchOpen(false)}
          onSelectCover={(coverUrl) => {
            if (onUpdateBookCover) {
              onUpdateBookCover(activeBook.id, coverUrl);
            }
          }}
        />
      )}
    </div>
  );
};
