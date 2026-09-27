import React from 'react';
import { Book } from '../types';
import { BookOpen, Plus, Play, ChevronRight, X, Layers, CheckCircle2 } from 'lucide-react';
import { StarRating } from './StarRating';
import { formatBookGenres } from '../lib/genreUtils';
import { BookCoverImage } from './BookCoverImage';

interface ParallelBooksModalProps {
  isOpen: boolean;
  onClose: () => void;
  booksReading: Book[];
  activeBookId: string | null;
  onSelectActiveBook: (bookId: string) => void;
  onOpenAddBookModal: () => void;
  onViewBookDetail?: (book: Book) => void;
}

export const ParallelBooksModal: React.FC<ParallelBooksModalProps> = ({
  isOpen,
  onClose,
  booksReading,
  activeBookId,
  onSelectActiveBook,
  onOpenAddBookModal,
  onViewBookDetail,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs p-3 sm:p-4 flex items-center justify-center animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-zinc-200 flex flex-col my-auto text-left animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 bg-zinc-50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-zinc-900 text-white flex items-center justify-center shadow-xs">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-zinc-900 tracking-tight">
                LIBROS EN LECTURA PARALELA
              </h2>
              <p className="text-[11px] text-zinc-600 font-bold">
                {booksReading.length} {booksReading.length === 1 ? 'libro en lectura' : 'libros leyéndose a la vez'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-zinc-200 text-zinc-400 hover:text-zinc-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3 overscroll-contain">
          {booksReading.length === 0 ? (
            <div className="py-8 text-center bg-zinc-50 rounded-2xl border border-dashed border-zinc-300 p-4">
              <BookOpen className="w-10 h-10 mx-auto text-zinc-400 mb-2" />
              <p className="text-xs font-bold text-zinc-700">No tienes ningún libro en estado de lectura activa.</p>
              <p className="text-[11px] text-zinc-400 mt-1">
                Puedes registrar un nuevo libro o activar uno desde tu biblioteca.
              </p>
            </div>
          ) : (
            booksReading.map((book) => {
              const isCurrent = book.id === activeBookId;
              const percentage = Math.min(100, Math.round((book.currentPage / book.totalPages) * 100)) || 0;
              const completedChapters = (book.chapters || []).filter((c) => c.isRead).length;

              return (
                <div
                  key={book.id}
                  onClick={() => {
                    onSelectActiveBook(book.id);
                    onClose();
                  }}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 group relative ${
                    isCurrent
                      ? 'bg-zinc-100 border-zinc-900 shadow-xs ring-1 ring-zinc-900/30'
                      : 'bg-white border-zinc-200 hover:border-zinc-400 hover:bg-zinc-50 shadow-2xs'
                  }`}
                >
                  {/* Cover Preview (Tocar para ver ficha completa) */}
                  <div
                    onClick={(e) => {
                      if (onViewBookDetail) {
                        e.stopPropagation();
                        onViewBookDetail(book);
                      }
                    }}
                    className="w-12 h-16 rounded-lg bg-zinc-100 overflow-hidden shrink-0 shadow-2xs border border-zinc-200 relative cursor-pointer hover:opacity-90 active:scale-95 transition-all group/cover"
                    title="Toca para ver ficha completa del libro"
                  >
                    <BookCoverImage
                      src={book.coverImage}
                      alt={book.title}
                      bookId={book.id}
                      fallbackTitle={book.title}
                      coverColor={book.coverColor}
                      className="w-full h-full object-cover group-hover/cover:scale-105 transition-transform duration-300"
                    />
                    <span className="absolute bottom-0.5 right-0.5 text-[7px] font-bold px-1 rounded-xs bg-black/70 text-white uppercase">
                      {book.format === 'digital' ? 'DIG' : 'FÍS'}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {isCurrent ? (
                        <span className="text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-zinc-900 text-white">
                          En pantalla
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-zinc-200 text-zinc-800">
                          Lectura paralela
                        </span>
                      )}
                      <span className="text-[9px] text-zinc-500 font-semibold truncate max-w-[120px]">
                        {formatBookGenres(book)}
                      </span>
                    </div>

                    <h3 className="font-extrabold text-xs text-zinc-900 truncate group-hover:text-black">
                      {book.title}
                    </h3>
                    <p className="text-[11px] text-zinc-500 truncate">{book.author}</p>
                    {book.description && (
                      <p className="text-[10px] text-zinc-400 italic line-clamp-1 mt-0.5" title={book.description}>
                        {book.description}
                      </p>
                    )}

                    {/* Progress mini bar */}
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 h-2 bg-zinc-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-zinc-800 rounded-full"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-extrabold text-zinc-900 shrink-0">
                        {percentage}% ({book.currentPage}/{book.totalPages})
                      </span>
                    </div>
                  </div>

                  {/* Action */}
                  <div className="shrink-0 flex items-center">
                    <button
                      type="button"
                      className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1 ${
                        isCurrent
                          ? 'bg-zinc-900 text-white shadow-2xs'
                          : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-900 border border-zinc-200 shadow-2xs group-hover:scale-105'
                      }`}
                    >
                      {isCurrent ? 'Leyendo' : 'Ver'}
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer with Button to Add another book */}
        <div className="p-4 border-t border-zinc-200 bg-zinc-50 shrink-0 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-4 rounded-xl bg-zinc-200 hover:bg-zinc-300 text-zinc-800 font-bold text-xs transition-colors"
          >
            Cerrar
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenAddBookModal();
            }}
            className="flex-1 py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-black text-xs shadow-xs hover:shadow-md active:scale-98 transition-all flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            Añadir Nuevo Libro
          </button>
        </div>
      </div>
    </div>
  );
};
