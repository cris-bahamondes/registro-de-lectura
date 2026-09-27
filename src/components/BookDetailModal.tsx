import React, { useMemo, useState } from 'react';
import { Book, BookStatus } from '../types';
import { StarRating } from './StarRating';
import { getBookGenres } from '../lib/genreUtils';
import { formatChapterDisplayTitle } from '../lib/romanUtils';
import { RomanChapterText } from './RomanChapterText';
import { calculateBookActiveReadingDays, formatReadingDays } from '../lib/readingDaysUtils';
import { CoverSearchModal } from './CoverSearchModal';
import { BookCoverImage } from './BookCoverImage';
import {
  X,
  Edit2,
  BookOpen,
  Calendar,
  Clock,
  Tag,
  Layers,
  CheckCircle2,
  Pause,
  AlertCircle,
  BookMarked,
  Info,
  Check,
  Search,
  Sparkles,
  Camera,
} from 'lucide-react';

interface BookDetailModalProps {
  book: Book | null;
  isOpen: boolean;
  allBooks?: Book[];
  onClose: () => void;
  onEdit: (book: Book) => void;
  onUpdateCover?: (bookId: string, coverUrl: string) => void;
  onSelectBook?: (book: Book) => void;
  onOpenChaptersModal?: (book: Book) => void;
  onRemoveStartDate?: (bookId: string) => void;
  onRemoveEndDate?: (bookId: string) => void;
  onUpdateStartDate?: (bookId: string, newDate: string) => void;
  onUpdateEndDate?: (bookId: string, newDate: string) => void;
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const formatDatePretty = (dateStr?: string): string | null => {
  if (!dateStr) return null;
  const parts = dateStr.split(/[-/]/);
  if (parts.length >= 3) {
    // Standard YYYY-MM-DD
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    if (!isNaN(y) && m >= 0 && m <= 11 && !isNaN(d)) {
      return `${d} de ${MONTH_NAMES[m]} de ${y}`;
    }
  }
  return dateStr;
};

const getStatusBadge = (status?: string) => {
  switch (status) {
    case 'leido':
    case 'read':
    case 'terminado':
      return {
        label: 'Leído',
        icon: CheckCircle2,
        bg: 'bg-emerald-100 text-emerald-900 border-emerald-300',
        badgeColor: 'bg-emerald-600 text-white',
      };
    case 'leyendo':
    case 'reading':
    case 'en_progreso':
      return {
        label: 'Leyendo actualmente',
        icon: BookOpen,
        bg: 'bg-zinc-900 text-white border-zinc-900',
        badgeColor: 'bg-zinc-900 text-white',
      };
    case 'pausado':
    case 'paused':
      return {
        label: 'Lectura pausada',
        icon: Pause,
        bg: 'bg-amber-100 text-amber-900 border-amber-300',
        badgeColor: 'bg-amber-500 text-white',
      };
    case 'abandonado':
    case 'abandoned':
    case 'dropped':
      return {
        label: 'Abandonado',
        icon: AlertCircle,
        bg: 'bg-neutral-100 text-neutral-600 border-neutral-300',
        badgeColor: 'bg-neutral-500 text-white',
      };
    case 'pendiente':
    case 'pending':
    case 'unread':
    default:
      return {
        label: 'Pendiente de leer',
        icon: Clock,
        bg: 'bg-zinc-100 text-zinc-700 border-zinc-200',
        badgeColor: 'bg-zinc-600 text-white',
      };
  }
};

const getReadingDuration = (book: Book): string | null => {
  if (book.status === 'pendiente') return null;
  const days = calculateBookActiveReadingDays(book);
  if (days <= 0) return null;
  return formatReadingDays(days);
};

export const BookDetailModal: React.FC<BookDetailModalProps> = ({
  book,
  isOpen,
  allBooks = [],
  onClose,
  onEdit,
  onUpdateCover,
  onSelectBook,
  onOpenChaptersModal,
  onRemoveStartDate,
  onRemoveEndDate,
  onUpdateStartDate,
  onUpdateEndDate,
}) => {
  const [isCoverSearchOpen, setIsCoverSearchOpen] = useState(false);

  const sagaBooks = useMemo(() => {
    if (!book?.saga || !allBooks.length) return [];
    return allBooks
      .filter(
        (b) =>
          b.saga &&
          b.saga.trim().toLowerCase() === book.saga!.trim().toLowerCase()
      )
      .sort((a, b) => {
        const orderA = a.sagaOrder ?? 9999;
        const orderB = b.sagaOrder ?? 9999;
        if (orderA !== orderB) return orderA - orderB;
        return a.title.localeCompare(b.title);
      });
  }, [book?.saga, allBooks]);

  if (!isOpen || !book) return null;

  const statusInfo = getStatusBadge(book.status);
  const StatusIcon = statusInfo.icon;
  const genres = getBookGenres(book);
  const readingDuration = getReadingDuration(book);

  const percentage =
    book.totalPages > 0
      ? Math.min(100, Math.round((book.currentPage / book.totalPages) * 100))
      : 0;

  const remainingPages = Math.max(0, book.totalPages - book.currentPage);
  const hasChapters = Array.isArray(book.chapters) && book.chapters.length > 0;
  const readChaptersCount = (book.chapters || []).filter((c) => c.isRead).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl border border-zinc-200 overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Bar */}
        <div className="p-4 sm:p-5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/80">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-zinc-900 text-white flex items-center justify-center shadow-xs">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-900 leading-tight">
                Ficha del Libro
              </h2>
              <p className="text-[11px] text-zinc-500 font-medium">
                Información detallada • Vista de solo lectura
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                onClose();
                onEdit(book);
              }}
              className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 active:scale-95 cursor-pointer"
              title="Editar los datos de este libro"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Editar</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-zinc-200 text-zinc-400 hover:text-zinc-700 transition-colors cursor-pointer"
              aria-label="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 no-scrollbar">
          {/* Main Book Header Card */}
          <div className="flex gap-4 items-start">
            {/* Cover image */}
            <div className="w-28 sm:w-32 aspect-[3/4.4] rounded-2xl overflow-hidden shadow-md shrink-0 bg-zinc-100 relative border border-zinc-200 group">
              {book.coverImage ? (
                <>
                  <BookCoverImage
                    src={book.coverImage}
                    alt={book.title}
                    bookId={book.id}
                    fallbackTitle={book.title}
                    coverColor={book.coverColor}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setIsCoverSearchOpen(true)}
                    className="absolute inset-0 bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 text-[10px] font-bold p-1 cursor-pointer"
                  >
                    <Search className="w-4 h-4" />
                    <span>Cambiar portada</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsCoverSearchOpen(true)}
                  className="w-full h-full flex flex-col items-center justify-center p-2.5 text-center bg-zinc-100 hover:bg-amber-50/60 transition-colors cursor-pointer group"
                >
                  <BookOpen className="w-7 h-7 text-zinc-400 group-hover:text-amber-600 mb-1 transition-colors" />
                  <span className="text-[10px] font-bold text-zinc-800 line-clamp-2 leading-tight">
                    {book.title}
                  </span>
                  <span className="mt-1.5 inline-flex items-center gap-1 text-[9px] font-bold text-amber-800 bg-amber-100/90 px-2 py-0.5 rounded-full border border-amber-300 shadow-2xs">
                    <Search className="w-2.5 h-2.5" />
                    <span>Buscar</span>
                  </span>
                </button>
              )}

              {/* Format Badge */}
              <span className="absolute bottom-2 right-2 text-[9px] font-extrabold px-1.5 py-0.5 rounded-md bg-black/75 text-white backdrop-blur-xs uppercase pointer-events-none">
                {book.format === 'digital' ? 'Digital' : 'Físico'}
              </span>
            </div>

            {/* Book Meta Details */}
            <div className="flex-1 min-w-0 space-y-1.5">
              {/* Status Badge */}
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border shadow-2xs leading-none" style={{}}>
                <span className={`inline-flex items-center gap-1 font-bold ${statusInfo.bg} px-2 py-0.5 rounded-full border`}>
                  <StatusIcon className="w-3 h-3" />
                  <span>{statusInfo.label}</span>
                </span>
              </div>

              {/* Title & Author */}
              <div>
                <h1 className="text-base sm:text-lg font-black text-zinc-900 leading-tight">
                  {book.title}
                </h1>
                <p className="text-xs sm:text-sm font-semibold text-zinc-600 mt-0.5">
                  por {book.author}
                </p>
              </div>

              {/* Quick cover finder button if missing cover */}
              {!book.coverImage && (
                <button
                  type="button"
                  onClick={() => setIsCoverSearchOpen(true)}
                  className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2.5 py-1 rounded-xl transition-colors shadow-2xs cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>Buscar portada online</span>
                </button>
              )}

              {/* Saga */}
              {book.saga && (
                <div className="inline-flex items-center flex-wrap gap-1.5 text-xs text-zinc-800 bg-zinc-100 px-2.5 py-1 rounded-xl border border-zinc-200 font-semibold">
                  <BookMarked className="w-3.5 h-3.5 text-zinc-700 shrink-0" />
                  <span className="truncate">Saga: {book.saga}</span>
                  {book.sagaOrder !== undefined && book.sagaOrder !== null && (
                    <span className="px-1.5 py-0.5 rounded-md bg-zinc-900 text-white font-bold text-[10px]">
                      Libro #{book.sagaOrder}
                    </span>
                  )}
                </div>
              )}

              {/* Star Rating */}
              <div className="flex items-center gap-2 pt-1">
                <StarRating rating={book.status === 'leido' ? (book.rating || 0) : 0} size="md" />
                <span className="text-xs font-bold text-zinc-700">
                  {book.status === 'leido' && book.rating > 0 ? `${book.rating} / 5` : 'Sin puntaje'}
                </span>
              </div>
            </div>
          </div>

          {/* Reading Progress Block */}
          <div className="bg-zinc-50 rounded-2xl p-3.5 border border-zinc-200 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-zinc-700">Progreso de lectura</span>
              <span className="text-zinc-900">{percentage}%</span>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-zinc-200 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-zinc-900 h-full rounded-full transition-all duration-300"
                style={{ width: `${percentage}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-zinc-500 font-medium">
              <span>
                Página <strong className="text-zinc-800">{book.currentPage}</strong> de{' '}
                <strong className="text-zinc-800">{book.totalPages}</strong>
              </span>
              <span>
                {book.status === 'leido' ? (
                  <span className="font-bold text-emerald-700">¡Libro completado!</span>
                ) : remainingPages > 0 ? (
                  <span>Faltan {remainingPages} págs</span>
                ) : (
                  <span>Completado</span>
                )}
              </span>
            </div>
          </div>

          {/* Literary Genres Tags */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-900">
              <Tag className="w-3.5 h-3.5 text-zinc-700" />
              <span>Géneros literarios</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {genres.length > 0 ? (
                genres.map((genre) => (
                  <span
                    key={genre}
                    className="inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-semibold bg-zinc-100 text-zinc-800 border border-zinc-200"
                  >
                    {genre}
                  </span>
                ))
              ) : (
                <span className="text-xs text-zinc-400 italic">Sin género asignado</span>
              )}
            </div>
          </div>

          {/* Small Description / Sinopsis (up to 500 chars) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-zinc-700" />
                <span>Descripción / Sinopsis</span>
              </span>
              {book.description && (
                <span className="text-[10px] text-zinc-400 font-mono font-medium">
                  {book.description.length} caracteres
                </span>
              )}
            </div>

            {book.description && book.description.trim() ? (
              <div className="bg-zinc-50 rounded-2xl p-3.5 border border-zinc-200 text-xs text-zinc-700 leading-relaxed italic relative">
                <span className="text-zinc-300 font-serif text-3xl absolute top-1 left-2 select-none leading-none">
                  “
                </span>
                <p className="relative z-10 pl-3 whitespace-pre-wrap font-serif">
                  {book.description}
                </p>
              </div>
            ) : (
              <div className="bg-zinc-50/50 rounded-2xl p-3 border border-dashed border-zinc-200 text-center">
                <p className="text-xs text-zinc-400 italic">
                  Este libro no tiene descripción registrada (campo opcional).
                </p>
              </div>
            )}
          </div>

          {/* Reading Dates & Stats */}
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-zinc-700" />
              <span>Fechas y duración de lectura</span>
            </span>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-zinc-50 rounded-xl p-2.5 border border-zinc-200">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                    Fecha de Inicio
                  </span>
                  {book.startDate && onRemoveStartDate && (
                    <button
                      type="button"
                      onClick={() => onRemoveStartDate(book.id)}
                      className="text-[9px] font-bold text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                      title="Eliminar fecha de inicio"
                    >
                      Quitar
                    </button>
                  )}
                </div>
                {onUpdateStartDate ? (
                  <input
                    type="date"
                    value={book.startDate || ''}
                    onChange={(e) => onUpdateStartDate(book.id, e.target.value)}
                    className="w-full text-xs font-semibold text-zinc-900 bg-white border border-zinc-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-zinc-800"
                  />
                ) : (
                  <p className="font-semibold text-zinc-800">
                    {formatDatePretty(book.startDate) || 'No registrada'}
                  </p>
                )}
              </div>

              <div className="bg-zinc-50 rounded-xl p-2.5 border border-zinc-200">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                    Fecha de Término
                  </span>
                  {book.endDate && onRemoveEndDate && (
                    <button
                      type="button"
                      onClick={() => onRemoveEndDate(book.id)}
                      className="text-[9px] font-bold text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                      title="Eliminar fecha de término"
                    >
                      Quitar
                    </button>
                  )}
                </div>
                {onUpdateEndDate ? (
                  <input
                    type="date"
                    value={book.endDate || ''}
                    onChange={(e) => onUpdateEndDate(book.id, e.target.value)}
                    className="w-full text-xs font-semibold text-zinc-900 bg-white border border-zinc-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-zinc-800"
                  />
                ) : (
                  <p className="font-semibold text-zinc-800">
                    {formatDatePretty(book.endDate) || 'No registrada'}
                  </p>
                )}
              </div>

              {readingDuration && (
                <div className="bg-zinc-50 rounded-xl p-2.5 border border-zinc-200">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-0.5">
                    Tiempo de Lectura
                  </span>
                  <p className="font-semibold text-zinc-800 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-zinc-600" />
                    <span>{readingDuration}</span>
                  </p>
                </div>
              )}

              {book.readYear && (
                <div className="bg-zinc-50 rounded-xl p-2.5 border border-zinc-200">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-0.5">
                    Año de Lectura
                  </span>
                  <p className="font-semibold text-zinc-800">{book.readYear}</p>
                </div>
              )}
            </div>
          </div>

          {/* Saga Reading Order List */}
          {book.saga && sagaBooks.length > 0 && (
            <div className="bg-zinc-50 rounded-2xl p-3.5 border border-zinc-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-900">
                  <BookMarked className="w-3.5 h-3.5 text-zinc-800 shrink-0" />
                  <span className="truncate">Saga: {book.saga}</span>
                </div>
                <span className="text-[10px] font-bold text-zinc-500">
                  Orden de lectura ({sagaBooks.length} {sagaBooks.length === 1 ? 'libro' : 'libros'})
                </span>
              </div>

              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {sagaBooks.map((sb) => {
                  const isCurrent = sb.id === book.id;
                  const sbStatus = getStatusBadge(sb.status);
                  return (
                    <div
                      key={sb.id}
                      onClick={() => {
                        if (!isCurrent && onSelectBook) {
                          onSelectBook(sb);
                        }
                      }}
                      className={`flex items-center justify-between p-2 rounded-xl border transition-all text-xs ${
                        isCurrent
                          ? 'bg-zinc-900 text-white border-zinc-900 shadow-xs'
                          : onSelectBook
                          ? 'bg-white hover:bg-zinc-100 text-zinc-800 border-zinc-200 cursor-pointer shadow-2xs'
                          : 'bg-white text-zinc-800 border-zinc-200'
                      }`}
                      title={isCurrent ? 'Libro actual' : `Ver ficha de "${sb.title}"`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span
                          className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-[11px] shrink-0 ${
                            isCurrent
                              ? 'bg-white text-zinc-900'
                              : 'bg-zinc-100 text-zinc-800 border border-zinc-200'
                          }`}
                        >
                          {sb.sagaOrder !== undefined && sb.sagaOrder !== null ? `#${sb.sagaOrder}` : '•'}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className={`font-bold truncate leading-tight ${isCurrent ? 'text-white' : 'text-zinc-900'}`}>
                            {sb.title}
                          </p>
                          <p className={`text-[10px] truncate leading-tight ${isCurrent ? 'text-zinc-300' : 'text-zinc-500'}`}>
                            {sb.author}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                            isCurrent
                              ? 'bg-white/20 text-white'
                              : `${sbStatus.bg}`
                          }`}
                        >
                          {sbStatus.label}
                        </span>
                        {isCurrent && (
                          <span className="text-[9px] font-black text-amber-300 bg-black/40 px-1.5 py-0.5 rounded-full">
                            Actual
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Chapters & Parts (if book has chapters) */}
          {hasChapters && (
            <div className="bg-zinc-50 rounded-2xl p-3.5 border border-zinc-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-900">
                  <Layers className="w-3.5 h-3.5 text-zinc-700" />
                  <span>Capítulos ({book.chapters?.length || 0})</span>
                </div>
                <span className="text-xs font-bold text-zinc-600">
                  {readChaptersCount} de {book.chapters?.length} leídos
                </span>
              </div>

              {/* Mini Chapter list snippet */}
              <div className="max-h-40 overflow-y-auto space-y-1 pr-1 text-xs">
                {book.chapters?.slice(0, 8).map((ch, idx) => (
                  <div
                    key={ch.id || idx}
                    className={`flex items-center justify-between p-1.5 rounded-lg text-[11px] ${
                      ch.isRead ? 'bg-emerald-50 text-emerald-900 font-medium' : 'bg-white text-zinc-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span
                        className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 text-[9px] ${
                          ch.isRead ? 'bg-emerald-600 text-white font-bold' : 'bg-zinc-200 text-zinc-500'
                        }`}
                      >
                        {ch.isRead ? <Check className="w-2.5 h-2.5 stroke-[3]" /> : idx + 1}
                      </span>
                      <span className={`truncate ${ch.isRead ? 'line-through text-zinc-500' : ''}`}>
                        <RomanChapterText text={formatChapterDisplayTitle(ch.title)} isRead={ch.isRead} />
                      </span>
                    </div>
                    <span className="text-zinc-400 shrink-0 text-[10px]">
                      {ch.endPage >= ch.startPage ? `${ch.endPage - ch.startPage + 1} págs` : ''}
                    </span>
                  </div>
                ))}
                {(book.chapters?.length || 0) > 8 && (
                  <p className="text-[10px] text-zinc-400 text-center pt-1 font-medium">
                    + {(book.chapters?.length || 0) - 8} capítulos más
                  </p>
                )}
              </div>

              {onOpenChaptersModal && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenChaptersModal(book);
                  }}
                  className="w-full py-1.5 rounded-xl bg-white border border-zinc-300 text-xs font-bold text-zinc-800 hover:bg-zinc-100 transition-colors flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Ver y gestionar todos los capítulos</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3 sm:p-4 border-t border-zinc-100 bg-white flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-zinc-200 hover:bg-zinc-100 text-zinc-700 text-xs font-bold transition-all text-center cursor-pointer"
          >
            Cerrar ficha
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onEdit(book);
            }}
            className="flex-1 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold transition-all text-center shadow-xs flex items-center justify-center gap-2 cursor-pointer active:scale-95"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Editar ficha</span>
          </button>
        </div>
      </div>

      {/* Online Cover Search Modal */}
      <CoverSearchModal
        isOpen={isCoverSearchOpen}
        initialTitle={book.title}
        initialAuthor={book.author}
        onClose={() => setIsCoverSearchOpen(false)}
        onSelectCover={(selectedUrl) => {
          if (onUpdateCover) {
            onUpdateCover(book.id, selectedUrl);
          } else {
            onEdit({ ...book, coverImage: selectedUrl });
          }
        }}
      />
    </div>
  );
};
