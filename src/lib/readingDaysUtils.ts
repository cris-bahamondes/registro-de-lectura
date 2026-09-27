import { Book } from '../types';

/**
 * Robust date parser supporting YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY, and ISO strings.
 * Returns a Date set to midnight local time for consistent calendar comparisons.
 */
export function parseDateToMidnight(dateStr?: string | null): Date | null {
  if (!dateStr) return null;
  const clean = dateStr.trim();
  if (!clean) return null;

  // Format YYYY-MM-DD (or ISO starting with YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}/.test(clean)) {
    const parts = clean.split('T')[0].split('-').map(Number);
    if (parts.length >= 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      return new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
    }
  }

  // Format DD-MM-YYYY or DD/MM/YYYY
  if (/^\d{1,2}[-/]\d{1,2}[-/]\d{4}/.test(clean)) {
    const parts = clean.split(/[-/]/).map(Number);
    if (parts.length >= 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      return new Date(parts[2], parts[1] - 1, parts[0], 0, 0, 0, 0);
    }
  }

  const d = new Date(clean);
  if (isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

/**
 * Calculates the exact active reading days for a book matching the Reading Calendar logic.
 *
 * - For a book currently in progress ('leyendo'):
 *   Counts all calendar days from startDate through today (inclusive),
 *   which mirrors the exact number of days the book occupies on the Reading Calendar.
 *
 * - For a finished book ('leido') or any book with both startDate and endDate:
 *   Counts all calendar days from startDate through endDate (inclusive).
 *
 * - For a book with only startDate or only endDate:
 *   Counts 1 day (matching the single day mark on the calendar).
 *
 * - Returns 0 for 'pendiente' books.
 */
export function calculateBookActiveReadingDays(book?: Book | null): number {
  if (!book || book.status === 'pendiente') {
    return 0;
  }

  const startObj = parseDateToMidnight(book.startDate);
  const endObj = parseDateToMidnight(book.endDate);

  const now = new Date();
  const todayObj = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

  // 1. Book currently in progress ('leyendo')
  if (book.status === 'leyendo') {
    if (startObj) {
      const startTs = startObj.getTime();
      const todayTs = todayObj.getTime();
      if (todayTs >= startTs) {
        const diffDays = Math.round((todayTs - startTs) / (1000 * 60 * 60 * 24));
        return Math.max(1, diffDays + 1);
      }
      return 1;
    }
    if (typeof book.readingDays === 'number' && book.readingDays > 0) {
      return book.readingDays;
    }
    return 1;
  }

  // 2. Both startDate and endDate are present
  if (startObj && endObj) {
    const startTs = startObj.getTime();
    const endTs = endObj.getTime();
    if (endTs >= startTs) {
      const diffDays = Math.round((endTs - startTs) / (1000 * 60 * 60 * 24));
      return Math.max(1, diffDays + 1);
    }
    return 1;
  }

  // 3. Only endDate is present
  if (endObj) {
    return 1;
  }

  // 4. Only startDate is present and book is finished ('leido')
  if (startObj && book.status === 'leido') {
    return 1;
  }

  // 5. If only startDate is present on paused/abandoned book
  if (startObj) {
    if (typeof book.readingDays === 'number' && book.readingDays > 0) {
      return book.readingDays;
    }
    return 1;
  }

  // 6. Explicit stored readingDays fallback
  if (typeof book.readingDays === 'number' && book.readingDays > 0) {
    return book.readingDays;
  }

  return book.status === 'leido' ? 1 : 0;
}

/**
 * Returns formatted string for reading days, e.g. "1 día" or "14 días".
 */
export function formatReadingDays(days: number): string {
  if (days <= 0) return '0 días';
  return days === 1 ? '1 día' : `${days} días`;
}
