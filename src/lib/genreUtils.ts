import { Book } from '../types';

/**
 * Returns an array of genres for a book, supporting both the new
 * `genres?: string[]` array and legacy `category: string` (single or comma-separated).
 */
export const getBookGenres = (
  book?: { genres?: string[]; category?: string } | null
): string[] => {
  if (!book) return [];

  if (Array.isArray(book.genres) && book.genres.length > 0) {
    const cleaned = book.genres
      .map((g) => (typeof g === 'string' ? g.trim() : ''))
      .filter(Boolean);
    if (cleaned.length > 0) {
      return Array.from(new Set(cleaned));
    }
  }

  if (book.category && typeof book.category === 'string') {
    const split = book.category
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (split.length > 0) {
      return Array.from(new Set(split));
    }
  }

  return [];
};

/**
 * Formats genres into a clean readable string (e.g. "Fantasía, Aventura")
 */
export const formatBookGenres = (
  book?: { genres?: string[]; category?: string } | null,
  fallback = 'General'
): string => {
  const genres = getBookGenres(book);
  return genres.length > 0 ? genres.join(', ') : fallback;
};

/**
 * Returns the primary (first) category of a book.
 * If a book has two or more categories, the first one is the one that rules ("la que manda / la que vale").
 */
export const getBookPrimaryCategory = (
  book?: { genres?: string[]; category?: string } | null,
  fallback = 'General'
): string => {
  const genres = getBookGenres(book);
  if (genres.length > 0 && genres[0]) {
    return genres[0];
  }
  return fallback;
};

const SAVED_GENRES_KEY = 'registro_lectura_saved_genres_v1';

/**
 * Retrieves custom genres previously added by user and saved in localStorage
 */
export const getStoredCustomGenres = (): string[] => {
  try {
    const raw = localStorage.getItem(SAVED_GENRES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .map((g) => (typeof g === 'string' ? g.trim() : ''))
        .filter(Boolean);
    }
  } catch (e) {
    console.error('Error reading custom genres from localStorage', e);
  }
  return [];
};

/**
 * Saves a new genre to localStorage so it stays in the list of available genres
 */
export const saveCustomGenre = (genre: string): string[] => {
  const clean = genre.trim();
  if (!clean) return getStoredCustomGenres();

  const current = getStoredCustomGenres();
  const exists = current.some((g) => g.toLowerCase() === clean.toLowerCase());
  if (!exists) {
    const updated = [...current, clean];
    try {
      localStorage.setItem(SAVED_GENRES_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Error saving custom genre to localStorage', e);
    }
    return updated;
  }
  return current;
};
