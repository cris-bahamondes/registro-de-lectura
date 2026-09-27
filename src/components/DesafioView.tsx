import React, { useState, useMemo } from 'react';
import { Book, AnnualChallenge, AnnualMonthChallenge, MonthChallengeBook } from '../types';
import { BookCoverImage } from './BookCoverImage';
import { areBooksDuplicate } from '../lib/syncService';
import {
  Trophy,
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  Layers,
  BookOpen,
  Plus,
  Edit3,
  Check,
  ChevronRight,
  Filter,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';

interface DesafioViewProps {
  annualChallenge: AnnualChallenge;
  availableYears?: number[];
  selectedYear?: number;
  onSelectYear?: (year: number) => void;
  onAddNewYear?: (year: number) => void;
  libraryBooks: Book[];
  onUpdateMonth: (updatedMonth: AnnualMonthChallenge) => void;
  onToggleBookRead: (monthNumber: number, bookId: string) => void;
  onOpenEditMonthModal: (month: AnnualMonthChallenge) => void;
  onSelectBookToRead?: (bookId: string) => void;
}

type MonthFilter = 'all' | 'cumplidos' | 'pendientes' | 'no_cumplidos';

export const DesafioView: React.FC<DesafioViewProps> = ({
  annualChallenge,
  availableYears = [2026, 2027],
  selectedYear = annualChallenge.year || 2026,
  onSelectYear,
  onAddNewYear,
  libraryBooks,
  onUpdateMonth,
  onToggleBookRead,
  onOpenEditMonthModal,
  onSelectBookToRead,
}) => {
  const [filter, setFilter] = useState<MonthFilter>('all');
  const [isAddingYear, setIsAddingYear] = useState(false);
  const [customYearInput, setCustomYearInput] = useState('');

  // Current date info
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthNumber = now.getMonth() + 1; // 1-12

  // 12 months array
  const months = useMemo(() => {
    return annualChallenge.months || [];
  }, [annualChallenge.months]);

  const handleCreateYear = (e: React.FormEvent) => {
    e.preventDefault();
    const yr = parseInt(customYearInput, 10);
    if (!isNaN(yr) && yr >= 2000 && yr <= 2100) {
      if (onAddNewYear) onAddNewYear(yr);
      if (onSelectYear) onSelectYear(yr);
      setCustomYearInput('');
      setIsAddingYear(false);
    }
  };

  // Helper to determine if a challenge book is effectively read either directly or via library match
  const isBookEffectivelyRead = (b: MonthChallengeBook): boolean => {
    if (b.isRead) return true;
    const matchId = b.bookId || b.id;
    const matched = libraryBooks.find(
      (lb) =>
        lb.id === matchId ||
        areBooksDuplicate(lb, {
          id: b.id,
          title: b.title,
          author: b.author,
          totalPages: b.totalPages,
          currentPage: 0,
          status: 'pendiente',
          category: 'General',
          format: 'fisico',
          rating: 0,
          chapters: [],
          createdAt: '',
          updatedAt: '',
        } as Book)
    );
    if (
      matched &&
      (matched.status === 'leido' ||
        (matched.totalPages > 0 && (matched.currentPage || 0) >= matched.totalPages) ||
        Boolean(matched.endDate && matched.endDate.trim().length > 0))
    ) {
      return true;
    }
    return false;
  };

  // Overall statistics:
  // "al inicio de la pantalla el poncentaje que se ve es el avance de libros leidos sobre el total de libros ingresados en el desafio"
  const stats = useMemo(() => {
    let totalEnteredBooks = 0;
    let totalReadBooks = 0;
    let fulfilledMonths = 0;
    let missedMonths = 0;
    let inProgressMonths = 0;
    let upcomingMonths = 0;

    months.forEach((m) => {
      const bList = m.books || [];
      totalEnteredBooks += bList.length;
      const readInMonth = bList.filter((b) => isBookEffectivelyRead(b)).length;
      totalReadBooks += readInMonth;

      const isAllRead = bList.length > 0 && readInMonth === bList.length;
      const isPast =
        selectedYear < currentYear ||
        (selectedYear === currentYear && m.monthNumber < currentMonthNumber);
      const isCurrent =
        selectedYear === currentYear && m.monthNumber === currentMonthNumber;

      if (isAllRead) {
        fulfilledMonths += 1;
      } else if (isPast) {
        missedMonths += 1;
      } else if (isCurrent) {
        inProgressMonths += 1;
      } else {
        upcomingMonths += 1;
      }
    });

    const overallPercentage =
      totalEnteredBooks > 0
        ? Math.min(100, Math.round((totalReadBooks / totalEnteredBooks) * 100))
        : 0;

    return {
      totalEnteredBooks,
      totalReadBooks,
      overallPercentage,
      fulfilledMonths,
      missedMonths,
      inProgressMonths,
      upcomingMonths,
    };
  }, [months, selectedYear, currentYear, currentMonthNumber, libraryBooks]);

  // Determine month status
  const getMonthStatus = (month: AnnualMonthChallenge) => {
    const bList = month.books || [];
    const readCount = bList.filter((b) => isBookEffectivelyRead(b)).length;
    const isAllRead = bList.length > 0 && readCount === bList.length;
    const isPast =
      selectedYear < currentYear ||
      (selectedYear === currentYear && month.monthNumber < currentMonthNumber);
    const isCurrent =
      selectedYear === currentYear && month.monthNumber === currentMonthNumber;

    if (isAllRead) return 'cumplido';
    if (isPast) return 'no_cumplido';
    if (isCurrent) return 'en_curso';
    return 'proximo';
  };

  const filteredMonths = useMemo(() => {
    if (filter === 'all') return months;
    if (filter === 'cumplidos') return months.filter((m) => getMonthStatus(m) === 'cumplido');
    if (filter === 'no_cumplidos') return months.filter((m) => getMonthStatus(m) === 'no_cumplido');
    if (filter === 'pendientes') {
      return months.filter((m) => {
        const s = getMonthStatus(m);
        return s === 'en_curso' || s === 'proximo';
      });
    }
    return months;
  }, [months, filter, selectedYear, currentYear, currentMonthNumber]);

  return (
    <div className="px-3.5 sm:px-4 py-4 space-y-5 max-w-2xl mx-auto pb-16 animate-in fade-in duration-200 text-left text-zinc-900 selection:bg-zinc-900 selection:text-white">
      {/* Year Switcher / Rollover Navigator */}
      <div className="flex items-center justify-between gap-2 flex-wrap bg-zinc-100 p-2 rounded-2xl border border-zinc-300 shadow-2xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-black text-zinc-700 uppercase tracking-wider px-1 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-zinc-700" />
            <span>Año:</span>
          </span>
          {availableYears.map((yr) => {
            const isSelected = yr === selectedYear;
            const isCalendarCurrent = yr === currentYear;
            return (
              <button
                key={yr}
                onClick={() => onSelectYear && onSelectYear(yr)}
                className={`px-3 py-1 rounded-xl text-xs font-black transition-all flex items-center gap-1 cursor-pointer ${
                  isSelected
                    ? 'bg-zinc-900 text-white shadow-xs scale-105'
                    : 'bg-white text-zinc-700 hover:bg-zinc-200 border border-zinc-200'
                }`}
              >
                <span>{yr}</span>
                {isCalendarCurrent && (
                  <span className={`text-[9px] px-1 py-0.2 rounded-md font-bold ${isSelected ? 'bg-zinc-700 text-zinc-200' : 'bg-zinc-200 text-zinc-700'}`}>
                    Actual
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Add another year option if desired */}
        {!isAddingYear ? (
          <button
            onClick={() => setIsAddingYear(true)}
            className="text-[11px] font-bold text-zinc-700 hover:text-zinc-950 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-zinc-200 transition-colors cursor-pointer"
          >
            <Plus className="w-3 h-3 stroke-[2.5]" />
            <span>Otro año</span>
          </button>
        ) : (
          <form onSubmit={handleCreateYear} className="flex items-center gap-1 animate-in fade-in duration-150">
            <input
              type="number"
              min="2000"
              max="2099"
              autoFocus
              value={customYearInput}
              onChange={(e) => setCustomYearInput(e.target.value)}
              placeholder="2028..."
              className="w-20 bg-white border border-zinc-300 rounded-lg px-2 py-0.5 text-xs font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
            />
            <button
              type="submit"
              disabled={!customYearInput}
              className="px-2 py-0.5 bg-zinc-900 text-white rounded-lg font-bold text-xs hover:bg-black disabled:opacity-40 cursor-pointer"
            >
              Ir
            </button>
            <button
              type="button"
              onClick={() => {
                setIsAddingYear(false);
                setCustomYearInput('');
              }}
              className="p-1 text-zinc-400 hover:text-zinc-700 rounded-lg cursor-pointer"
            >
              <XCircle className="w-3.5 h-3.5" />
            </button>
          </form>
        )}
      </div>

      {/* Top Banner / Hero Card in Monochrome Grayscale */}
      <div className="relative overflow-hidden bg-zinc-900 rounded-3xl p-5 sm:p-6 text-white shadow-xl border border-zinc-800">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="p-1.5 rounded-xl bg-zinc-800 text-zinc-200 border border-zinc-700/60 shadow-2xs">
                <Trophy className="w-4 h-4" />
              </span>
              <span className="text-[11px] uppercase tracking-widest font-black text-zinc-300">
                Desafío Anual {selectedYear}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              12 Meses · 12 Categorías
            </h1>
          </div>

          {/* Badge */}
          <div className="text-right">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-800 text-zinc-100 border border-zinc-700 text-xs font-black">
              <span>{stats.fulfilledMonths} de 12 meses</span>
            </span>
          </div>
        </div>

        {/* PRIMARY HIGHLIGHT: Percentage of books read over total books entered */}
        <div className="bg-zinc-950/90 rounded-2xl p-4 sm:p-5 border border-zinc-800/80 mb-4 shadow-inner">
          <div className="flex items-baseline justify-between gap-2 mb-2">
            <div>
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">
                Avance General del Desafío
              </span>
              <div className="text-3xl sm:text-4xl font-black text-white tracking-tight flex items-baseline gap-1.5 mt-0.5">
                <span>{stats.overallPercentage}%</span>
                <span className="text-xs font-semibold text-zinc-400">completado</span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs font-bold text-zinc-300 block">
                {stats.totalReadBooks} de {stats.totalEnteredBooks} libros
              </span>
              <span className="text-[11px] text-zinc-500 font-medium">
                registrados en el año
              </span>
            </div>
          </div>

          {/* Primary High-Contrast Grayscale Progress Bar */}
          <div className="w-full h-3.5 bg-zinc-800 rounded-full p-0.5 border border-zinc-700 overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-700 ease-out shadow-xs"
              style={{ width: `${stats.overallPercentage}%` }}
            />
          </div>
        </div>

        {/* Stats Summary Grid in Grayscale */}
        <div className="grid grid-cols-3 gap-2 text-center pt-1 border-t border-zinc-800">
          <div className="bg-zinc-800/60 rounded-xl p-2.5 border border-zinc-700/50">
            <div className="text-[10px] uppercase font-bold text-zinc-400">Cumplidos</div>
            <div className="text-base sm:text-lg font-black text-white mt-0.5">
              {stats.fulfilledMonths}
            </div>
          </div>
          <div className="bg-zinc-800/60 rounded-xl p-2.5 border border-zinc-700/50">
            <div className="text-[10px] uppercase font-bold text-zinc-400">En Curso / Pend.</div>
            <div className="text-base sm:text-lg font-black text-white mt-0.5">
              {stats.inProgressMonths + stats.upcomingMonths}
            </div>
          </div>
          <div className="bg-zinc-800/60 rounded-xl p-2.5 border border-zinc-700/50">
            <div className="text-[10px] uppercase font-bold text-zinc-400">No Cumplidos</div>
            <div className="text-base sm:text-lg font-black text-zinc-300 mt-0.5">
              {stats.missedMonths}
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Month Navigator in Grayscale */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 scrollbar-none">
        <div className="flex items-center gap-1.5 bg-zinc-200/80 p-1 rounded-2xl border border-zinc-300">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filter === 'all'
                ? 'bg-zinc-900 text-white shadow-xs'
                : 'text-zinc-700 hover:text-zinc-950 hover:bg-zinc-300/60'
            }`}
          >
            Todos (12)
          </button>
          <button
            onClick={() => setFilter('cumplidos')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filter === 'cumplidos'
                ? 'bg-zinc-900 text-white shadow-xs'
                : 'text-zinc-700 hover:text-zinc-950 hover:bg-zinc-300/60'
            }`}
          >
            Cumplidos ({stats.fulfilledMonths})
          </button>
          <button
            onClick={() => setFilter('pendientes')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filter === 'pendientes'
                ? 'bg-zinc-900 text-white shadow-xs'
                : 'text-zinc-700 hover:text-zinc-950 hover:bg-zinc-300/60'
            }`}
          >
            En Curso ({stats.inProgressMonths + stats.upcomingMonths})
          </button>
          {stats.missedMonths > 0 && (
            <button
              onClick={() => setFilter('no_cumplidos')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                filter === 'no_cumplidos'
                  ? 'bg-zinc-900 text-white shadow-xs'
                  : 'text-zinc-700 hover:text-zinc-950 hover:bg-zinc-300/60'
              }`}
            >
              No cumplidos ({stats.missedMonths})
            </button>
          )}
        </div>
      </div>

      {/* 12 Months Cards Container */}
      <div className="space-y-4">
        {filteredMonths.map((m) => {
          const status = getMonthStatus(m);
          const bList = m.books || [];
          const readCount = bList.filter((b) => b.isRead).length;
          const totalInMonth = bList.length;
          const monthProgressPercent =
            totalInMonth > 0 ? Math.round((readCount / totalInMonth) * 100) : 0;

          // Distinct Grayscale Card Styling based on status:
          // 1. "cumplido": Solid dark charcoal / black card with white text & crisp white checkmark
          // 2. "no_cumplido": Muted gray background, dashed border, clear "No cumplido" indicator
          // 3. "en_curso": Crisp white card with active thick black border
          // 4. "proximo": Clean light neutral card
          const isCumplido = status === 'cumplido';
          const isNoCumplido = status === 'no_cumplido';
          const isEnCurso = status === 'en_curso';

          return (
            <div
              key={`month-${m.monthNumber}`}
              className={`rounded-3xl p-4 sm:p-5 transition-all duration-200 border ${
                isCumplido
                  ? 'bg-zinc-900 text-white border-zinc-950 shadow-md'
                  : isNoCumplido
                  ? 'bg-zinc-200/90 border-2 border-dashed border-zinc-400 text-zinc-900 shadow-2xs'
                  : isEnCurso
                  ? 'bg-white text-zinc-900 border-2 border-zinc-900 shadow-md ring-2 ring-zinc-400/30'
                  : 'bg-zinc-50 text-zinc-900 border-zinc-300 shadow-2xs'
              }`}
            >
              {/* Month Header */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-start gap-3 min-w-0">
                  {/* Month Number Badge */}
                  <div
                    className={`w-9 h-9 rounded-2xl flex items-center justify-center font-black text-xs shrink-0 shadow-2xs ${
                      isCumplido
                        ? 'bg-white text-zinc-950'
                        : isNoCumplido
                        ? 'bg-zinc-400 text-zinc-950'
                        : isEnCurso
                        ? 'bg-zinc-900 text-white'
                        : 'bg-zinc-200 text-zinc-800'
                    }`}
                  >
                    {String(m.monthNumber).padStart(2, '0')}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2
                        className={`text-base sm:text-lg font-black leading-tight uppercase tracking-tight ${
                          isCumplido ? 'text-white' : 'text-zinc-950'
                        }`}
                      >
                        {m.monthName}
                      </h2>

                      {/* Status Tag */}
                      {isCumplido && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-0.5 rounded-full bg-white text-zinc-950 shadow-2xs">
                          <Check className="w-3 h-3 stroke-[3]" />
                          <span>CUMPLIDO</span>
                        </span>
                      )}

                      {isNoCumplido && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-0.5 rounded-full bg-zinc-300 text-zinc-800 border border-zinc-400">
                          <XCircle className="w-3 h-3" />
                          <span>NO CUMPLIDO</span>
                        </span>
                      )}

                      {isEnCurso && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-0.5 rounded-full bg-zinc-900 text-white shadow-2xs animate-pulse">
                          <Clock className="w-3 h-3" />
                          <span>MES EN CURSO</span>
                        </span>
                      )}

                      {status === 'proximo' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-200 text-zinc-700">
                          PRÓXIMO
                        </span>
                      )}
                    </div>

                    {/* Thematic Category Display with Edit Option */}
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Layers
                        className={`w-3.5 h-3.5 shrink-0 ${
                          isCumplido ? 'text-zinc-400' : 'text-zinc-600'
                        }`}
                      />
                      <span
                        className={`text-xs font-bold truncate ${
                          isCumplido ? 'text-zinc-300' : 'text-zinc-800'
                        }`}
                      >
                        {m.category || 'Categoría no definida'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Edit Button */}
                <button
                  onClick={() => onOpenEditMonthModal(m)}
                  className={`p-2 rounded-xl text-xs font-bold transition-colors shrink-0 flex items-center gap-1 ${
                    isCumplido
                      ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
                      : 'bg-zinc-200 hover:bg-zinc-300 text-zinc-800'
                  }`}
                  title="Editar categoría o libros de este mes"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Editar</span>
                </button>
              </div>

              {/* Month Mini Progress Bar */}
              <div className="space-y-1 mb-3.5">
                <div className="flex justify-between items-center text-[11px] font-bold">
                  <span className={isCumplido ? 'text-zinc-400' : 'text-zinc-600'}>
                    Progreso: {readCount} de {totalInMonth} libros leídos
                  </span>
                  <span
                    className={`font-black ${
                      isCumplido ? 'text-white' : 'text-zinc-950'
                    }`}
                  >
                    {monthProgressPercent}%
                  </span>
                </div>
                <div
                  className={`w-full h-2 rounded-full overflow-hidden ${
                    isCumplido ? 'bg-zinc-800' : 'bg-zinc-300'
                  }`}
                >
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isCumplido ? 'bg-white' : 'bg-zinc-900'
                    }`}
                    style={{ width: `${monthProgressPercent}%` }}
                  />
                </div>
              </div>

              {/* List of Books for this Month with Checkboxes */}
              <div className="space-y-2">
                {bList.length > 0 ? (
                  bList.map((book) => {
                    const effectiveRead = isBookEffectivelyRead(book);
                    return (
                      <div
                        key={book.id}
                        className={`flex items-center justify-between p-2.5 rounded-2xl border transition-all ${
                          isCumplido
                            ? effectiveRead
                              ? 'bg-zinc-800/90 border-zinc-700/80 text-zinc-100'
                              : 'bg-zinc-800/40 border-zinc-700 text-zinc-300'
                            : isNoCumplido
                            ? effectiveRead
                              ? 'bg-zinc-100/90 border-zinc-300 text-zinc-700'
                              : 'bg-zinc-300/80 border-zinc-400 text-zinc-900'
                            : effectiveRead
                            ? 'bg-zinc-100 border-zinc-300 text-zinc-800'
                            : 'bg-white border-zinc-300 text-zinc-950 shadow-2xs'
                        }`}
                      >
                        {/* Book Content + Checkbox */}
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {/* Checkbox Button */}
                          <button
                            type="button"
                            onClick={() => onToggleBookRead(m.monthNumber, book.id)}
                            className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border transition-all active:scale-95 ${
                              effectiveRead
                                ? isCumplido
                                  ? 'bg-white text-zinc-950 border-white shadow-2xs'
                                  : 'bg-zinc-900 text-white border-zinc-900 shadow-2xs'
                                : isCumplido
                                ? 'border-zinc-600 bg-zinc-800 hover:border-zinc-400'
                                : 'border-zinc-400 bg-white hover:border-zinc-700'
                            }`}
                            title={effectiveRead ? 'Marcar como no leído' : 'Marcar como leído'}
                          >
                            {effectiveRead && <Check className="w-4 h-4 stroke-[3]" />}
                          </button>

                          {/* Thumbnail if present or from library */}
                          {(() => {
                            const bookId = book.bookId || book.id;
                            const cover = book.coverImage || libraryBooks.find((lb) => lb.id === bookId)?.coverImage;
                            return (
                              <div className="w-8 h-11 rounded overflow-hidden shadow-2xs shrink-0 bg-zinc-200">
                                <BookCoverImage
                                  src={cover}
                                  alt={book.title}
                                  bookId={bookId}
                                  fallbackTitle={book.title}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            );
                          })()}

                          {/* Title & Author */}
                          <div className="min-w-0 flex-1">
                            <div
                              className={`text-xs font-bold truncate ${
                                effectiveRead
                                  ? isCumplido
                                    ? 'line-through text-zinc-400'
                                    : 'line-through text-zinc-500'
                                  : isCumplido
                                  ? 'text-white'
                                  : 'text-zinc-950'
                              }`}
                            >
                              {book.title}
                            </div>
                            <div
                              className={`text-[11px] truncate ${
                                isCumplido ? 'text-zinc-400' : 'text-zinc-600'
                              }`}
                            >
                              {book.author}
                              {book.totalPages ? ` · ${book.totalPages} pág.` : ''}
                            </div>
                          </div>
                        </div>

                        {/* Read status label */}
                        <div className="shrink-0 ml-2">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              effectiveRead
                                ? isCumplido
                                  ? 'bg-zinc-700 text-zinc-100'
                                  : 'bg-zinc-900 text-white'
                                : isCumplido
                                ? 'bg-zinc-800 text-zinc-400'
                                : 'bg-zinc-200 text-zinc-700'
                            }`}
                          >
                            {effectiveRead ? 'Leído' : 'Pendiente'}
                          </span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div
                    className={`p-3 rounded-2xl text-center text-xs italic border border-dashed ${
                      isCumplido
                        ? 'border-zinc-700 text-zinc-400 bg-zinc-800/40'
                        : 'border-zinc-300 text-zinc-500 bg-zinc-100/50'
                    }`}
                  >
                    No hay libros registrados para este mes.
                  </div>
                )}
              </div>

              {/* Bottom Month Action */}
              <div className="mt-3 pt-2.5 border-t border-zinc-700/30 flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => onOpenEditMonthModal(m)}
                  className={`text-xs font-bold flex items-center gap-1 transition-colors hover:underline ${
                    isCumplido ? 'text-zinc-300 hover:text-white' : 'text-zinc-800 hover:text-black'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Gestionar libros de {m.monthName}</span>
                </button>

                {m.notes && (
                  <span
                    className={`text-[11px] italic truncate max-w-[180px] sm:max-w-xs ${
                      isCumplido ? 'text-zinc-400' : 'text-zinc-500'
                    }`}
                    title={m.notes}
                  >
                    «{m.notes}»
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
