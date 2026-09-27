import React, { useState, useMemo } from 'react';
import { Book } from '../types';
import { getBookGenres, getBookPrimaryCategory } from '../lib/genreUtils';
import { calculateBookActiveReadingDays } from '../lib/readingDaysUtils';
import {
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Calendar,
  Sparkles,
  BookOpen,
  Clock,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts';

interface EstadisticasViewProps {
  books: Book[];
  onViewBookDetail?: (book: Book) => void;
}

const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const MONTH_SHORT = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
];

const WEEKDAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

// Helper to parse dates into timestamp for reliable day comparisons
const SPANISH_MONTHS: Record<string, number> = {
  enero: 0, ene: 0,
  febrero: 1, feb: 1,
  marzo: 2, mar: 2,
  abril: 3, abr: 3,
  mayo: 4, may: 4,
  junio: 5, jun: 5,
  julio: 6, jul: 6,
  agosto: 7, ago: 7,
  septiembre: 8, sep: 8, sept: 8,
  octubre: 9, oct: 9,
  noviembre: 10, nov: 10,
  diciembre: 11, dic: 11,
};

// Helper to parse dates including Spanish strings into timestamp for reliable day comparisons
const parseDateToObj = (dateStr?: string, defaultDay: number = 15): Date | null => {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const clean = dateStr.trim().toLowerCase();
  if (!clean) return null;

  // 1. Extract YYYY-MM-DD from string or ISO date
  const isoMatch = clean.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10) - 1;
    const d = parseInt(isoMatch[3], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      return new Date(y, m, d);
    }
  }

  // 2. Extract DD-MM-YYYY
  const dmyMatch = clean.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmyMatch) {
    const d = parseInt(dmyMatch[1], 10);
    const m = parseInt(dmyMatch[2], 10) - 1;
    const y = parseInt(dmyMatch[3], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      return new Date(y, m, d);
    }
  }

  // 3. YYYY-MM
  const ymMatch = clean.match(/^(\d{4})[-/](\d{1,2})$/);
  if (ymMatch) {
    const y = parseInt(ymMatch[1], 10);
    const m = parseInt(ymMatch[2], 10) - 1;
    if (!isNaN(y) && !isNaN(m)) {
      return new Date(y, m, defaultDay);
    }
  }

  // 4. Spanish Month Text (e.g., "septiembre 2026", "26 de septiembre", "15 sept 2026")
  let foundMonth: number | null = null;
  for (const [monthKey, monthIdx] of Object.entries(SPANISH_MONTHS)) {
    if (clean.includes(monthKey)) {
      foundMonth = monthIdx;
      break;
    }
  }

  if (foundMonth !== null) {
    const numbers = clean.match(/\d+/g)?.map(Number) || [];
    let foundYear: number | null = null;
    let foundDay: number | null = null;

    if (numbers.length >= 2) {
      const probableYear = numbers.find((n) => n > 1900 && n < 2100);
      const probableDay = numbers.find((n) => n >= 1 && n <= 31 && n !== probableYear);
      foundYear = probableYear || new Date().getFullYear();
      foundDay = probableDay || defaultDay;
    } else if (numbers.length === 1) {
      const num = numbers[0];
      if (num > 1900 && num < 2100) {
        foundYear = num;
        foundDay = defaultDay;
      } else if (num >= 1 && num <= 31) {
        foundYear = new Date().getFullYear();
        foundDay = num;
      }
    } else {
      foundYear = new Date().getFullYear();
      foundDay = defaultDay;
    }

    return new Date(foundYear, foundMonth, foundDay);
  }

  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

const getReadingDaysCount = (book: Book): number => {
  return calculateBookActiveReadingDays(book);
};

export const EstadisticasView: React.FC<EstadisticasViewProps> = ({
  books,
  onViewBookDetail,
}) => {
  const currentYear = new Date().getFullYear();
  const currentMonthIdx = new Date().getMonth(); // 0-11
  const todayDay = new Date().getDate();

  const [selectedChartYear, setSelectedChartYear] = useState<number>(currentYear);
  const [selectedBarMonth, setSelectedBarMonth] = useState<number | null>(null);

  // Calendar State: Month & Year
  const [calYear, setCalYear] = useState<number>(currentYear);
  const [calMonth, setCalMonth] = useState<number>(currentMonthIdx);
  const [selectedCalDay, setSelectedCalDay] = useState<number | null>(todayDay);

  const [expandedYear, setExpandedYear] = useState<string | null>(null);
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
  const [expandedAuthor, setExpandedAuthor] = useState<string | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  // Completed books
  const readBooks = useMemo(() => books.filter((b) => b.status === 'leido'), [books]);

  // Total read books
  const totalReadCount = readBooks.length;

  // Total pages accumulated (completed books + current page of books in progress)
  const totalPages = useMemo(() => {
    return books.reduce((acc, b) => {
      if (b.status === 'leido') {
        return acc + b.totalPages;
      }
      return acc + (b.currentPage || 0);
    }, 0);
  }, [books]);

  // Calendar Day Matrix for calYear & calMonth
  const calendarData = useMemo(() => {
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    // Monday as 0, Sunday as 6
    const firstDow = (new Date(calYear, calMonth, 1).getDay() + 6) % 7;

    const days: Array<{
      dayNum: number;
      books: Book[];
      isToday: boolean;
    }> = [];

    const now = new Date();
    const isThisCurrentMonth = calYear === now.getFullYear() && calMonth === now.getMonth();

    for (let d = 1; d <= daysInMonth; d++) {
      const dayDate = new Date(calYear, calMonth, d);
      const dayTs = dayDate.getTime();
      const isToday = isThisCurrentMonth && d === now.getDate();

      // Find all books that were active on this specific day
      const dayBooks = books.filter((book) => {
        // Books that are strictly 'pendiente' were never started and have no reading activity
        if (book.status === 'pendiente') {
          return false;
        }

        const startObj = parseDateToObj(book.startDate, 1);
        const endObj = parseDateToObj(book.endDate, 28);

        const startTs = startObj ? new Date(startObj.getFullYear(), startObj.getMonth(), startObj.getDate()).getTime() : null;
        const endTs = endObj ? new Date(endObj.getFullYear(), endObj.getMonth(), endObj.getDate()).getTime() : null;

        // 1. Both start and end exist
        if (startTs !== null && endTs !== null) {
          if (dayTs >= startTs && dayTs <= endTs) return true;
        }

        // 2. Book is reading with start date
        if (startTs !== null && book.status === 'leyendo') {
          const todayTs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
          if (dayTs >= startTs && dayTs <= todayTs) return true;
        }

        // 3. End date exists
        if (endTs !== null && endObj) {
          if (dayTs === endTs) return true;
        }

        // 4. Start date exists
        if (startTs !== null && startObj) {
          if (dayTs === startTs) return true;
        }

        // 5. Fallback for 'leido' or 'leyendo' books in this month/year
        if (book.status === 'leido' || book.status === 'leyendo') {
          const dateObj = endObj || startObj || parseDateToObj(book.updatedAt) || parseDateToObj(book.createdAt);
          if (dateObj) {
            if (dateObj.getFullYear() === calYear && dateObj.getMonth() === calMonth) {
              const targetDay = dateObj.getDate();
              if (d === Math.min(targetDay, daysInMonth)) {
                return true;
              }
            }
          } else if (book.readYear === calYear) {
            if (d === 15) return true;
          }
        }

        return false;
      });

      days.push({
        dayNum: d,
        books: dayBooks,
        isToday,
      });
    }

    const activeReadingDays = days.filter((d) => d.books.length > 0).length;
    const uniqueBooksInMonth = Array.from(
      new Set(days.flatMap((d) => d.books.map((b) => b.id)))
    ).map((id) => books.find((b) => b.id === id)!).filter(Boolean);

    return {
      firstDow,
      daysInMonth,
      days,
      activeReadingDays,
      uniqueBooksInMonth,
    };
  }, [books, calYear, calMonth]);

  const handlePrevMonth = () => {
    setSelectedCalDay(null);
    if (calMonth === 0) {
      setCalMonth(11);
      setCalYear((y) => y - 1);
    } else {
      setCalMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    setSelectedCalDay(null);
    if (calMonth === 11) {
      setCalMonth(0);
      setCalYear((y) => y + 1);
    } else {
      setCalMonth((m) => m + 1);
    }
  };

  const handleGoToToday = () => {
    const now = new Date();
    setCalYear(now.getFullYear());
    setCalMonth(now.getMonth());
    setSelectedCalDay(now.getDate());
  };

  // Selected day books for the preview inspector
  const selectedDayInfo = useMemo(() => {
    if (selectedCalDay === null) return null;
    const found = calendarData.days.find((d) => d.dayNum === selectedCalDay);
    return found ? found : null;
  }, [calendarData, selectedCalDay]);

  // Available years from read books
  const availableYears = useMemo(() => {
    const yearsSet = new Set<number>();
    yearsSet.add(currentYear);
    readBooks.forEach((b) => {
      if (b.readYear) yearsSet.add(b.readYear);
      if (b.endDate) {
        const y = parseInt(b.endDate.split('-')[0], 10);
        if (!isNaN(y)) yearsSet.add(y);
      }
    });
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [readBooks, currentYear]);

  // Monthly breakdown for selected chart year
  const monthlyChartData = useMemo(() => {
    const counts = Array.from({ length: 12 }, (_, i) => ({
      monthIdx: i,
      month: MONTH_SHORT[i],
      fullName: MONTH_NAMES[i],
      libros: 0,
      books: [] as Book[],
      isCurrentMonth: selectedChartYear === currentYear && i === currentMonthIdx,
    }));

    readBooks.forEach((book) => {
      const parsedDate = parseDateToObj(book.endDate) || parseDateToObj(book.startDate) || parseDateToObj(book.updatedAt) || parseDateToObj(book.createdAt);
      let bookYear = book.readYear || (parsedDate ? parsedDate.getFullYear() : 2026);
      let monthIdx = parsedDate ? parsedDate.getMonth() : 0;

      if (bookYear === selectedChartYear && monthIdx >= 0 && monthIdx < 12) {
        counts[monthIdx].libros += 1;
        counts[monthIdx].books.push(book);
      }
    });

    const totalInYear = counts.reduce((acc, c) => acc + c.libros, 0);
    const maxInMonth = Math.max(...counts.map((c) => c.libros), 0);
    const bestMonth = counts.find((c) => c.libros === maxInMonth && maxInMonth > 0);

    return {
      data: counts,
      totalInYear,
      maxInMonth,
      bestMonth,
    };
  }, [readBooks, selectedChartYear, currentYear, currentMonthIdx]);

  // Readings by year with monthly breakdown for accordion
  const readingsByYear = useMemo(() => {
    const map: Record<string, { totalBooks: Book[]; months: Record<number, Book[]> }> = {};

    readBooks.forEach((book) => {
      const parsedDate = parseDateToObj(book.endDate) || parseDateToObj(book.startDate) || parseDateToObj(book.updatedAt) || parseDateToObj(book.createdAt);
      const year = (book.readYear || (parsedDate ? parsedDate.getFullYear() : 2026)).toString();
      const monthIdx = parsedDate ? parsedDate.getMonth() : 0;

      if (!map[year]) {
        map[year] = { totalBooks: [], months: {} };
        for (let m = 0; m < 12; m++) {
          map[year].months[m] = [];
        }
      }

      map[year].totalBooks.push(book);
      map[year].months[monthIdx].push(book);
    });

    const entries = Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
    const maxCount = Math.max(...entries.map(([, data]) => data.totalBooks.length), 1);

    return { entries, maxCount };
  }, [readBooks]);

  // Top 5 Authors
  const topAuthors = useMemo(() => {
    const map: Record<string, Book[]> = {};
    readBooks.forEach((book) => {
      const author = book.author || 'Autor desconocido';
      if (!map[author]) map[author] = [];
      map[author].push(book);
    });

    const entries = Object.entries(map)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 5);

    const maxCount = Math.max(...entries.map(([, list]) => list.length), 1);

    return { entries, maxCount };
  }, [readBooks]);

  // Top 5 Categories / Genres (la primera categoría es la que manda)
  const topCategories = useMemo(() => {
    const map: Record<string, Book[]> = {};
    readBooks.forEach((book) => {
      const primary = getBookPrimaryCategory(book);
      const cat = primary && primary !== 'General' ? primary : (primary || 'Sin categoría');
      if (!map[cat]) map[cat] = [];
      map[cat].push(book);
    });

    const entries = Object.entries(map)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 5);

    const maxCount = Math.max(...entries.map(([, list]) => list.length), 1);

    return { entries, maxCount };
  }, [readBooks]);

  const activeSelectedMonthData =
    selectedBarMonth !== null ? monthlyChartData.data[selectedBarMonth] : null;

  return (
    <div className="px-4 py-2 space-y-4 max-w-lg mx-auto pb-16 text-zinc-900">
      {/* Big Hero Card: Total Books Read & Pages */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-zinc-200/80 text-center flex flex-col items-center justify-center">
        <span className="text-6xl font-black text-zinc-900 tracking-tight leading-none mb-1">
          {totalReadCount}
        </span>

        <p className="text-sm font-semibold text-zinc-500 mb-4">
          total de libros leídos hasta ahora
        </p>

        <div className="w-full pt-3 border-t border-zinc-100 flex items-center justify-center">
          <p className="text-sm font-bold text-zinc-900">
            Cantidad de páginas: <span className="font-extrabold text-zinc-950">{totalPages.toLocaleString()}</span>
          </p>
        </div>
      </div>

      {/* CALENDARIO DE LECTURA MENSUAL CON PORTADAS EN DÍAS DE LECTURA */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-zinc-200/80">
        {/* Calendar Header with Navigation */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-zinc-900 text-white">
              <Calendar className="w-4 h-4" />
            </span>
            <div>
              <h3 className="font-extrabold text-base text-zinc-900">
                Calendario de Lectura
              </h3>
              <p className="text-xs text-zinc-500 font-medium">
                Libros leídos día a día en {MONTH_NAMES[calMonth]} {calYear}
              </p>
            </div>
          </div>

          <button
            onClick={handleGoToToday}
            className="text-[11px] font-bold px-2.5 py-1 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 transition-colors cursor-pointer shrink-0"
          >
            Hoy
          </button>
        </div>

        {/* Month Selector Controls */}
        <div className="flex items-center justify-between bg-zinc-50 p-2 rounded-2xl border border-zinc-200/80 mb-3.5">
          <button
            onClick={handlePrevMonth}
            className="p-1.5 rounded-xl hover:bg-zinc-200/80 text-zinc-700 transition-colors cursor-pointer active:scale-95"
            title="Mes anterior"
          >
            <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
          </button>

          <div className="flex items-center gap-1.5">
            <select
              value={calMonth}
              onChange={(e) => {
                setCalMonth(Number(e.target.value));
                setSelectedCalDay(null);
              }}
              className="bg-white border border-zinc-200 text-zinc-900 text-xs font-black rounded-xl px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-zinc-900 cursor-pointer shadow-2xs"
            >
              {MONTH_NAMES.map((name, idx) => (
                <option key={idx} value={idx}>
                  {name}
                </option>
              ))}
            </select>

            <select
              value={calYear}
              onChange={(e) => {
                setCalYear(Number(e.target.value));
                setSelectedCalDay(null);
              }}
              className="bg-white border border-zinc-200 text-zinc-900 text-xs font-black rounded-xl px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-zinc-900 cursor-pointer shadow-2xs"
            >
              {Array.from({ length: 7 }, (_, i) => currentYear - 3 + i).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleNextMonth}
            className="p-1.5 rounded-xl hover:bg-zinc-200/80 text-zinc-700 transition-colors cursor-pointer active:scale-95"
            title="Mes siguiente"
          >
            <ChevronRight className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        {/* Micro Month KPI */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-zinc-50 rounded-2xl p-2.5 border border-zinc-200/70">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
              Días con lectura
            </span>
            <div className="text-base font-black text-zinc-900 mt-0.5">
              {calendarData.activeReadingDays}{' '}
              <span className="text-xs font-semibold text-zinc-500">
                de {calendarData.daysInMonth} días
              </span>
            </div>
          </div>

          <div className="bg-zinc-50 rounded-2xl p-2.5 border border-zinc-200/70">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
              Libros en este mes
            </span>
            <div className="text-base font-black text-zinc-900 mt-0.5 truncate">
              {calendarData.uniqueBooksInMonth.length}{' '}
              <span className="text-xs font-semibold text-zinc-500">
                {calendarData.uniqueBooksInMonth.length === 1 ? 'libro activo' : 'libros activos'}
              </span>
            </div>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="bg-zinc-50/60 rounded-2xl p-2 border border-zinc-200">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {WEEKDAY_NAMES.map((d) => (
              <span key={d} className="text-[10px] font-extrabold text-zinc-500 py-1">
                {d}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Blank padding days for first week */}
            {Array.from({ length: calendarData.firstDow }).map((_, i) => (
              <div key={`blank-${i}`} className="min-h-[56px] rounded-xl bg-transparent opacity-30" />
            ))}

            {/* Actual Month Days */}
            {calendarData.days.map((day) => {
              const hasBooks = day.books.length > 0;
              const isSelected = selectedCalDay === day.dayNum;
              const firstBook = hasBooks ? day.books[0] : null;

              return (
                <button
                  key={day.dayNum}
                  onClick={() => setSelectedCalDay((prev) => (prev === day.dayNum ? null : day.dayNum))}
                  className={`relative min-h-[58px] rounded-xl p-1 flex flex-col justify-between items-stretch transition-all duration-150 cursor-pointer overflow-hidden border text-left active:scale-95 ${
                    isSelected
                      ? 'ring-2 ring-zinc-900 bg-white border-zinc-900 shadow-md'
                      : hasBooks
                      ? 'bg-white hover:bg-zinc-50 border-zinc-300 shadow-2xs'
                      : 'bg-white/60 hover:bg-white border-zinc-200/80'
                  }`}
                >
                  {/* Top Bar with Day Number & Today indicator */}
                  <div className="flex items-center justify-between w-full mb-0.5 pointer-events-none">
                    <span
                      className={`text-[10px] font-black px-1 py-0.2 rounded-md ${
                        day.isToday
                          ? 'bg-zinc-900 text-white font-extrabold'
                          : hasBooks
                          ? 'text-zinc-900 bg-zinc-100'
                          : 'text-zinc-500'
                      }`}
                    >
                      {day.dayNum}
                    </span>

                    {day.books.length > 1 && (
                      <span className="text-[8px] font-black bg-zinc-800 text-white rounded-full px-1 py-0.2 leading-none">
                        +{day.books.length - 1}
                      </span>
                    )}
                  </div>

                  {/* Book Cover miniature when reading on this day */}
                  {hasBooks && firstBook ? (
                    <div className="relative w-full h-8 rounded-md overflow-hidden bg-zinc-200 border border-zinc-300/80 shrink-0">
                      {firstBook.coverImage ? (
                        <img
                          src={firstBook.coverImage}
                          alt={firstBook.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-white text-[9px] font-black">
                          {firstBook.title.charAt(0)}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="h-8" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Day Inspector / Details Drawer */}
        {selectedDayInfo && (
          <div className="mt-3.5 p-3.5 bg-zinc-50 rounded-2xl border border-zinc-200 animate-in fade-in duration-150">
            <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-zinc-200">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-zinc-900" />
                <h4 className="text-xs font-black text-zinc-900">
                  Lectura del {selectedDayInfo.dayNum} de {MONTH_NAMES[calMonth]} de {calYear}
                </h4>
              </div>
              <button
                onClick={() => setSelectedCalDay(null)}
                className="text-[10px] font-bold text-zinc-500 hover:text-zinc-900 cursor-pointer"
              >
                Cerrar
              </button>
            </div>

            {selectedDayInfo.books.length > 0 ? (
              <div className="space-y-2">
                {selectedDayInfo.books.map((b) => {
                  const duration = getReadingDaysCount(b);
                  return (
                    <div
                      key={b.id}
                      className="flex items-start gap-2.5 bg-white p-2.5 rounded-xl border border-zinc-200 shadow-2xs"
                    >
                      <div
                        onClick={() => onViewBookDetail?.(b)}
                        className={`w-10 h-14 rounded-lg bg-zinc-200 overflow-hidden shrink-0 border border-zinc-300/80 ${
                          onViewBookDetail ? 'cursor-pointer hover:opacity-90 active:scale-95 transition-all' : ''
                        }`}
                        title="Toca para ver ficha completa"
                      >
                        {b.coverImage ? (
                          <img
                            src={b.coverImage}
                            alt={b.title}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs font-black bg-zinc-800 text-white">
                            {b.title.charAt(0)}
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-1">
                          <h5
                            onClick={() => onViewBookDetail?.(b)}
                            className={`text-xs font-bold text-zinc-900 truncate ${
                              onViewBookDetail ? 'cursor-pointer hover:underline' : ''
                            }`}
                            title="Toca para ver ficha completa"
                          >
                            {b.title}
                          </h5>
                          <span
                            className={`text-[9px] font-black px-1.5 py-0.5 rounded-md shrink-0 ${
                              b.status === 'leido'
                                ? 'bg-zinc-900 text-white'
                                : b.status === 'leyendo'
                                ? 'bg-emerald-100 text-emerald-800'
                                : b.status === 'pausado'
                                ? 'bg-amber-100 text-amber-800'
                                : b.status === 'abandonado'
                                ? 'bg-neutral-100 text-neutral-600'
                                : 'bg-zinc-100 text-zinc-700'
                            }`}
                          >
                            {b.status === 'leido'
                              ? 'Terminado'
                              : b.status === 'leyendo'
                              ? 'En lectura'
                              : b.status === 'pausado'
                              ? 'Pausado'
                              : b.status === 'abandonado'
                              ? 'Abandonado'
                              : 'Pendiente'}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-500 truncate mb-1">{b.author}</p>

                        <div className="flex flex-wrap items-center gap-1 text-[9px] font-medium text-zinc-600">
                          {b.startDate && (
                            <span className="bg-zinc-100 px-1.5 py-0.5 rounded border border-zinc-200">
                              Inicio: {b.startDate}
                            </span>
                          )}
                          {b.endDate && (
                            <span className="bg-zinc-100 px-1.5 py-0.5 rounded border border-zinc-200">
                              Fin: {b.endDate}
                            </span>
                          )}
                          <span className="bg-zinc-100 px-1.5 py-0.5 rounded border border-zinc-200 font-bold text-zinc-800 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5 stroke-[2.5]" />
                            {duration} {duration === 1 ? 'día' : 'días'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-zinc-500 text-center py-2">
                No hay registros de lectura activa para este día.
              </p>
            )}
          </div>
        )}
      </div>

      {/* RECHARTS BAR CHART CARD: Libros terminados mes a mes durante el año actual */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-zinc-200/80">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="p-1 rounded-lg bg-zinc-900 text-white">
                <BarChart3 className="w-3.5 h-3.5" />
              </span>
              <h3 className="font-extrabold text-base text-zinc-900">
                Libros terminados por mes
              </h3>
            </div>
            <p className="text-xs text-zinc-500 font-medium">
              Evolución mensual durante el año {selectedChartYear}
            </p>
          </div>

          {/* Year selector */}
          {availableYears.length > 1 ? (
            <select
              value={selectedChartYear}
              onChange={(e) => {
                setSelectedChartYear(Number(e.target.value));
                setSelectedBarMonth(null);
              }}
              className="bg-zinc-100 border border-zinc-300 text-zinc-900 text-xs font-black rounded-xl px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-zinc-900 cursor-pointer"
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-xs font-black bg-zinc-100 text-zinc-800 px-2.5 py-1 rounded-xl border border-zinc-200">
              {selectedChartYear}
            </span>
          )}
        </div>

        {/* Micro KPI Row */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="bg-zinc-50 rounded-2xl p-2.5 border border-zinc-200/70">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
              Total en {selectedChartYear}
            </span>
            <div className="text-lg font-black text-zinc-900 mt-0.5">
              {monthlyChartData.totalInYear}{' '}
              <span className="text-xs font-semibold text-zinc-500">
                {monthlyChartData.totalInYear === 1 ? 'libro' : 'libros'}
              </span>
            </div>
          </div>

          <div className="bg-zinc-50 rounded-2xl p-2.5 border border-zinc-200/70">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
              Mes con más lecturas
            </span>
            <div className="text-lg font-black text-zinc-900 mt-0.5 truncate">
              {monthlyChartData.bestMonth ? (
                <>
                  {monthlyChartData.bestMonth.fullName}{' '}
                  <span className="text-xs font-semibold text-zinc-500">
                    ({monthlyChartData.bestMonth.libros})
                  </span>
                </>
              ) : (
                <span className="text-xs font-semibold text-zinc-400">Sin lecturas</span>
              )}
            </div>
          </div>
        </div>

        {/* Recharts Bar Chart Container */}
        <div className="w-full h-52 pt-1 pb-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={monthlyChartData.data}
              margin={{ top: 12, right: 8, left: -22, bottom: 0 }}
              onClick={(state) => {
                if (state && state.activeTooltipIndex !== undefined) {
                  const idx = Number(state.activeTooltipIndex);
                  setSelectedBarMonth((prev) => (prev === idx ? null : idx));
                }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4E4E7" />
              <XAxis
                dataKey="month"
                axisLine={{ stroke: '#E4E4E7' }}
                tickLine={false}
                tick={{ fill: '#71717A', fontSize: 11, fontWeight: 700 }}
              />
              <YAxis
                allowDecimals={false}
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#A1A1AA', fontSize: 10 }}
                domain={[0, (dataMax: number) => Math.max(dataMax + 1, 3)]}
              />
              <Tooltip
                cursor={{ fill: 'rgba(0, 0, 0, 0.04)', radius: 8 }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-zinc-900 text-white px-3 py-2 rounded-xl shadow-lg text-xs border border-zinc-800">
                        <p className="font-bold text-zinc-200">
                          {data.fullName} {selectedChartYear}
                        </p>
                        <p className="font-black text-sm text-white mt-0.5">
                          {data.libros} {data.libros === 1 ? 'libro terminado' : 'libros terminados'}
                        </p>
                        {data.books && data.books.length > 0 && (
                          <div className="mt-1.5 pt-1.5 border-t border-zinc-800 space-y-0.5 max-w-[190px]">
                            {data.books.slice(0, 3).map((b: Book) => (
                              <p key={b.id} className="text-[10px] text-zinc-300 truncate">
                                • {b.title}
                              </p>
                            ))}
                            {data.books.length > 3 && (
                              <p className="text-[9px] text-zinc-400 font-semibold">
                                + {data.books.length - 3} más...
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar
                dataKey="libros"
                radius={[6, 6, 0, 0]}
                maxBarSize={32}
                className="cursor-pointer"
              >
                {monthlyChartData.data.map((entry, index) => {
                  const isSelected = selectedBarMonth === index;
                  const isCurrent = entry.isCurrentMonth;
                  
                  let fill = '#D4D4D8';
                  if (isSelected) {
                    fill = '#09090B';
                  } else if (entry.libros > 0) {
                    fill = isCurrent ? '#18181B' : '#3F3F46';
                  } else if (isCurrent) {
                    fill = '#A1A1AA';
                  }
                  return <Cell key={`cell-${index}`} fill={fill} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Interactive Month Details panel if user clicks a bar */}
        {activeSelectedMonthData && activeSelectedMonthData.books.length > 0 && (
          <div className="mt-3 p-3 bg-zinc-50 rounded-2xl border border-zinc-200 animate-in fade-in duration-150">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black text-zinc-900">
                Libros terminados en {activeSelectedMonthData.fullName} ({activeSelectedMonthData.libros}):
              </span>
              <button
                onClick={() => setSelectedBarMonth(null)}
                className="text-[10px] font-bold text-zinc-500 hover:text-zinc-900 cursor-pointer"
              >
                Cerrar
              </button>
            </div>
            <div className="space-y-1.5">
              {activeSelectedMonthData.books.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center gap-2 bg-white p-2 rounded-xl border border-zinc-200 shadow-2xs"
                >
                  <div
                    onClick={() => onViewBookDetail?.(b)}
                    className={`w-6 h-8 rounded bg-zinc-200 overflow-hidden shrink-0 ${
                      onViewBookDetail ? 'cursor-pointer hover:opacity-90 active:scale-95 transition-all' : ''
                    }`}
                    title="Toca para ver ficha completa"
                  >
                    {b.coverImage ? (
                      <img
                        src={b.coverImage}
                        alt={b.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[9px] font-black text-zinc-700">
                        {b.title.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-zinc-900 truncate">{b.title}</p>
                    <p className="text-[10px] text-zinc-500 truncate">
                      {b.author} · {b.totalPages} págs {b.endDate ? `· Terminado: ${b.endDate}` : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-[11px] text-zinc-400 text-center mt-2">
          Toca cualquier barra para explorar los libros de ese mes
        </p>
      </div>

      {/* Card 1: Lecturas por año */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-zinc-200/80">
        <h3 className="font-extrabold text-base text-zinc-900">Lecturas por año</h3>
        <p className="text-xs text-zinc-400 font-medium mb-4">
          Haz clic para ver los libros leídos por año.
        </p>

        {readingsByYear.entries.length === 0 ? (
          <p className="text-xs text-zinc-400 text-center py-4">No hay lecturas registradas aún.</p>
        ) : (
          <div className="space-y-3">
            {readingsByYear.entries.map(([year, yearData]) => {
              const isExpanded = expandedYear === year;
              const barWidthPercent = Math.max(15, (yearData.totalBooks.length / readingsByYear.maxCount) * 100);

              return (
                <div key={year} className="space-y-2">
                  <div
                    onClick={() => {
                      setExpandedYear(isExpanded ? null : year);
                      setExpandedMonth(null);
                    }}
                    className="flex items-center justify-between gap-3 cursor-pointer select-none py-1.5 px-1 hover:bg-zinc-50 rounded-xl transition-all"
                  >
                    <span className="text-xs font-black text-zinc-900 w-12 shrink-0">{year}</span>

                    {/* Gradient Bar */}
                    <div className="flex-1 h-4 bg-zinc-100 rounded-full overflow-hidden p-0.5">
                      <div
                        className="h-full bg-gradient-to-r from-zinc-500 via-zinc-700 to-zinc-900 rounded-full transition-all duration-300 shadow-2xs"
                        style={{ width: `${barWidthPercent}%` }}
                      />
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 min-w-[32px] justify-end">
                      <span className="text-xs font-black text-zinc-900">{yearData.totalBooks.length}</span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-zinc-900" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-zinc-400" />
                      )}
                    </div>
                  </div>

                  {/* Accordion Content: Months of the Year */}
                  {isExpanded && (
                    <div className="pl-2 pr-1 py-2.5 bg-zinc-50 rounded-2xl border border-zinc-200 space-y-1.5 text-xs animate-in fade-in slide-in-from-top-1 duration-150">
                      <p className="text-[10px] font-bold text-zinc-700 uppercase tracking-wider px-2 pb-0.5">
                        Meses de {year} ({yearData.totalBooks.length} leídos)
                      </p>

                      <div className="space-y-1">
                        {MONTH_NAMES.map((monthName, monthIdx) => {
                          const monthBooks = yearData.months[monthIdx] || [];
                          const monthKey = `${year}-${monthIdx}`;
                          const isMonthExpanded = expandedMonth === monthKey;
                          const hasBooks = monthBooks.length > 0;

                          return (
                            <div key={monthName} className="rounded-xl overflow-hidden bg-white/90 border border-zinc-200">
                              {/* Month Header / Row */}
                              <div
                                onClick={() => {
                                  if (hasBooks) {
                                    setExpandedMonth(isMonthExpanded ? null : monthKey);
                                  }
                                }}
                                className={`flex items-center justify-between px-3 py-2 select-none transition-all ${
                                  hasBooks
                                    ? 'cursor-pointer hover:bg-zinc-100'
                                    : 'opacity-50 cursor-default'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <div
                                    className={`w-2 h-2 rounded-full ${
                                      hasBooks ? 'bg-zinc-900' : 'bg-zinc-300'
                                    }`}
                                  />
                                  <span className={`text-xs ${hasBooks ? 'font-bold text-zinc-900' : 'font-medium text-zinc-400'}`}>
                                    {monthName}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2">
                                  <span
                                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                      hasBooks
                                        ? 'bg-zinc-200 text-zinc-900 border border-zinc-300'
                                        : 'bg-zinc-100 text-zinc-400'
                                    }`}
                                  >
                                    {monthBooks.length} {monthBooks.length === 1 ? 'libro' : 'libros'}
                                  </span>

                                  {hasBooks && (
                                    isMonthExpanded ? (
                                      <ChevronUp className="w-3.5 h-3.5 text-zinc-900" />
                                    ) : (
                                      <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                                    )
                                  )}
                                </div>
                              </div>

                              {/* Books for this Month (Shown ONLY when month is clicked) */}
                              {isMonthExpanded && hasBooks && (
                                <div className="px-3 pb-2.5 pt-1 space-y-2 border-t border-zinc-200 bg-zinc-50/70 animate-in fade-in slide-in-from-top-1 duration-150">
                                  {monthBooks.map((b) => (
                                    <div
                                      key={b.id}
                                      className="flex items-center gap-2.5 bg-white p-2 rounded-xl border border-zinc-200 shadow-2xs"
                                    >
                                      <div className="w-8 h-11 rounded-md bg-zinc-200 overflow-hidden shrink-0 shadow-2xs">
                                        {b.coverImage ? (
                                          <img
                                            src={b.coverImage}
                                            alt={b.title}
                                            referrerPolicy="no-referrer"
                                            className="w-full h-full object-cover"
                                          />
                                        ) : (
                                          <div className="w-full h-full flex items-center justify-center text-[10px] font-black text-zinc-700 bg-zinc-100">
                                            {b.title.charAt(0)}
                                          </div>
                                        )}
                                      </div>
                                      <div className="truncate flex-1 min-w-0">
                                        <p className="font-bold text-zinc-900 text-xs truncate">{b.title}</p>
                                        <p className="text-[10px] text-zinc-500 truncate">
                                          {b.author} • {b.totalPages} págs
                                        </p>
                                        {b.endDate && (
                                          <p className="text-[9px] text-zinc-700 font-semibold">
                                            Terminado: {b.endDate}
                                          </p>
                                        )}
                                      </div>
                                      {b.rating > 0 && (
                                        <span className="text-[10px] font-bold text-zinc-900 bg-zinc-100 px-1.5 py-0.5 rounded-md border border-zinc-300 shrink-0">
                                          ★ {b.rating}
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Card 2: Top 5 Autores más leídos */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-zinc-200/80">
        <h3 className="font-extrabold text-base text-zinc-900">Top 5 Autores más leídos</h3>
        <p className="text-xs text-zinc-400 font-medium mb-4">
          Haz clic para ver los títulos de cada autor.
        </p>

        {topAuthors.entries.length === 0 ? (
          <p className="text-xs text-zinc-400 text-center py-4">No hay autores registrados aún.</p>
        ) : (
          <div className="space-y-3">
            {topAuthors.entries.map(([author, bookList]) => {
              const isExpanded = expandedAuthor === author;
              const barWidthPercent = Math.max(20, (bookList.length / topAuthors.maxCount) * 100);

              return (
                <div key={author} className="space-y-2">
                  <div
                    onClick={() => setExpandedAuthor(isExpanded ? null : author)}
                    className="flex items-center justify-between gap-3 cursor-pointer select-none py-1 hover:opacity-90 transition-opacity"
                  >
                    <span className="text-xs font-bold text-zinc-900 w-32 truncate shrink-0">
                      {author}
                    </span>

                    {/* Gradient Bar */}
                    <div className="flex-1 h-4 bg-zinc-100 rounded-full overflow-hidden p-0.5">
                      <div
                        className="h-full bg-gradient-to-r from-zinc-500 via-zinc-700 to-zinc-900 rounded-full transition-all duration-300 shadow-2xs"
                        style={{ width: `${barWidthPercent}%` }}
                      />
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 min-w-[32px] justify-end">
                      <span className="text-xs font-bold text-zinc-900">{bookList.length}</span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-zinc-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-zinc-400" />
                      )}
                    </div>
                  </div>

                  {/* Accordion Content */}
                  {isExpanded && (
                    <div className="pl-3 pr-1 py-2 bg-zinc-50 rounded-2xl border border-zinc-200 space-y-2 text-xs">
                      {bookList.map((b) => (
                        <div key={b.id} className="flex items-center gap-2.5">
                          <div className="w-6 h-8 rounded-sm bg-zinc-200 overflow-hidden shrink-0 shadow-2xs">
                            {b.coverImage ? (
                              <img src={b.coverImage} alt={b.title} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[9px] font-bold text-zinc-700">
                                {b.title.charAt(0)}
                              </div>
                            )}
                          </div>
                          <div className="truncate flex-1">
                            <p className="font-bold text-zinc-900 truncate">{b.title}</p>
                            <p className="text-[10px] text-zinc-500">{b.totalPages} págs • {b.format}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Card 3: Top 5 Categorías populares */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-zinc-200/80">
        <h3 className="font-extrabold text-base text-zinc-900">Top 5 Categorías populares</h3>
        <p className="text-xs text-zinc-400 font-medium mb-4">
          Haz clic para ver los títulos por categoría.
        </p>

        {topCategories.entries.length === 0 ? (
          <p className="text-xs text-zinc-400 text-center py-4">No hay categorías registradas aún.</p>
        ) : (
          <div className="space-y-3">
            {topCategories.entries.map(([category, bookList]) => {
              const isExpanded = expandedCategory === category;
              const barWidthPercent = Math.max(20, (bookList.length / topCategories.maxCount) * 100);

              return (
                <div key={category} className="space-y-2">
                  <div
                    onClick={() => setExpandedCategory(isExpanded ? null : category)}
                    className="flex items-center justify-between gap-3 cursor-pointer select-none py-1 hover:opacity-90 transition-opacity"
                  >
                    <span className="text-xs font-bold text-zinc-900 w-32 truncate shrink-0">
                      {category}
                    </span>

                    {/* Gradient Bar */}
                    <div className="flex-1 h-4 bg-zinc-100 rounded-full overflow-hidden p-0.5">
                      <div
                        className="h-full bg-gradient-to-r from-zinc-500 via-zinc-700 to-zinc-900 rounded-full transition-all duration-300 shadow-2xs"
                        style={{ width: `${barWidthPercent}%` }}
                      />
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 min-w-[32px] justify-end">
                      <span className="text-xs font-bold text-zinc-900">{bookList.length}</span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-zinc-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-zinc-400" />
                      )}
                    </div>
                  </div>

                  {/* Accordion Content */}
                  {isExpanded && (
                    <div className="pl-3 pr-1 py-2 bg-zinc-50 rounded-2xl border border-zinc-200 space-y-2 text-xs">
                      {bookList.map((b) => (
                        <div key={b.id} className="flex items-center gap-2.5">
                          <div className="w-6 h-8 rounded-sm bg-zinc-200 overflow-hidden shrink-0 shadow-2xs">
                            {b.coverImage ? (
                              <img src={b.coverImage} alt={b.title} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[9px] font-bold text-zinc-700">
                                {b.title.charAt(0)}
                              </div>
                            )}
                          </div>
                          <div className="truncate flex-1">
                            <p className="font-bold text-zinc-900 truncate">{b.title}</p>
                            <p className="text-[10px] text-zinc-500">{b.author}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
