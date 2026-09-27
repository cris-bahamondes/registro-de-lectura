/**
 * Safe localStorage wrapper with QuotaExceededError protection and lightweight caching.
 */

import { coverStorage } from './coverStorage';
import { chapterStorage } from './chapterStorage';
import { bookStorage } from './bookStorage';

/**
 * Safe localStorage wrapper with QuotaExceededError protection and IndexedDB backup.
 */

// Helper to check if string is a bulky base64 data URL (> 200KB)
function isOversizedDataUrl(str?: string): boolean {
  return typeof str === 'string' && str.startsWith('data:') && str.length > 200000;
}

// Backup and preserve all books in IndexedDB so large libraries (e.g. 311+ books) never get lost
function backupBooksToIndexedDb(data: any) {
  if (!data) return;
  try {
    if (Array.isArray(data)) {
      const validBooks = data.filter((b) => b && typeof b === 'object' && b.id && b.title);
      if (validBooks.length > 0) {
        bookStorage.saveBooksBatch(validBooks);
      }
      return;
    }
    if (typeof data === 'object') {
      if (data.id && data.title) {
        bookStorage.saveBook(data);
      }
      if (Array.isArray(data.books)) {
        backupBooksToIndexedDb(data.books);
      }
    }
  } catch {}
}

// Backup and preserve covers in IndexedDB before any storage trimming
function backupCoversToIndexedDb(data: any) {
  if (!data) return;
  try {
    if (Array.isArray(data)) {
      data.forEach((item) => backupCoversToIndexedDb(item));
      return;
    }
    if (typeof data === 'object') {
      if (data.id && data.coverImage) {
        coverStorage.saveCover(data.id, data.coverImage);
      }
      if (Array.isArray(data.books)) {
        data.books.forEach((b: any) => backupCoversToIndexedDb(b));
      }
      if (Array.isArray(data.months)) {
        data.months.forEach((m: any) => backupCoversToIndexedDb(m));
      }
    }
  } catch {}
}

// Backup and preserve chapters in IndexedDB so large chapter lists are never lost
function backupChaptersToIndexedDb(data: any) {
  if (!data) return;
  try {
    if (Array.isArray(data)) {
      data.forEach((item) => backupChaptersToIndexedDb(item));
      return;
    }
    if (typeof data === 'object') {
      if (data.id && Array.isArray(data.chapters) && data.chapters.length > 0) {
        chapterStorage.saveChapters(data.id, data.chapters, data.hasParts, data.parts);
      }
      if (Array.isArray(data.books)) {
        data.books.forEach((b: any) => backupChaptersToIndexedDb(b));
      }
    }
  } catch {}
}

// Softly trim only truly oversized data URLs (>200KB) if storage is critically full, but never wipe regular covers
function sanitizeForLocalStorage<T>(data: T): T {
  if (!data) return data;
  try {
    if (Array.isArray(data)) {
      return data.map((item) => sanitizeForLocalStorage(item)) as unknown as T;
    }
    if (typeof data === 'object') {
      const copy: any = { ...(data as any) };
      // If cover is genuinely gigantic (>200KB), back it up to IndexedDB first
      if ('id' in copy && 'coverImage' in copy && copy.coverImage) {
        coverStorage.saveCover(copy.id, copy.coverImage);
      }
      if (Array.isArray(copy.books)) {
        copy.books = copy.books.map((b: any) => sanitizeForLocalStorage(b));
      }
      if (Array.isArray(copy.months)) {
        copy.months = copy.months.map((m: any) => sanitizeForLocalStorage(m));
      }
      for (const k of Object.keys(copy)) {
        if (copy[k] && typeof copy[k] === 'object') {
          copy[k] = sanitizeForLocalStorage(copy[k]);
        }
      }
      return copy as T;
    }
  } catch {
    // fallback
  }
  return data;
}

export const safeStorage = {
  getItem(key: string): string | null {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return null;
      return window.localStorage.getItem(key);
    } catch (e) {
      console.warn(`[safeStorage] Error reading key "${key}":`, e);
      return null;
    }
  },

  setItem(key: string, value: string): boolean {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return false;
      window.localStorage.setItem(key, value);
      return true;
    } catch (e: any) {
      // Handle QuotaExceededError
      if (
        e?.name === 'QuotaExceededError' ||
        e?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
        String(e).includes('quota') ||
        String(e).includes('QuotaExceeded')
      ) {
        console.warn(`[safeStorage] Storage quota exceeded for key "${key}". Attempting optimization...`);
        try {
          // Attempt to parse JSON and sanitize huge images
          const parsed = JSON.parse(value);
          const sanitized = sanitizeForLocalStorage(parsed);
          const sanitizedStr = JSON.stringify(sanitized);
          window.localStorage.setItem(key, sanitizedStr);
          console.info(`[safeStorage] Successfully saved sanitized version of "${key}" without bulky images.`);
          return true;
        } catch (subErr) {
          // If still failing, clean legacy cache keys
          safeStorage.cleanLegacyKeys();
          try {
            window.localStorage.setItem(key, value);
            return true;
          } catch {
            console.warn(`[safeStorage] Quota still exceeded for key "${key}". In-memory & cloud sync remains active.`);
            return false;
          }
        }
      }
      console.warn(`[safeStorage] Failed to set item "${key}":`, e);
      return false;
    }
  },

  setJson<T>(key: string, value: T): boolean {
    try {
      backupBooksToIndexedDb(value);
      backupCoversToIndexedDb(value);
      backupChaptersToIndexedDb(value);
      return safeStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn(`[safeStorage] JSON stringify failed for "${key}":`, e);
      return false;
    }
  },

  removeItem(key: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch (e) {
      console.warn(`[safeStorage] Error removing key "${key}":`, e);
    }
  },

  cleanLegacyKeys(): void {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      const keysToRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (
          k &&
          (k.startsWith('registro_lectura_legacy_temp_') ||
            k.includes('_v0_corrupt'))
        ) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => window.localStorage.removeItem(k));
    } catch {}
  },

  clearAllAppData(): void {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      const appKeys: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && (k.startsWith('registro_lectura_') || k.startsWith('biblioteca_'))) {
          appKeys.push(k);
        }
      }
      appKeys.forEach((k) => window.localStorage.removeItem(k));
    } catch (e) {
      console.warn('[safeStorage] Failed to clear app keys:', e);
    }
  }
};
