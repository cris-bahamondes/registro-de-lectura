import React, { useState, useMemo, useEffect } from 'react';
import { Book, BookStatus } from '../types';
import { StarRating } from './StarRating';
import { calculateBookActiveReadingDays, formatReadingDays } from '../lib/readingDaysUtils';
import {
  Search,
  Plus,
  BookOpen,
  MoreVertical,
  Edit2,
  Trash2,
  Play,
  Pause,
  CheckCircle2,
  Flag,
  BookMarked,
  Filter,
  Layers,
  Sparkles,
  Calendar,
  X,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Clock,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  SlidersHorizontal,
  Tag,
  Star,
  FileText,
  User,
  Check,
  Image as ImageIcon
} from 'lucide-react';
import { getBookGenres, getBookPrimaryCategory } from '../lib/genreUtils';
import { BookCoverImage } from './BookCoverImage';
import { CoverSearchModal } from './CoverSearchModal';
import { QuickTitleFixModal } from './QuickTitleFixModal';
import {
  isChapterDerivedBook,
  filterRealBooksOnly,
  purgeChapterStandaloneBooks,
  isCorruptedOrPlaceholderTitle,
  deduplicateBooks,
} from '../lib/syncService';
import { auth } from '../lib/firebase';

export type SortOption =
  | 'default'
  | 'read_desc'
  | 'read_asc'
  | 'title_asc'
  | 'title_desc'
  | 'author_asc'
  | 'author_desc'
  | 'rating_desc'
  | 'pages_desc'
  | 'pages_asc';

interface BibliotecaViewProps {
  books: Book[];
  onOpenAddModal: () => void;
  onOpenEditModal: (book: Book) => void;
  onOpenDeleteModal: (book: Book) => void;
  onOpenChaptersModal: (book: Book) => void;
  onSelectActiveBook: (bookId: string) => void;
  onQuickStatusChange: (bookId: string, status: BookStatus) => void;
  onViewBookDetail?: (book: Book) => void;
  onRemoveStartDate?: (bookId: string) => void;
  onUpdateCover?: (bookId: string, coverUrl: string) => void;
  onOpenBackupModal?: () => void;
  onPurgeChapterBooks?: () => void;
  onUpdateBook?: (book: Book) => void;
}

const MONTH_NAMES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

const MONTH_DISPLAY = [
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

// Helper to extract month numbers (0-11), years, and string tokens for a book
const getBookDateInfo = (book: Book) => {
  const months: number[] = [];
  const years: number[] = [];
  const tokens: string[] = [];

  const parseString = (str?: string) => {
    if (!str || typeof str !== 'string') return;
    const clean = str.trim();
    if (!clean) return;
    tokens.push(clean.toLowerCase());

    const yearMatch = clean.match(/\b(20\d\d|19\d\d)\b/);
    if (yearMatch) {
      const yr = parseInt(yearMatch[1], 10);
      if (!years.includes(yr)) years.push(yr);
    }

    // YYYY-MM-DD or YYYY-MM
    if (/^\d{4}[-/]\d{1,2}/.test(clean)) {
      const parts = clean.split(/[-/]/);
      const m = parseInt(parts[1], 10) - 1;
      if (m >= 0 && m <= 11) {
        if (!months.includes(m)) months.push(m);
        tokens.push(MONTH_NAMES[m]);
        tokens.push(MONTH_NAMES[m].substring(0, 3));
        tokens.push(`${parts[2] || '01'}-${parts[1]}`);
        tokens.push(`${parts[1]}-${parts[0]}`);
      }
    }
    // DD-MM-YYYY or DD-MM
    else if (/^\d{1,2}[-/]\d{1,2}/.test(clean)) {
      const parts = clean.split(/[-/]/);
      const m = parseInt(parts[1], 10) - 1;
      if (m >= 0 && m <= 11) {
        if (!months.includes(m)) months.push(m);
        tokens.push(MONTH_NAMES[m]);
        tokens.push(MONTH_NAMES[m].substring(0, 3));
        tokens.push(`${parts[0]}-${parts[1]}`);
      }
    }
  };

  parseString(book.endDate);
  parseString(book.startDate);

  if (book.readYear && typeof book.readYear === 'number') {
    if (!years.includes(book.readYear)) years.push(book.readYear);
    tokens.push(book.readYear.toString());
  }

  return { months, years, tokens };
};

// Helper to parse dates into timestamp for reliable sorting and calculations
const parseDateToTimestamp = (dateStr?: string): number => {
  if (!dateStr || typeof dateStr !== 'string') return 0;
  const clean = dateStr.trim().toLowerCase();
  if (!clean) return 0;

  // 1. ISO YYYY-MM-DD or YYYY-MM
  if (/^\d{4}[-/]\d{1,2}([-/]\d{1,2})?/.test(clean)) {
    const parts = clean.split(/[-/]/);
    const yr = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parts[2] ? parseInt(parts[2], 10) : 1;
    return new Date(yr, m, d).getTime();
  }

  // 2. DD-MM-YYYY or DD/MM/YYYY
  if (/^\d{1,2}[-/]\d{1,2}[-/]\d{4}/.test(clean)) {
    const parts = clean.split(/[-/]/);
    const d = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const yr = parseInt(parts[2], 10);
    return new Date(yr, m, d).getTime();
  }

  // 3. Spanish month name match e.g. "marzo 2026", "15 de marzo 2026", "marzo"
  const yrMatch = clean.match(/\b(20\d\d|19\d\d)\b/);
  const yr = yrMatch ? parseInt(yrMatch[1], 10) : new Date().getFullYear();
  for (let mIdx = 0; mIdx < MONTH_NAMES.length; mIdx++) {
    const mName = MONTH_NAMES[mIdx];
    if (clean.includes(mName) || (mIdx === 8 && clean.includes('setiembre'))) {
      const dayMatch = clean.match(/\b([123]?\d)\b/);
      const day = dayMatch && parseInt(dayMatch[1], 10) <= 31 ? parseInt(dayMatch[1], 10) : 1;
      return new Date(yr, mIdx, day).getTime();
    }
  }

  const parsed = new Date(clean).getTime();
  return isNaN(parsed) ? 0 : parsed;
};

// Helper to check if a book is read/finished
const isBookRead = (b: Book): boolean => {
  const s = String(b.status || '').toLowerCase();
  if (s === 'leido' || s === 'read' || s === 'terminado') return true;
  if (b.totalPages > 0 && (b.currentPage || 0) >= b.totalPages) return true;
  if (b.endDate && b.endDate.trim().length > 0) return true;
  return false;
};

// Helper to get reliable read timestamp for sorting read books
const getBookReadTimestamp = (b: Book): number => {
  const endTs = parseDateToTimestamp(b.endDate);
  if (endTs > 0) return endTs;
  if (b.readYear && typeof b.readYear === 'number') {
    return new Date(b.readYear, 11, 31).getTime();
  }
  const startTs = parseDateToTimestamp(b.startDate);
  if (startTs > 0) return startTs;
  const updatedTs = parseDateToTimestamp(b.updatedAt);
  if (updatedTs > 0) return updatedTs;
  const createdTs = parseDateToTimestamp(b.createdAt);
  if (createdTs > 0) return createdTs;
  return isBookRead(b) ? 1 : 0;
};

// Helper to calculate reading duration matching calendar reading days
const getReadingDuration = (book: Book): { days: number; label: string } | null => {
  if (book.status === 'pendiente') return null;
  const days = calculateBookActiveReadingDays(book);
  if (days <= 0) return null;
  return {
    days,
    label: formatReadingDays(days),
  };
};

export const BibliotecaView: React.FC<BibliotecaViewProps> = ({
  books,
  onOpenAddModal,
  onOpenEditModal,
  onOpenDeleteModal,
  onOpenChaptersModal,
  onSelectActiveBook,
  onQuickStatusChange,
  onViewBookDetail,
  onRemoveStartDate,
  onUpdateCover,
  onOpenBackupModal,
  onPurgeChapterBooks,
  onUpdateBook,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'todos' | BookStatus>('todos');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('todos');
  const [selectedYearFilter, setSelectedYearFilter] = useState<number | 'todos'>('todos');
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<number | 'todos'>('todos');
  const [selectedSagaFilter, setSelectedSagaFilter] = useState<string>('todos');
  
  // Comprehensive sorting state
  const [sortOption, setSortOption] = useState<SortOption>(() => {
    const saved = localStorage.getItem('biblioteca_sort_option');
    if (saved && [
      'default', 'read_desc', 'read_asc', 'title_asc', 'title_desc',
      'author_asc', 'author_desc', 'rating_desc', 'pages_desc', 'pages_asc'
    ].includes(saved)) {
      return saved as SortOption;
    }
    const legacy = localStorage.getItem('biblioteca_sort_read_order');
    if (legacy === 'asc') return 'read_asc';
    if (legacy === 'desc') return 'read_desc';
    return 'default';
  });

  const [activeMenuBookId, setActiveMenuBookId] = useState<string | null>(null);
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [coverSearchBook, setCoverSearchBook] = useState<Book | null>(null);
  const [isTitleFixModalOpen, setIsTitleFixModalOpen] = useState(false);
  const [selectedFixBookId, setSelectedFixBookId] = useState<string | null>(null);

  // Filter books with provisional or corrupted titles
  const provisionalBooks = useMemo(() => {
    return books.filter((b) => isCorruptedOrPlaceholderTitle(b.title));
  }, [books]);

  // Responsive desktop detection for PC/notebook (>= 1024px)
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 1024;
    }
    return false;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [userBooksPerPage, setUserBooksPerPage] = useState<number | null>(() => {
    try {
      const saved = localStorage.getItem('biblioteca_items_per_page');
      return saved ? Number(saved) : null;
    } catch {
      return null;
    }
  });

  // Default: 24 books per page on PC/notebook (6 cols x 4 rows), 10 on mobile
  const booksPerPage = userBooksPerPage ?? (isDesktop ? 24 : 10);

  const handleSetBooksPerPage = (count: number) => {
    setUserBooksPerPage(count);
    setCurrentPage(1);
    try {
      localStorage.setItem('biblioteca_items_per_page', count.toString());
    } catch {}
  };

  const handleSetSortOption = (opt: SortOption) => {
    setSortOption(opt);
    try {
      localStorage.setItem('biblioteca_sort_option', opt);
    } catch {}
    setIsSortMenuOpen(false);
  };

  // Toggle helpers for quick sorting buttons
  const toggleSortReadDate = () => {
    setSortOption((prev) => {
      let next: SortOption;
      if (prev === 'read_desc') next = 'read_asc';
      else if (prev === 'read_asc') next = 'default';
      else next = 'read_desc';
      try { localStorage.setItem('biblioteca_sort_option', next); } catch {}
      return next;
    });
  };

  const toggleSortTitle = () => {
    setSortOption((prev) => {
      let next: SortOption;
      if (prev === 'title_asc') next = 'title_desc';
      else if (prev === 'title_desc') next = 'default';
      else next = 'title_asc';
      try { localStorage.setItem('biblioteca_sort_option', next); } catch {}
      return next;
    });
  };

  const toggleSortAuthor = () => {
    setSortOption((prev) => {
      let next: SortOption;
      if (prev === 'author_asc') next = 'author_desc';
      else if (prev === 'author_desc') next = 'default';
      else next = 'author_asc';
      try { localStorage.setItem('biblioteca_sort_option', next); } catch {}
      return next;
    });
  };

  // Count active non-default filters (category, saga, year, month)
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedCategoryFilter !== 'todos') count++;
    if (selectedSagaFilter !== 'todos') count++;
    if (selectedYearFilter !== 'todos') count++;
    if (selectedMonthFilter !== 'todos') count++;
    return count;
  }, [selectedCategoryFilter, selectedSagaFilter, selectedYearFilter, selectedMonthFilter]);

  // Filter out any potential rogue chapter-derived items and deduplicate books cleanly
  const validBooks = useMemo(() => {
    const real = filterRealBooksOnly(books || []);
    const { deduplicated } = deduplicateBooks(real);
    return deduplicated.map((b) => {
      if (b.status !== 'leido' && b.rating !== 0) {
        return { ...b, rating: 0 };
      }
      return b;
    });
  }, [books]);

  const [isPurging, setIsPurging] = useState(false);
  const rogueCount = Math.max(0, (books?.length || 0) - validBooks.length);

  // Automatically trigger permanent cloud & local purge if rogue chapter books exist
  useEffect(() => {
    if (rogueCount > 0) {
      purgeChapterStandaloneBooks(auth.currentUser?.uid).catch(() => {});
    }
  }, [rogueCount]);

  const handleManualPurge = async () => {
    setIsPurging(true);
    try {
      await purgeChapterStandaloneBooks(auth.currentUser?.uid);
      if (onPurgeChapterBooks) {
        onPurgeChapterBooks();
      }
    } finally {
      setIsPurging(false);
    }
  };

  // Extract all unique sagas across books
  const availableSagas = useMemo(() => {
    const sagaSet = new Set<string>();
    validBooks.forEach((b) => {
      if (b.saga && b.saga.trim()) sagaSet.add(b.saga.trim());
    });
    return Array.from(sagaSet).sort((a, b) =>
      a.localeCompare(b, 'es', { sensitivity: 'base' })
    );
  }, [validBooks]);

  // Extract all unique primary categories across books (la primera es la que manda / la que vale)
  const availableCategories = useMemo(() => {
    const catMap = new Map<string, string>();
    validBooks.forEach((b) => {
      const primary = getBookPrimaryCategory(b);
      if (primary && primary !== 'General') {
        const lower = primary.toLowerCase();
        if (!catMap.has(lower)) {
          catMap.set(lower, primary);
        }
      }
    });

    const hasGeneral = validBooks.some((b) => getBookPrimaryCategory(b) === 'General');
    if (hasGeneral && !catMap.has('general')) {
      catMap.set('general', 'General');
    }

    return Array.from(catMap.values()).sort((a, b) =>
      a.localeCompare(b, 'es', { sensitivity: 'base' })
    );
  }, [validBooks]);

  // Extract all available years across books
  const availableYears = useMemo(() => {
    const yrSet = new Set<number>();
    validBooks.forEach((b) => {
      const info = getBookDateInfo(b);
      info.years.forEach((yr) => yrSet.add(yr));
    });
    if (yrSet.size === 0) {
      yrSet.add(new Date().getFullYear());
    }
    return Array.from(yrSet).sort((a, b) => b - a);
  }, [validBooks]);

  // Reset page to 1 when any filter, search, or sort changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedStatusFilter, selectedCategoryFilter, selectedSagaFilter, selectedYearFilter, selectedMonthFilter, sortOption]);

  // Close open book menu when changing filters or search query
  React.useEffect(() => {
    setActiveMenuBookId(null);
  }, [selectedStatusFilter, selectedCategoryFilter, selectedSagaFilter, selectedYearFilter, selectedMonthFilter, searchQuery, sortOption]);

  // Close open book menu, filter menu, or sort menu when clicking or tapping outside
  React.useEffect(() => {
    if (!activeMenuBookId && !isFilterMenuOpen && !isSortMenuOpen) return;

    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (activeMenuBookId && !target?.closest('[data-book-menu]')) {
        setActiveMenuBookId(null);
      }
      if (isFilterMenuOpen && !target?.closest('[data-filter-menu]')) {
        setIsFilterMenuOpen(false);
      }
      if (isSortMenuOpen && !target?.closest('[data-sort-menu]')) {
        setIsSortMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [activeMenuBookId, isFilterMenuOpen, isSortMenuOpen]);

  // Identify months that correspond to search query tokens
  const queryMatchedMonths = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return [];
    const matched: number[] = [];

    MONTH_NAMES.forEach((mName, idx) => {
      if (
        mName.startsWith(q) ||
        mName.includes(q) ||
        q.includes(mName) ||
        (q.length >= 3 && mName.startsWith(q.substring(0, 3)))
      ) {
        matched.push(idx);
      }
      if (idx === 8 && (q.includes('setiembre') || 'setiembre'.startsWith(q))) {
        matched.push(idx);
      }
    });

    return matched;
  }, [searchQuery]);

  // Base books matching category, saga, year, and month filters (used for tab counts)
  const baseCategoryAndDateBooks = useMemo(() => {
    return validBooks.filter((book) => {
      const matchesCategory =
        selectedCategoryFilter === 'todos' ||
        getBookPrimaryCategory(book).toLowerCase() === selectedCategoryFilter.toLowerCase();

      const matchesSaga =
        selectedSagaFilter === 'todos' ||
        (book.saga && book.saga.trim().toLowerCase() === selectedSagaFilter.toLowerCase());

      const dateInfo = getBookDateInfo(book);
      const matchesYear =
        selectedYearFilter === 'todos' || dateInfo.years.includes(selectedYearFilter);

      const matchesMonth =
        selectedMonthFilter === 'todos' || dateInfo.months.includes(selectedMonthFilter);

      return matchesCategory && matchesSaga && matchesYear && matchesMonth;
    });
  }, [validBooks, selectedCategoryFilter, selectedSagaFilter, selectedYearFilter, selectedMonthFilter]);

  // Filtered and sorted books
  const filteredBooks = useMemo(() => {
    const rawQuery = searchQuery.toLowerCase().trim();

    const filtered = validBooks.filter((book) => {
      const dateInfo = getBookDateInfo(book);

      // Search matching: title, author, saga, category, or month name/date
      let matchesSearch = true;
      if (rawQuery) {
        const matchesText =
          book.title.toLowerCase().includes(rawQuery) ||
          book.author.toLowerCase().includes(rawQuery) ||
          (book.saga && book.saga.toLowerCase().includes(rawQuery)) ||
          (book.category && book.category.toLowerCase().includes(rawQuery)) ||
          (book.description && book.description.toLowerCase().includes(rawQuery)) ||
          (book.genres && book.genres.some((g) => g.toLowerCase().includes(rawQuery)));

        const matchesMonthQuery =
          queryMatchedMonths.length > 0 &&
          dateInfo.months.some((m) => queryMatchedMonths.includes(m));

        const matchesDateToken = dateInfo.tokens.some((token) => token.includes(rawQuery));

        matchesSearch = matchesText || matchesMonthQuery || matchesDateToken;
      }

      // Status filter
      const matchesStatus =
        selectedStatusFilter === 'todos' || book.status === selectedStatusFilter;

      // Category filter
      const matchesCategory =
        selectedCategoryFilter === 'todos' ||
        getBookPrimaryCategory(book).toLowerCase() === selectedCategoryFilter.toLowerCase();

      // Saga filter
      const matchesSaga =
        selectedSagaFilter === 'todos' ||
        (book.saga && book.saga.trim().toLowerCase() === selectedSagaFilter.toLowerCase());

      // Year dropdown filter
      const matchesYearDropdown =
        selectedYearFilter === 'todos' || dateInfo.years.includes(selectedYearFilter);

      // Month dropdown filter
      const matchesMonthDropdown =
        selectedMonthFilter === 'todos' || dateInfo.months.includes(selectedMonthFilter);

      return matchesSearch && matchesStatus && matchesCategory && matchesSaga && matchesYearDropdown && matchesMonthDropdown;
    });

    // 1. Sort by read date descending (most recently finished first)
    if (sortOption === 'read_desc') {
      return [...filtered].sort((a, b) => {
        const isReadA = isBookRead(a);
        const isReadB = isBookRead(b);

        if (isReadA && !isReadB) return -1;
        if (!isReadA && isReadB) return 1;

        if (isReadA && isReadB) {
          const timeA = getBookReadTimestamp(a);
          const timeB = getBookReadTimestamp(b);
          if (timeA !== timeB) return timeB - timeA;
          return a.title.localeCompare(b.title, 'es', { sensitivity: 'base', numeric: true });
        }

        return a.title.localeCompare(b.title, 'es', { sensitivity: 'base', numeric: true });
      });
    }

    // 2. Sort by read date ascending (earliest finished first)
    if (sortOption === 'read_asc') {
      return [...filtered].sort((a, b) => {
        const isReadA = isBookRead(a);
        const isReadB = isBookRead(b);

        if (isReadA && !isReadB) return -1;
        if (!isReadA && isReadB) return 1;

        if (isReadA && isReadB) {
          const timeA = getBookReadTimestamp(a);
          const timeB = getBookReadTimestamp(b);
          if (timeA !== timeB) return timeA - timeB;
          return a.title.localeCompare(b.title, 'es', { sensitivity: 'base', numeric: true });
        }

        return a.title.localeCompare(b.title, 'es', { sensitivity: 'base', numeric: true });
      });
    }

    // 3. Alphabetical by Title A - Z
    if (sortOption === 'title_asc') {
      return [...filtered].sort((a, b) =>
        a.title.localeCompare(b.title, 'es', { sensitivity: 'base', numeric: true })
      );
    }

    // 4. Alphabetical by Title Z - A
    if (sortOption === 'title_desc') {
      return [...filtered].sort((a, b) =>
        b.title.localeCompare(a.title, 'es', { sensitivity: 'base', numeric: true })
      );
    }

    // 5. Alphabetical by Author A - Z
    if (sortOption === 'author_asc') {
      return [...filtered].sort((a, b) => {
        const cmp = (a.author || '').localeCompare(b.author || '', 'es', { sensitivity: 'base', numeric: true });
        if (cmp !== 0) return cmp;
        return a.title.localeCompare(b.title, 'es', { sensitivity: 'base', numeric: true });
      });
    }

    // 6. Alphabetical by Author Z - A
    if (sortOption === 'author_desc') {
      return [...filtered].sort((a, b) => {
        const cmp = (b.author || '').localeCompare(a.author || '', 'es', { sensitivity: 'base', numeric: true });
        if (cmp !== 0) return cmp;
        return b.title.localeCompare(a.title, 'es', { sensitivity: 'base', numeric: true });
      });
    }

    // 7. By Rating (Highest to Lowest)
    if (sortOption === 'rating_desc') {
      return [...filtered].sort((a, b) => (b.rating || 0) - (a.rating || 0) || a.title.localeCompare(b.title, 'es'));
    }

    // 8. By Pages (Most to Least)
    if (sortOption === 'pages_desc') {
      return [...filtered].sort((a, b) => (b.totalPages || 0) - (a.totalPages || 0) || a.title.localeCompare(b.title, 'es'));
    }

    // 9. By Pages (Least to Most)
    if (sortOption === 'pages_asc') {
      return [...filtered].sort((a, b) => (a.totalPages || 0) - (b.totalPages || 0) || a.title.localeCompare(b.title, 'es'));
    }

    // 10. Default order: If filtered by saga, sort by saga reading order (sagaOrder)
    if (selectedSagaFilter !== 'todos') {
      return [...filtered].sort((a, b) => {
        const orderA = a.sagaOrder ?? 9999;
        const orderB = b.sagaOrder ?? 9999;
        if (orderA !== orderB) return orderA - orderB;
        return a.title.localeCompare(b.title);
      });
    }

    return filtered;
  }, [validBooks, searchQuery, queryMatchedMonths, selectedStatusFilter, selectedCategoryFilter, selectedSagaFilter, selectedYearFilter, selectedMonthFilter, sortOption]);

  const totalPages = Math.max(1, Math.ceil(filteredBooks.length / booksPerPage));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safeCurrentPage - 1) * booksPerPage;
  const endIndex = Math.min(startIndex + booksPerPage, filteredBooks.length);
  const paginatedBooks = useMemo(() => {
    return filteredBooks.slice(startIndex, startIndex + booksPerPage);
  }, [filteredBooks, startIndex, booksPerPage]);

  const handlePageChange = (newPage: number) => {
    const clamped = Math.min(Math.max(1, newPage), totalPages);
    setCurrentPage(clamped);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'leido':
      case 'read':
      case 'terminado':
        return {
          label: 'Leído',
          bg: 'bg-zinc-900 text-white border-zinc-900',
        };
      case 'leyendo':
      case 'reading':
      case 'en_progreso':
        return {
          label: 'Leyendo',
          bg: 'bg-zinc-200 text-zinc-900 border-zinc-300',
        };
      case 'pausado':
      case 'paused':
        return {
          label: 'Pausado',
          bg: 'bg-amber-100 text-amber-900 border-amber-300 font-bold',
        };
      case 'abandonado':
      case 'abandoned':
      case 'dropped':
        return {
          label: 'Abandonado',
          bg: 'bg-neutral-100 text-neutral-500 border-neutral-300 line-through',
        };
      case 'pendiente':
      case 'pending':
      case 'unread':
      default:
        return {
          label: 'Pendiente',
          bg: 'bg-zinc-100 text-zinc-700 border-zinc-200',
        };
    }
  };

  const getSortLabel = (opt: SortOption) => {
    switch (opt) {
      case 'read_desc': return 'Leídos: Más recientes';
      case 'read_asc': return 'Leídos: Primeros leídos';
      case 'title_asc': return 'Título: A - Z';
      case 'title_desc': return 'Título: Z - A';
      case 'author_asc': return 'Autor: A - Z';
      case 'author_desc': return 'Autor: Z - A';
      case 'rating_desc': return 'Mayor calificación';
      case 'pages_desc': return 'Más páginas';
      case 'pages_asc': return 'Menos páginas';
      case 'default':
      default: return 'Por defecto';
    }
  };

  // Helper to format date label
  const formatBookDate = (book: Book) => {
    if (book.endDate) {
      const parts = book.endDate.split(/[-/]/);
      if (parts.length >= 2) {
        const m = parseInt(parts[1], 10) - 1;
        const d = parts[2] || parts[0];
        if (m >= 0 && m <= 11) {
          return `${MONTH_DISPLAY[m]} ${d ? `(${book.endDate})` : ''}`;
        }
      }
      return book.endDate;
    }
    if (book.startDate) {
      const parts = book.startDate.split(/[-/]/);
      if (parts.length >= 2) {
        const m = parseInt(parts[1], 10) - 1;
        if (m >= 0 && m <= 11) {
          return `${MONTH_DISPLAY[m]} ${book.readYear || ''}`;
        }
      }
    }
    return null;
  };

  return (
    <div className="px-3 sm:px-4 lg:px-6 py-2 space-y-3.5 w-full max-w-lg md:max-w-3xl lg:max-w-7xl mx-auto pb-20">
      {/* Purge banner if rogue chapters are detected */}
      {rogueCount > 0 && (
        <div className="bg-zinc-900 text-white rounded-2xl p-3.5 flex items-center justify-between gap-3 text-xs shadow-md animate-in fade-in border border-zinc-800">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-zinc-300 shrink-0" />
            <span className="text-[12px] leading-tight">
              Se detectaron <strong>{rogueCount}</strong> capítulos sueltos. Están ocultos de tu biblioteca y guardados dentro de sus libros respectivos.
            </span>
          </div>
          <button
            onClick={handleManualPurge}
            disabled={isPurging}
            className="px-3 py-1.5 bg-white hover:bg-zinc-100 disabled:opacity-50 text-zinc-900 font-bold rounded-xl text-[11px] whitespace-nowrap shrink-0 cursor-pointer shadow-xs transition-all active:scale-95"
          >
            {isPurging ? 'Limpiando...' : 'Limpiar permanentemente'}
          </button>
        </div>
      )}

      {/* Provisional Titles Warning & Assistant Banner */}
      {provisionalBooks.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-950 rounded-2xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-xs animate-in fade-in">
          <div className="flex items-start sm:items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
            <div>
              <p className="font-bold text-xs sm:text-sm text-zinc-900 leading-snug">
                Se detectaron {provisionalBooks.length} libro{provisionalBooks.length > 1 ? 's' : ''} con nombres provisionales (&quot;Libro recuperado&quot;)
              </p>
              <p className="text-zinc-600 text-[11px] leading-tight mt-0.5">
                Tienen sus portadas intactas. Usa el asistente rápido para asignarles el título y autor real en segundos.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setSelectedFixBookId(null);
              setIsTitleFixModalOpen(true);
            }}
            className="w-full sm:w-auto px-3.5 py-2 bg-zinc-900 hover:bg-black text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer transition-all active:scale-95 shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Asistente de Títulos ({provisionalBooks.length})</span>
          </button>
        </div>
      )}

      {/* Search & Add Button Bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por título, autor, saga o mes (ej. marzo, 01-03)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white rounded-2xl pl-9 pr-8 py-2.5 text-xs text-zinc-900 font-medium border border-zinc-200 shadow-xs focus:outline-none focus:ring-2 focus:ring-zinc-800 placeholder:text-zinc-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 text-xs hover:text-zinc-600 font-bold p-1"
            >
              ✕
            </button>
          )}
        </div>

        <button
          onClick={onOpenAddModal}
          className="p-2.5 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-white shadow-xs hover:shadow-md transition-all active:scale-95 flex items-center justify-center shrink-0"
          title="Añadir libro nuevo"
        >
          <Plus className="w-5 h-5 stroke-[2.5]" />
        </button>
      </div>

      {/* Quick Category, Year, Month & Status Filters */}
      <div className="space-y-2">
        {/* Actions Bar: Single "Filtrar" Button & Sort by Read Date Button */}
        <div className="flex items-center gap-2">
          {/* Unified Filter Button & Dropdown */}
          <div className="relative" data-filter-menu>
            <button
              onClick={() => setIsFilterMenuOpen((prev) => !prev)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-bold transition-all shadow-2xs shrink-0 active:scale-95 cursor-pointer ${
                activeFiltersCount > 0
                  ? 'bg-zinc-900 text-white border-zinc-900 shadow-xs'
                  : 'bg-white text-zinc-800 hover:bg-zinc-100 border-zinc-200'
              }`}
              title="Filtrar por categoría, año o mes"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Filtrar</span>
              {activeFiltersCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-white text-zinc-900 text-[10px] font-black flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              )}
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                  isFilterMenuOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* Dropdown Popover with Categoría, Año, and Mes options */}
            {isFilterMenuOpen && (
              <div
                className="absolute top-full left-0 mt-2 w-72 sm:w-80 bg-white border border-zinc-200 rounded-2xl shadow-xl p-3.5 space-y-3 z-40 animate-in fade-in zoom-in-95 duration-150"
              >
                {/* Header */}
                <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
                  <div className="flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-800" />
                    <span className="text-xs font-bold text-zinc-900">Filtrar por:</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {activeFiltersCount > 0 && (
                      <button
                        onClick={() => {
                          setSelectedCategoryFilter('todos');
                          setSelectedSagaFilter('todos');
                          setSelectedYearFilter('todos');
                          setSelectedMonthFilter('todos');
                        }}
                        className="text-[11px] font-bold text-red-600 hover:text-red-700 cursor-pointer"
                      >
                        Restablecer
                      </button>
                    )}
                    <button
                      onClick={() => setIsFilterMenuOpen(false)}
                      className="text-zinc-400 hover:text-zinc-600 p-0.5 cursor-pointer"
                      title="Cerrar filtros"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* 1. Categoría option */}
                <div className="space-y-1">
                  <label className="flex items-center justify-between text-[11px] font-bold text-zinc-700">
                    <span className="flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-zinc-500" />
                      Categoría
                    </span>
                    {selectedCategoryFilter !== 'todos' && (
                      <button
                        onClick={() => setSelectedCategoryFilter('todos')}
                        className="text-[10px] text-zinc-400 hover:text-zinc-600 font-semibold cursor-pointer"
                      >
                        Limpiar
                      </button>
                    )}
                  </label>
                  <select
                    value={selectedCategoryFilter}
                    onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                    className="w-full bg-zinc-50 hover:bg-zinc-100/80 border border-zinc-200 rounded-xl px-2.5 py-2 text-xs font-semibold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-800 cursor-pointer transition-colors"
                  >
                    <option value="todos">Todas las categorías</option>
                    {availableCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Saga option */}
                {availableSagas.length > 0 && (
                  <div className="space-y-1">
                    <label className="flex items-center justify-between text-[11px] font-bold text-zinc-700">
                      <span className="flex items-center gap-1.5">
                        <BookMarked className="w-3.5 h-3.5 text-zinc-500" />
                        Saga / Colección
                      </span>
                      {selectedSagaFilter !== 'todos' && (
                        <button
                          onClick={() => setSelectedSagaFilter('todos')}
                          className="text-[10px] text-zinc-400 hover:text-zinc-600 font-semibold cursor-pointer"
                        >
                          Limpiar
                        </button>
                      )}
                    </label>
                    <select
                      value={selectedSagaFilter}
                      onChange={(e) => setSelectedSagaFilter(e.target.value)}
                      className="w-full bg-zinc-50 hover:bg-zinc-100/80 border border-zinc-200 rounded-xl px-2.5 py-2 text-xs font-semibold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-800 cursor-pointer transition-colors"
                    >
                      <option value="todos">Todas las sagas</option>
                      {availableSagas.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* 3. Año option */}
                <div className="space-y-1">
                  <label className="flex items-center justify-between text-[11px] font-bold text-zinc-700">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                      Año
                    </span>
                    {selectedYearFilter !== 'todos' && (
                      <button
                        onClick={() => setSelectedYearFilter('todos')}
                        className="text-[10px] text-zinc-400 hover:text-zinc-600 font-semibold cursor-pointer"
                      >
                        Limpiar
                      </button>
                    )}
                  </label>
                  <select
                    value={selectedYearFilter}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedYearFilter(val === 'todos' ? 'todos' : parseInt(val, 10));
                    }}
                    className="w-full bg-zinc-50 hover:bg-zinc-100/80 border border-zinc-200 rounded-xl px-2.5 py-2 text-xs font-semibold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-800 cursor-pointer transition-colors"
                  >
                    <option value="todos">Todos los años</option>
                    {availableYears.map((yr) => (
                      <option key={yr} value={yr}>
                        {yr}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 4. Mes option */}
                <div className="space-y-1">
                  <label className="flex items-center justify-between text-[11px] font-bold text-zinc-700">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                      Mes
                    </span>
                    {selectedMonthFilter !== 'todos' && (
                      <button
                        onClick={() => setSelectedMonthFilter('todos')}
                        className="text-[10px] text-zinc-400 hover:text-zinc-600 font-semibold cursor-pointer"
                      >
                        Limpiar
                      </button>
                    )}
                  </label>
                  <select
                    value={selectedMonthFilter}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedMonthFilter(val === 'todos' ? 'todos' : parseInt(val, 10));
                    }}
                    className="w-full bg-zinc-50 hover:bg-zinc-100/80 border border-zinc-200 rounded-xl px-2.5 py-2 text-xs font-semibold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-800 cursor-pointer transition-colors"
                  >
                    <option value="todos">Todos los meses</option>
                    {MONTH_DISPLAY.map((m, idx) => (
                      <option key={m} value={idx}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Close / Apply button */}
                <div className="pt-1">
                  <button
                    onClick={() => setIsFilterMenuOpen(false)}
                    className="w-full bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold py-2 rounded-xl transition-all cursor-pointer text-center active:scale-98 shadow-xs"
                  >
                    Ver libros ({filteredBooks.length})
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Unified Sort Button & Popover Dropdown */}
          <div className="relative" data-sort-menu>
            <button
              onClick={() => setIsSortMenuOpen((prev) => !prev)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-bold transition-all shadow-2xs shrink-0 active:scale-95 cursor-pointer ${
                sortOption !== 'default'
                  ? 'bg-zinc-900 text-white border-zinc-900 shadow-xs'
                  : 'bg-white text-zinc-800 hover:bg-zinc-100 border-zinc-200'
              }`}
              title="Opciones de ordenación"
            >
              <ArrowUpDown className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Ordenar</span>
              {sortOption !== 'default' && (
                <span className="max-w-[100px] truncate text-[10px] font-medium opacity-90 hidden sm:inline">
                  {sortOption === 'title_asc' ? 'A-Z' :
                   sortOption === 'title_desc' ? 'Z-A' :
                   sortOption === 'author_asc' ? 'Autor A-Z' :
                   sortOption === 'author_desc' ? 'Autor Z-A' :
                   sortOption === 'read_desc' ? 'Leídos (recientes)' :
                   sortOption === 'read_asc' ? 'Leídos (primeros)' : ''}
                </span>
              )}
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                  isSortMenuOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* Dropdown Popover for Sorting */}
            {isSortMenuOpen && (
              <div
                className="absolute top-full left-0 mt-2 w-72 sm:w-80 bg-white border border-zinc-200 rounded-2xl shadow-xl p-3.5 space-y-3 z-40 animate-in fade-in zoom-in-95 duration-150"
              >
                {/* Header */}
                <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
                  <div className="flex items-center gap-1.5">
                    <ArrowUpDown className="w-3.5 h-3.5 text-zinc-800" />
                    <span className="text-xs font-bold text-zinc-900">Ordenar biblioteca por:</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {sortOption !== 'default' && (
                      <button
                        onClick={() => handleSetSortOption('default')}
                        className="text-[11px] font-bold text-red-600 hover:text-red-700 cursor-pointer"
                      >
                        Restablecer
                      </button>
                    )}
                    <button
                      onClick={() => setIsSortMenuOpen(false)}
                      className="text-zinc-400 hover:text-zinc-600 p-0.5 cursor-pointer"
                      title="Cerrar ordenación"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Sort Option Groups */}
                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                  {/* Grupo 1: Por Fecha de Lectura */}
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 px-1">
                      Lectura & Leídos
                    </span>
                    <div className="mt-1 space-y-1">
                      <button
                        onClick={() => handleSetSortOption('read_desc')}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-semibold text-left transition-colors cursor-pointer ${
                          sortOption === 'read_desc'
                            ? 'bg-zinc-900 text-white'
                            : 'text-zinc-700 hover:bg-zinc-100'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Leídos: Más recientes primero</span>
                        </div>
                        {sortOption === 'read_desc' && <Check className="w-3.5 h-3.5" />}
                      </button>

                      <button
                        onClick={() => handleSetSortOption('read_asc')}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-semibold text-left transition-colors cursor-pointer ${
                          sortOption === 'read_asc'
                            ? 'bg-zinc-900 text-white'
                            : 'text-zinc-700 hover:bg-zinc-100'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Leídos: Primeros leídos primero</span>
                        </div>
                        {sortOption === 'read_asc' && <Check className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Grupo 2: Alfabético por Título */}
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 px-1">
                      Abecedario (Título)
                    </span>
                    <div className="mt-1 space-y-1">
                      <button
                        onClick={() => handleSetSortOption('title_asc')}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-semibold text-left transition-colors cursor-pointer ${
                          sortOption === 'title_asc'
                            ? 'bg-zinc-900 text-white'
                            : 'text-zinc-700 hover:bg-zinc-100'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="w-3.5 h-3.5" />
                          <span>Título: A → Z</span>
                        </div>
                        {sortOption === 'title_asc' && <Check className="w-3.5 h-3.5" />}
                      </button>

                      <button
                        onClick={() => handleSetSortOption('title_desc')}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-semibold text-left transition-colors cursor-pointer ${
                          sortOption === 'title_desc'
                            ? 'bg-zinc-900 text-white'
                            : 'text-zinc-700 hover:bg-zinc-100'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="w-3.5 h-3.5" />
                          <span>Título: Z → A</span>
                        </div>
                        {sortOption === 'title_desc' && <Check className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Grupo 3: Alfabético por Autor */}
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 px-1">
                      Abecedario (Autor)
                    </span>
                    <div className="mt-1 space-y-1">
                      <button
                        onClick={() => handleSetSortOption('author_asc')}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-semibold text-left transition-colors cursor-pointer ${
                          sortOption === 'author_asc'
                            ? 'bg-zinc-900 text-white'
                            : 'text-zinc-700 hover:bg-zinc-100'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <User className="w-3.5 h-3.5" />
                          <span>Autor: A → Z</span>
                        </div>
                        {sortOption === 'author_asc' && <Check className="w-3.5 h-3.5" />}
                      </button>

                      <button
                        onClick={() => handleSetSortOption('author_desc')}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-semibold text-left transition-colors cursor-pointer ${
                          sortOption === 'author_desc'
                            ? 'bg-zinc-900 text-white'
                            : 'text-zinc-700 hover:bg-zinc-100'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <User className="w-3.5 h-3.5" />
                          <span>Autor: Z → A</span>
                        </div>
                        {sortOption === 'author_desc' && <Check className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Grupo 4: Calificación & Páginas */}
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 px-1">
                      Calificación y Extensión
                    </span>
                    <div className="mt-1 space-y-1">
                      <button
                        onClick={() => handleSetSortOption('rating_desc')}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-semibold text-left transition-colors cursor-pointer ${
                          sortOption === 'rating_desc'
                            ? 'bg-zinc-900 text-white'
                            : 'text-zinc-700 hover:bg-zinc-100'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                          <span>Mayor calificación</span>
                        </div>
                        {sortOption === 'rating_desc' && <Check className="w-3.5 h-3.5" />}
                      </button>

                      <button
                        onClick={() => handleSetSortOption('pages_desc')}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-semibold text-left transition-colors cursor-pointer ${
                          sortOption === 'pages_desc'
                            ? 'bg-zinc-900 text-white'
                            : 'text-zinc-700 hover:bg-zinc-100'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Layers className="w-3.5 h-3.5" />
                          <span>Más páginas</span>
                        </div>
                        {sortOption === 'pages_desc' && <Check className="w-3.5 h-3.5" />}
                      </button>

                      <button
                        onClick={() => handleSetSortOption('pages_asc')}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-semibold text-left transition-colors cursor-pointer ${
                          sortOption === 'pages_asc'
                            ? 'bg-zinc-900 text-white'
                            : 'text-zinc-700 hover:bg-zinc-100'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Layers className="w-3.5 h-3.5" />
                          <span>Menos páginas</span>
                        </div>
                        {sortOption === 'pages_asc' && <Check className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Reset button */}
                <div className="pt-1 border-t border-zinc-100">
                  <button
                    onClick={() => handleSetSortOption('default')}
                    className={`w-full text-xs font-bold py-2 rounded-xl transition-all cursor-pointer text-center active:scale-98 border ${
                      sortOption === 'default'
                        ? 'bg-zinc-100 text-zinc-600 border-zinc-200'
                        : 'bg-zinc-900 hover:bg-zinc-800 text-white border-zinc-900 shadow-xs'
                    }`}
                  >
                    {sortOption === 'default' ? 'Orden por defecto (Activo)' : 'Restablecer orden por defecto'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Quick Sort Shortcut: Por Leídos */}
          <button
            onClick={toggleSortReadDate}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-bold transition-all shadow-2xs shrink-0 active:scale-95 cursor-pointer ${
              sortOption === 'read_desc' || sortOption === 'read_asc'
                ? 'bg-zinc-900 text-white border-zinc-900'
                : 'bg-white text-zinc-700 hover:bg-zinc-100 border-zinc-200'
            }`}
            title={
              sortOption === 'read_desc'
                ? 'Orden actual: Leídos recientes (clic para ver primeros leídos)'
                : sortOption === 'read_asc'
                ? 'Orden actual: Primeros leídos (clic para restablecer)'
                : 'Ordenar por libros leídos (recientes primero)'
            }
          >
            {sortOption === 'read_desc' ? (
              <ArrowDown className="w-3.5 h-3.5 stroke-[2.5] text-white animate-in zoom-in-75 duration-150" />
            ) : sortOption === 'read_asc' ? (
              <ArrowUp className="w-3.5 h-3.5 stroke-[2.5] text-white animate-in zoom-in-75 duration-150" />
            ) : (
              <Clock className="w-3.5 h-3.5 text-zinc-600" />
            )}
            <span>
              {sortOption === 'read_desc'
                ? 'Leídos (recientes)'
                : sortOption === 'read_asc'
                ? 'Leídos (primeros)'
                : 'Por leídos'}
            </span>
          </button>

          {/* Quick Sort Shortcut: Título A-Z */}
          <button
            onClick={toggleSortTitle}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-bold transition-all shadow-2xs shrink-0 active:scale-95 cursor-pointer ${
              sortOption === 'title_asc' || sortOption === 'title_desc'
                ? 'bg-zinc-900 text-white border-zinc-900'
                : 'bg-white text-zinc-700 hover:bg-zinc-100 border-zinc-200'
            }`}
            title={
              sortOption === 'title_asc'
                ? 'Orden actual: Título A → Z (clic para Z → A)'
                : sortOption === 'title_desc'
                ? 'Orden actual: Título Z → A (clic para restablecer)'
                : 'Ordenar alfabéticamente por título (A → Z)'
            }
          >
            {sortOption === 'title_desc' ? (
              <ArrowDown className="w-3.5 h-3.5 stroke-[2.5] text-white animate-in zoom-in-75 duration-150" />
            ) : sortOption === 'title_asc' ? (
              <ArrowUp className="w-3.5 h-3.5 stroke-[2.5] text-white animate-in zoom-in-75 duration-150" />
            ) : (
              <FileText className="w-3.5 h-3.5 text-zinc-600" />
            )}
            <span>
              {sortOption === 'title_asc'
                ? 'Título (A-Z)'
                : sortOption === 'title_desc'
                ? 'Título (Z-A)'
                : 'Título'}
            </span>
          </button>

          {/* Quick Sort Shortcut: Autor A-Z */}
          <button
            onClick={toggleSortAuthor}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-bold transition-all shadow-2xs shrink-0 active:scale-95 cursor-pointer ${
              sortOption === 'author_asc' || sortOption === 'author_desc'
                ? 'bg-zinc-900 text-white border-zinc-900'
                : 'bg-white text-zinc-700 hover:bg-zinc-100 border-zinc-200'
            }`}
            title={
              sortOption === 'author_asc'
                ? 'Orden actual: Autor A → Z (clic para Z → A)'
                : sortOption === 'author_desc'
                ? 'Orden actual: Autor Z → A (clic para restablecer)'
                : 'Ordenar alfabéticamente por autor (A → Z)'
            }
          >
            {sortOption === 'author_desc' ? (
              <ArrowDown className="w-3.5 h-3.5 stroke-[2.5] text-white animate-in zoom-in-75 duration-150" />
            ) : sortOption === 'author_asc' ? (
              <ArrowUp className="w-3.5 h-3.5 stroke-[2.5] text-white animate-in zoom-in-75 duration-150" />
            ) : (
              <User className="w-3.5 h-3.5 text-zinc-600" />
            )}
            <span>
              {sortOption === 'author_asc'
                ? 'Autor (A-Z)'
                : sortOption === 'author_desc'
                ? 'Autor (Z-A)'
                : 'Autor'}
            </span>
          </button>
        </div>

        {/* Active Filter & Sort Badges */}
        {(selectedCategoryFilter !== 'todos' || selectedSagaFilter !== 'todos' || selectedYearFilter !== 'todos' || selectedMonthFilter !== 'todos' || sortOption !== 'default') && (
          <div className="flex items-center gap-1.5 flex-wrap pt-0.5 animate-in fade-in">
            {sortOption !== 'default' && (
              <div className="inline-flex items-center gap-1 bg-zinc-900 text-white border border-zinc-800 text-[11px] font-bold px-2.5 py-1 rounded-xl shrink-0 shadow-2xs">
                <ArrowUpDown className="w-3 h-3 text-zinc-300" />
                <span>Orden: {getSortLabel(sortOption)}</span>
                <button
                  onClick={() => handleSetSortOption('default')}
                  className="hover:text-zinc-300 ml-0.5 cursor-pointer"
                  title="Restablecer orden"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            {selectedCategoryFilter !== 'todos' && (
              <div className="inline-flex items-center gap-1 bg-zinc-200 text-zinc-900 border border-zinc-300 text-[11px] font-bold px-2.5 py-1 rounded-xl shrink-0">
                <Tag className="w-3 h-3 text-zinc-700" />
                <span>{selectedCategoryFilter}</span>
                <button
                  onClick={() => setSelectedCategoryFilter('todos')}
                  className="hover:text-black ml-0.5 cursor-pointer"
                  title="Limpiar filtro de categoría"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {selectedSagaFilter !== 'todos' && (
              <div className="inline-flex items-center gap-1 bg-zinc-900 text-white border border-zinc-800 text-[11px] font-bold px-2.5 py-1 rounded-xl shrink-0 shadow-2xs">
                <BookMarked className="w-3 h-3 text-zinc-300" />
                <span>Saga: {selectedSagaFilter}</span>
                <button
                  onClick={() => setSelectedSagaFilter('todos')}
                  className="hover:text-zinc-300 ml-0.5 cursor-pointer"
                  title="Limpiar filtro de saga"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {selectedYearFilter !== 'todos' && (
              <div className="inline-flex items-center gap-1 bg-zinc-200 text-zinc-900 border border-zinc-300 text-[11px] font-bold px-2.5 py-1 rounded-xl shrink-0">
                <Calendar className="w-3 h-3 text-zinc-700" />
                <span>Año {selectedYearFilter}</span>
                <button
                  onClick={() => setSelectedYearFilter('todos')}
                  className="hover:text-black ml-0.5 cursor-pointer"
                  title="Limpiar filtro de año"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {selectedMonthFilter !== 'todos' && (
              <div className="inline-flex items-center gap-1 bg-zinc-200 text-zinc-900 border border-zinc-300 text-[11px] font-bold px-2.5 py-1 rounded-xl shrink-0">
                <Calendar className="w-3 h-3 text-zinc-700" />
                <span>{MONTH_DISPLAY[selectedMonthFilter]}</span>
                <button
                  onClick={() => setSelectedMonthFilter('todos')}
                  className="hover:text-black ml-0.5 cursor-pointer"
                  title="Limpiar filtro de mes"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            <button
              onClick={() => {
                setSelectedCategoryFilter('todos');
                setSelectedSagaFilter('todos');
                setSelectedYearFilter('todos');
                setSelectedMonthFilter('todos');
              }}
              className="text-[10px] font-bold text-zinc-500 hover:text-zinc-900 underline ml-1 cursor-pointer shrink-0"
            >
              Limpiar filtros
            </button>
          </div>
        )}

        {/* Search Query Month Match Highlight */}
        {queryMatchedMonths.length > 0 && selectedMonthFilter === 'todos' && (
          <div className="text-[10px] text-zinc-700 font-semibold bg-zinc-100 px-2 py-1 rounded-lg border border-zinc-200 truncate">
            Filtrando por mes: <span className="font-bold">{queryMatchedMonths.map((m) => MONTH_DISPLAY[m]).join(', ')}</span>
          </div>
        )}

        {/* Filter Tabs / Pills with Touch & Drag Swipe */}
      <div className="relative -mx-4 px-4">
        <div
          className="flex items-center gap-2 overflow-x-auto pb-1.5 pt-0.5 no-scrollbar scroll-smooth overscroll-x-contain touch-pan-x select-none"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {[
            { id: 'todos', label: 'Todos' },
            { id: 'leyendo', label: 'Leyendo' },
            { id: 'pausado', label: 'Pausados' },
            { id: 'pendiente', label: 'Pendientes' },
            { id: 'leido', label: 'Leídos' },
            { id: 'abandonado', label: 'Abandonados' },
          ].map((tab) => {
            const count =
              tab.id === 'todos'
                ? baseCategoryAndDateBooks.length
                : baseCategoryAndDateBooks.filter((b) => b.status === tab.id).length;

              const isActive = selectedStatusFilter === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setSelectedStatusFilter(tab.id as any);
                    setActiveMenuBookId(null);
                  }}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 active:scale-95 shadow-2xs ${
                    isActive
                      ? 'bg-zinc-900 text-white shadow-zinc-300'
                      : 'bg-white text-zinc-700 hover:bg-zinc-100 border border-zinc-200'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                      isActive ? 'bg-white/25 text-white' : 'bg-zinc-100 text-zinc-800'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Books Grid & Controls */}
      {filteredBooks.length === 0 ? (
        <div className="bg-white rounded-3xl p-8 text-center border border-zinc-200 text-zinc-400">
          <BookOpen className="w-10 h-10 mx-auto mb-2 text-zinc-300" />
          <p className="text-sm font-bold text-zinc-700">No se encontraron libros</p>
          <p className="text-xs text-zinc-400 mt-1">
            {searchQuery || selectedMonthFilter !== 'todos' || selectedCategoryFilter !== 'todos' || selectedYearFilter !== 'todos' || selectedStatusFilter !== 'todos'
              ? 'Prueba con otro término de búsqueda o limpia los filtros activos.'
              : 'Agrega un libro para comenzar a poblar tu biblioteca.'}
          </p>
          {(searchQuery || selectedMonthFilter !== 'todos' || selectedCategoryFilter !== 'todos' || selectedYearFilter !== 'todos' || selectedStatusFilter !== 'todos') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategoryFilter('todos');
                setSelectedYearFilter('todos');
                setSelectedMonthFilter('todos');
                setSelectedStatusFilter('todos');
              }}
              className="mt-3 px-3.5 py-1.5 bg-zinc-100 text-zinc-900 hover:bg-zinc-200 text-xs font-bold rounded-xl border border-zinc-300 transition-colors cursor-pointer"
            >
              Limpiar todos los filtros
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {/* Top Bar for Desktop/Notebook: Count and Books per Page selector */}
          <div className="flex items-center justify-between text-xs text-zinc-500 font-medium px-1">
            <div className="flex items-center gap-2">
              <span>
                Mostrando <strong className="text-zinc-900 font-bold">{startIndex + 1}–{endIndex}</strong> de{' '}
                <strong className="text-zinc-900 font-bold">{filteredBooks.length}</strong> libros
              </span>
              <span className="hidden lg:inline text-zinc-400 text-[11px]">
                (6 columnas · {booksPerPage} por pág.)
              </span>
            </div>

            {/* Quick selector for books per page */}
            <div className="flex items-center gap-1 text-[11px]">
              <span className="hidden sm:inline text-zinc-400">Por pág:</span>
              {[10, 24, 48].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => handleSetBooksPerPage(count)}
                  className={`px-2 py-0.5 rounded-lg font-bold transition-all cursor-pointer ${
                    booksPerPage === count
                      ? 'bg-zinc-900 text-white shadow-xs'
                      : 'bg-white hover:bg-zinc-100 text-zinc-600 border border-zinc-200'
                  }`}
                  title={`Mostrar ${count} libros por página`}
                >
                  {count}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-3.5 lg:gap-4">
            {paginatedBooks.map((book) => {
              const statusInfo = getStatusBadge(book.status);
              const isMenuOpen = activeMenuBookId === book.id;
              const dateLabel = formatBookDate(book);
              const readingDuration = getReadingDuration(book);

              return (
                <div
                  key={book.id}
                  className="bg-white rounded-2xl p-2.5 border border-zinc-200/80 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between relative group"
                >
                  {/* Top Actions / Menu Toggle */}
                  <div className="relative">
                    {/* Book Cover Container (Tocar imagen para abrir ficha completa) */}
                    <div
                      onClick={() => onViewBookDetail?.(book)}
                      className="w-full aspect-[3/4.2] rounded-xl overflow-hidden shadow-2xs bg-zinc-100 relative mb-2 border border-zinc-200 cursor-pointer active:scale-[0.98] transition-transform group/cover"
                      title="Toca la imagen para ver la ficha completa del libro"
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onViewBookDetail?.(book);
                        }
                      }}
                    >
                      <BookCoverImage
                        src={book.coverImage}
                        alt={book.title}
                        bookId={book.id}
                        fallbackTitle={book.title}
                        coverColor={book.coverColor}
                        className="w-full h-full object-cover group-hover/cover:scale-105 transition-transform duration-300"
                      />

                      {/* Status Badge */}
                      <span
                        className={`absolute top-1.5 left-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-md border backdrop-blur-xs ${statusInfo.bg}`}
                      >
                        {statusInfo.label}
                      </span>

                      {/* Format Badge */}
                      <span className="absolute top-1.5 right-1.5 text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded-md bg-black/70 text-white backdrop-blur-xs">
                        {book.format === 'digital' ? 'DIG' : 'FÍS'}
                      </span>

                      {/* Options 3-dots button */}
                      <button
                        data-book-menu={book.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuBookId(isMenuOpen ? null : book.id);
                        }}
                        className="absolute bottom-1.5 right-1.5 w-6 h-6 rounded-full bg-white/90 backdrop-blur-xs text-zinc-700 shadow-xs flex items-center justify-center hover:bg-white active:scale-90 z-10"
                        aria-label="Opciones del libro"
                        aria-expanded={isMenuOpen}
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Dropdown Menu */}
                    {isMenuOpen && (
                      <div
                        data-book-menu={book.id}
                        className="absolute right-0 top-12 z-20 w-44 bg-white rounded-xl shadow-lg border border-zinc-200 py-1 text-left text-xs animate-in fade-in zoom-in-95 duration-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => {
                            onViewBookDetail?.(book);
                            setActiveMenuBookId(null);
                          }}
                          className="w-full px-3 py-1.5 text-left text-zinc-800 hover:bg-zinc-100 flex items-center gap-1.5 font-bold cursor-pointer"
                        >
                          <BookOpen className="w-3.5 h-3.5 text-zinc-700" />
                          <span>Ver ficha completa</span>
                        </button>

                        {book.status === 'leyendo' && (
                          <button
                            onClick={() => {
                              onQuickStatusChange(book.id, 'pausado');
                              setActiveMenuBookId(null);
                            }}
                            className="w-full px-3 py-1.5 text-left font-bold text-amber-900 hover:bg-amber-50 flex items-center gap-1.5 cursor-pointer"
                          >
                            <Pause className="w-3.5 h-3.5 text-amber-700" />
                            Pausar lectura
                          </button>
                        )}

                        <button
                          onClick={() => {
                            onOpenChaptersModal(book);
                            setActiveMenuBookId(null);
                          }}
                          className="w-full px-3 py-1.5 text-left text-zinc-700 hover:bg-zinc-100 flex items-center gap-1.5 font-medium cursor-pointer"
                        >
                          <Layers className="w-3.5 h-3.5" />
                          <span>Capítulos ({book.chapters?.length || 0})</span>
                        </button>

                        <button
                          onClick={() => {
                            onOpenEditModal(book);
                            setActiveMenuBookId(null);
                          }}
                          className="w-full px-3 py-1.5 text-left text-zinc-700 hover:bg-zinc-100 flex items-center gap-1.5 font-medium cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          Editar ficha
                        </button>

                        <button
                          onClick={() => {
                            setCoverSearchBook(book);
                            setActiveMenuBookId(null);
                          }}
                          className="w-full px-3 py-1.5 text-left text-zinc-700 hover:bg-zinc-100 flex items-center gap-1.5 font-medium cursor-pointer"
                        >
                          <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
                          <span>Cambiar portada</span>
                        </button>

                        {isCorruptedOrPlaceholderTitle(book.title) && (
                          <button
                            onClick={() => {
                              setSelectedFixBookId(book.id);
                              setIsTitleFixModalOpen(true);
                              setActiveMenuBookId(null);
                            }}
                            className="w-full px-3 py-1.5 text-left font-bold text-amber-900 hover:bg-amber-50 flex items-center gap-1.5 cursor-pointer"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                            <span>Asignar título real</span>
                          </button>
                        )}

                        {book.startDate && onRemoveStartDate && (
                          <button
                            onClick={() => {
                              onRemoveStartDate(book.id);
                              setActiveMenuBookId(null);
                            }}
                            className="w-full px-3 py-1.5 text-left text-red-600 hover:bg-red-50 flex items-center gap-1.5 font-medium cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5 text-red-500" />
                            <span>Quitar fecha inicio</span>
                          </button>
                        )}

                        <div className="h-px bg-zinc-100 my-1" />

                        <button
                          onClick={() => {
                            onOpenDeleteModal(book);
                            setActiveMenuBookId(null);
                          }}
                          className="w-full px-3 py-1.5 text-left text-zinc-600 hover:bg-zinc-100 flex items-center gap-1.5 font-medium cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Eliminar
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      {isCorruptedOrPlaceholderTitle(book.title) ? (
                        <div className="mb-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedFixBookId(book.id);
                              setIsTitleFixModalOpen(true);
                            }}
                            className="w-full py-1 px-2 rounded-lg bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-900 text-[10px] font-bold flex items-center justify-center gap-1 transition-all active:scale-95 shadow-2xs cursor-pointer"
                            title="Asignar título y autor real"
                          >
                            <Sparkles className="w-3 h-3 text-amber-700 shrink-0" />
                            <span className="truncate">Asignar título</span>
                          </button>
                          <span className="text-[9px] text-zinc-400 font-mono block truncate mt-0.5">
                            {book.title}
                          </span>
                        </div>
                      ) : (
                        <>
                          <h3 className="font-bold text-xs text-zinc-900 line-clamp-1 leading-snug">
                            {book.title}
                          </h3>
                          <p className="text-[11px] text-zinc-500 line-clamp-1 mb-1 font-medium">
                            {book.author}
                          </p>
                        </>
                      )}

                      {book.saga && (
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSagaFilter(book.saga!);
                          }}
                          className="flex items-center gap-1 text-[10px] text-zinc-700 font-semibold truncate mb-1 hover:text-zinc-950 cursor-pointer"
                          title={`Filtrar libros de la saga: ${book.saga}`}
                        >
                          <BookMarked className="w-3 h-3 shrink-0 text-zinc-600" />
                          <span className="truncate">{book.saga}</span>
                          {book.sagaOrder !== undefined && book.sagaOrder !== null && (
                            <span className="shrink-0 px-1.5 py-0.2 rounded bg-zinc-900 text-white font-black text-[9px] shadow-2xs">
                              #{book.sagaOrder}
                            </span>
                          )}
                        </div>
                      )}

                      {book.description && (
                        <p
                          className="text-[10px] text-zinc-500 line-clamp-2 leading-tight mb-1 italic"
                          title={book.description}
                        >
                          {book.description}
                        </p>
                      )}

                      {/* Date / Month Tag and Reading Duration side by side */}
                      {(dateLabel || readingDuration) && (
                        <div className="flex flex-wrap items-center gap-1 mb-1.5">
                          {dateLabel && (
                            <div className="inline-flex items-center gap-1 text-[9px] text-zinc-700 font-semibold truncate bg-zinc-100 px-1.5 py-0.5 rounded-md border border-zinc-200 shrink-0">
                              <Calendar className="w-2.5 h-2.5 shrink-0 text-zinc-800" />
                              <span className="truncate max-w-[95px]">{dateLabel}</span>
                            </div>
                          )}

                          {readingDuration && (
                            <div className="inline-flex items-center gap-1 text-[9px] font-bold text-zinc-800 bg-zinc-100 border border-zinc-200/90 px-1.5 py-0.5 rounded-md shrink-0">
                              <Clock className="w-2.5 h-2.5 shrink-0 text-zinc-700 stroke-[2.5]" />
                              <span>{readingDuration.label}</span>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex items-center justify-between text-[10px] text-zinc-400 mb-1.5 gap-1">
                        <span className="shrink-0">{book.totalPages} págs</span>
                        {(() => {
                          const genres = getBookGenres(book);
                          const primaryGenre = genres[0] || book.category || 'General';
                          return (
                            <div
                              className="flex items-center justify-end gap-1 overflow-hidden max-w-[110px]"
                              title={genres.join(', ') || primaryGenre}
                            >
                              <span className="truncate text-right font-medium text-zinc-700">
                                {primaryGenre}
                              </span>
                              {genres.length > 1 && (
                                <span className="shrink-0 text-[9px] font-extrabold px-1 py-0.2 rounded bg-zinc-200 text-zinc-800">
                                  +{genres.length - 1}
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    <div>
                      {/* Stars */}
                      <div className="flex items-center justify-between pt-1 border-t border-zinc-100">
                        <StarRating rating={book.status === 'leido' ? (book.rating || 0) : 0} size="sm" />
                        {(book.status === 'leyendo' || book.status === 'pausado') && (
                          <span className="text-[10px] font-bold text-zinc-900">
                            {Math.round((book.currentPage / book.totalPages) * 100)}%
                          </span>
                        )}
                      </div>

                      {/* Quick action button */}
                      {book.status === 'pendiente' && (
                        <button
                          onClick={() => onSelectActiveBook(book.id)}
                          className="w-full mt-2 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 rounded-lg text-[10px] font-bold transition-colors flex items-center justify-center gap-1 border border-zinc-200 cursor-pointer"
                        >
                          <Play className="w-2.5 h-2.5 fill-zinc-900" /> Comenzar
                        </button>
                      )}
                      {book.status === 'pausado' && (
                        <button
                          onClick={() => onSelectActiveBook(book.id)}
                          className="w-full mt-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[10px] font-bold transition-colors flex items-center justify-center gap-1 shadow-2xs cursor-pointer"
                        >
                          <Play className="w-2.5 h-2.5 fill-white" /> Reanudar
                        </button>
                      )}
                      {book.status === 'leyendo' && (
                        <button
                          onClick={() => onSelectActiveBook(book.id)}
                          className="w-full mt-2 py-1 bg-zinc-900 text-white rounded-lg text-[10px] font-bold shadow-2xs hover:bg-zinc-800 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <BookOpen className="w-2.5 h-2.5" /> Continuar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination Controls - Clean current page indicator and arrows */}
          {totalPages > 1 && (
            <div className="bg-white rounded-2xl px-4 py-3 border border-zinc-200 shadow-2xs select-none">
              <div className="flex items-center justify-between gap-3">
                {/* Previous Page Arrow */}
                <button
                  onClick={() => handlePageChange(safeCurrentPage - 1)}
                  disabled={safeCurrentPage <= 1}
                  className={`px-3.5 py-2 rounded-xl border flex items-center gap-1.5 text-xs font-bold transition-all ${
                    safeCurrentPage <= 1
                      ? 'bg-zinc-50 border-zinc-200 text-zinc-300 cursor-not-allowed'
                      : 'bg-white border-zinc-300 text-zinc-800 hover:bg-zinc-100 active:scale-95 shadow-2xs cursor-pointer'
                  }`}
                  title="Página anterior"
                  aria-label="Página anterior"
                >
                  <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
                  <span className="hidden sm:inline">Anterior</span>
                </button>

                {/* Page Indicator & Books Count */}
                <div className="flex flex-col sm:flex-row items-center gap-0.5 sm:gap-2 text-center justify-center">
                  <span className="text-sm font-black text-zinc-900 tracking-tight">
                    Página {safeCurrentPage} de {totalPages}
                  </span>
                  <span className="text-[11px] text-zinc-500 font-medium">
                    ({startIndex + 1}–{endIndex} de {filteredBooks.length} libros)
                  </span>
                </div>

                {/* Next Page Arrow */}
                <button
                  onClick={() => handlePageChange(safeCurrentPage + 1)}
                  disabled={safeCurrentPage >= totalPages}
                  className={`px-3.5 py-2 rounded-xl border flex items-center gap-1.5 text-xs font-bold transition-all ${
                    safeCurrentPage >= totalPages
                      ? 'bg-zinc-50 border-zinc-200 text-zinc-300 cursor-not-allowed'
                      : 'bg-zinc-900 border-zinc-900 text-white hover:bg-zinc-800 active:scale-95 shadow-2xs cursor-pointer'
                  }`}
                  title="Página siguiente"
                  aria-label="Página siguiente"
                >
                  <span className="hidden sm:inline">Siguiente</span>
                  <ChevronRight className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {coverSearchBook && (
        <CoverSearchModal
          isOpen={true}
          initialTitle={coverSearchBook.title}
          initialAuthor={coverSearchBook.author}
          onClose={() => setCoverSearchBook(null)}
          onSelectCover={(coverUrl) => {
            if (onUpdateCover && coverSearchBook) {
              onUpdateCover(coverSearchBook.id, coverUrl);
            }
            setCoverSearchBook(null);
          }}
        />
      )}

      {isTitleFixModalOpen && onUpdateBook && (
        <QuickTitleFixModal
          isOpen={isTitleFixModalOpen}
          onClose={() => {
            setIsTitleFixModalOpen(false);
            setSelectedFixBookId(null);
          }}
          books={books}
          onUpdateBook={onUpdateBook}
          initialBookId={selectedFixBookId}
        />
      )}
    </div>
  );
};

