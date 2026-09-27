export type BookStatus = 'leyendo' | 'leido' | 'pendiente' | 'pausado' | 'abandonado';
export type BookFormat = 'fisico' | 'digital';

export interface Chapter {
  id: string;
  title: string;
  chapterNumber?: string;
  chapterName?: string;
  startPage: number;
  endPage: number;
  isRead: boolean;
  part?: string;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  coverImage?: string; // base64 or url or preset color
  coverColor?: string; // fallback color for pastel book spine
  totalPages: number;
  currentPage: number;
  format: BookFormat;
  category: string;
  genres?: string[];
  description?: string; // Breve descripción o sinopsis del libro (máx 500 caracteres)
  saga?: string;
  sagaOrder?: number;
  rating: number; // 0 to 5 in 0.5 steps
  status: BookStatus;
  startDate?: string;
  endDate?: string;
  readYear?: number;
  readingDays?: number;
  hasParts?: boolean;
  parts?: string[];
  chapters: Chapter[];
  createdAt: string;
  updatedAt: string;
}

export type WishlistIntent = 'comprar' | 'leer' | 'ambos';
export type WishlistPriority = 'alta' | 'media' | 'baja';

export interface WishlistItem {
  id: string;
  title: string;
  author: string;
  coverImage?: string;
  coverColor?: string;
  category: string;
  intent: WishlistIntent;
  priority: WishlistPriority;
  estimatedPrice?: number;
  offerPrice?: number;
  currency?: string;
  storeName?: string;
  storeUrl?: string;
  notes?: string;
  totalPages?: number;
  format?: BookFormat;
  createdAt: string;
  updatedAt: string;
}

export interface MonthChallengeBook {
  id: string;
  bookId?: string; // linked library book ID if any
  title: string;
  author: string;
  coverImage?: string;
  totalPages?: number;
  isRead: boolean;
}

export interface AnnualMonthChallenge {
  monthNumber: number; // 1 to 12
  monthName: string; // "Enero", "Febrero", ...
  category: string; // e.g. "Libros del siglo XX", "Clásicos Universales"
  notes?: string;
  books: MonthChallengeBook[];
}

export interface AnnualChallenge {
  id: string; // e.g. "annual-2026"
  year: number; // 2026
  title: string;
  months: AnnualMonthChallenge[];
  createdAt: string;
  updatedAt: string;
}

export interface CategoryGoal {
  category: string;
  targetBooks: number;
}

export interface MonthlyChallenge {
  id: string; // e.g. "2026-08"
  month: string; // "YYYY-MM"
  targetBooksCount: number;
  targetPagesCount?: number;
  categoryGoals: CategoryGoal[];
  selectedBookIds: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  name: string;
  email: string;
  avatar: string;
  isGuest: boolean;
  annualTargetGoal?: number;
  readingGoal?: number;
}

export type TabType = 'leyendo' | 'biblioteca' | 'deseos' | 'desafio' | 'estadisticas';
