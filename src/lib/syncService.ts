import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  deleteField,
  onSnapshot,
  getDoc,
  getDocs,
  getDocsFromServer,
  writeBatch,
  disableNetwork,
  enableNetwork,
  Unsubscribe,
} from 'firebase/firestore';
import { db, defaultDb, auth } from './firebase';
import { Book, BookStatus, WishlistItem, UserProfile, MonthlyChallenge, AnnualChallenge, AnnualMonthChallenge, MonthChallengeBook } from '../types';
import { safeStorage } from './safeStorage';
import { coverStorage } from './coverStorage';
import { chapterStorage } from './chapterStorage';
import { bookStorage } from './bookStorage';
import { ensureHttps } from './bookCoverService';
import { createAnnualChallengeForYear } from '../data/initialData';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

// Quota & Error Management
export function isQuotaError(error: unknown): boolean {
  if (!error) return false;
  const errMsg = error instanceof Error ? error.message : String(error);
  return (
    errMsg.includes('Quota limit exceeded') ||
    errMsg.includes('quota') ||
    errMsg.includes('resource-exhausted') ||
    errMsg.includes('ResourceExhausted') ||
    errMsg.includes('Free daily read units') ||
    errMsg.includes('exceeded your current quota')
  );
}

export function isPermissionError(error: unknown): boolean {
  if (!error) return false;
  const errMsg = error instanceof Error ? error.message : String(error);
  return (
    errMsg.includes('permission-denied') ||
    errMsg.includes('Missing or insufficient permissions') ||
    errMsg.includes('PERMISSION_DENIED')
  );
}

// Clear any legacy quota lockout flags from previous sessions
try {
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem('firestore_quota_exceeded_until');
  }
} catch {}

let quotaExceededUntil = 0;

export function isFirestoreQuotaExceeded(): boolean {
  return false;
}

export function markFirestoreQuotaExceeded(_cooldownMs = 0) {
  quotaExceededUntil = 0;
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('firestore_quota_exceeded_until');
    }
  } catch {}
}

export function clearFirestoreQuotaExceeded() {
  quotaExceededUntil = 0;
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('firestore_quota_exceeded_until');
    }
  } catch {}
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMsg = error instanceof Error ? error.message : String(error);

  // 1. Quota errors -> switch immediately to safe local mode and silence repetitive logs
  if (isQuotaError(error)) {
    markFirestoreQuotaExceeded();
    return;
  }

  // 2. If the error indicates transient network or offline state, handle gracefully
  if (
    errMsg.includes('unavailable') ||
    errMsg.includes('offline') ||
    errMsg.includes('Could not reach Cloud Firestore') ||
    errMsg.includes('network') ||
    errMsg.includes('Connection failed')
  ) {
    return;
  }

  // 3. ONLY log "Firestore Error: {...}" for permission denial / security rule errors as required by the Firebase test framework
  if (isPermissionError(error)) {
    const errInfo: FirestoreErrorInfo = {
      error: errMsg,
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        emailVerified: auth.currentUser?.emailVerified,
        isAnonymous: auth.currentUser?.isAnonymous,
        tenantId: auth.currentUser?.tenantId,
        providerInfo:
          auth.currentUser?.providerData?.map((provider) => ({
            providerId: provider.providerId,
            email: provider.email,
          })) || [],
      },
      operationType,
      path,
    };
    console.error('Firestore Error:', JSON.stringify(errInfo));
    return;
  }

  // 4. Any other non-critical error
  console.warn(`[Firestore Sync] Operation ${operationType} on ${path} notice:`, errMsg);
}

// Utility to remove undefined keys so Firestore doesn't throw errors
function sanitizeForFirestore<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}

/**
 * Tombstone key definitions for permanently deleted books
 */
const TOMBSTONE_STORAGE_KEY = 'registro_lectura_deleted_book_ids_v2';
const TOMBSTONE_FINGERPRINTS_KEY = 'registro_lectura_deleted_fingerprints_v2';

export function getLocalDeletedBookIds(): Set<string> {
  try {
    const raw = safeStorage.getItem(TOMBSTONE_STORAGE_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr);
    }
  } catch {}
  return new Set();
}

export function recordLocalDeletedBook(id: string, title?: string, author?: string) {
  if (!id) return;
  try {
    const set = getLocalDeletedBookIds();
    set.add(id);
    safeStorage.setJson(TOMBSTONE_STORAGE_KEY, Array.from(set));

    if (title) {
      const key = normalizeBookKey(title, author);
      if (key) {
        const rawFp = safeStorage.getItem(TOMBSTONE_FINGERPRINTS_KEY);
        const fpMap: Record<string, number> = rawFp ? JSON.parse(rawFp) : {};
        fpMap[key] = Date.now();
        safeStorage.setJson(TOMBSTONE_FINGERPRINTS_KEY, fpMap);
      }
    }
  } catch {}
}

export function clearLocalDeletedBook(id: string, title?: string, author?: string) {
  if (!id) return;
  try {
    const set = getLocalDeletedBookIds();
    if (set.has(id)) {
      set.delete(id);
      safeStorage.setJson(TOMBSTONE_STORAGE_KEY, Array.from(set));
    }
    if (title) {
      const key = normalizeBookKey(title, author);
      if (key) {
        const rawFp = safeStorage.getItem(TOMBSTONE_FINGERPRINTS_KEY);
        if (rawFp) {
          const fpMap: Record<string, number> = JSON.parse(rawFp);
          delete fpMap[key];
          safeStorage.setJson(TOMBSTONE_FINGERPRINTS_KEY, fpMap);
        }
      }
    }
  } catch {}
}

export function isBookLocallyDeleted(id: string, title?: string, author?: string): boolean {
  if (!id) return false;
  const set = getLocalDeletedBookIds();
  if (set.has(id)) return true;
  if (title) {
    const key = normalizeBookKey(title, author);
    if (key) {
      try {
        const rawFp = safeStorage.getItem(TOMBSTONE_FINGERPRINTS_KEY);
        if (rawFp) {
          const fpMap: Record<string, number> = JSON.parse(rawFp);
          // If deleted within last 60 days
          if (fpMap[key] && (Date.now() - fpMap[key]) < 60 * 24 * 60 * 60 * 1000) {
            return true;
          }
        }
      } catch {}
    }
  }
  return false;
}

/**
 * Levenshtein distance calculation for fuzzy title & author matching
 */
export function levenshteinDistance(s1: string, s2: string): number {
  if (s1 === s2) return 0;
  if (!s1.length) return s2.length;
  if (!s2.length) return s1.length;

  const d: number[][] = [];
  for (let i = 0; i <= s1.length; i++) {
    d[i] = [i];
  }
  for (let j = 0; j <= s2.length; j++) {
    d[0][j] = j;
  }
  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + cost
      );
    }
  }
  return d[s1.length][s2.length];
}

/**
 * Normalizes title string for duplicate comparison
 */
export function normalizeCleanText(text?: string): string {
  if (!text) return '';
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[«»""''`’´…\.\,\:\;\-\_\(\)\[\]\{\}\/\\\|\?\!\¿\¡\*\+\=\#\$\%\^\&\~]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeTitleFingerprint(title?: string): string {
  if (!title) return '';
  let clean = normalizeCleanText(title);
  // Remove common leading articles if any
  clean = clean.replace(/^(el|la|los|las|un|una|unos|unas|the|a|an)\s+/i, '');
  return clean.replace(/[^a-z0-9]/g, '');
}

export function normalizeAuthorFingerprint(author?: string): string {
  if (!author) return '';
  const clean = normalizeCleanText(author);
  if (/^(desconocido|anonimo|anonymous|autor|author|sin autor|unknown)$/i.test(clean)) {
    return '';
  }
  return clean.replace(/[^a-z0-9]/g, '');
}

/**
 * Checks whether two book objects represent the same real-world book
 */
export function areBooksDuplicate(a: Book, b: Book): boolean {
  if (!a || !b) return false;
  if (a.id && b.id && a.id === b.id) return true;

  const titleA = normalizeTitleFingerprint(a.title);
  const titleB = normalizeTitleFingerprint(b.title);
  if (!titleA || !titleB) return false;

  const authA = normalizeAuthorFingerprint(a.author);
  const authB = normalizeAuthorFingerprint(b.author);

  const authorsCompatible =
    !authA ||
    !authB ||
    authA === authB ||
    authA.includes(authB) ||
    authB.includes(authA) ||
    (Math.min(authA.length, authB.length) >= 4 && levenshteinDistance(authA, authB) <= 2);

  // 1. Exact title fingerprint match
  if (titleA === titleB) {
    return authorsCompatible;
  }

  // 2. Prefix title match (e.g. truncated title with ellipsis like "Mi último año de..." vs "Mi último año de inocencia")
  if (
    (titleA.startsWith(titleB) && titleB.length >= 8) ||
    (titleB.startsWith(titleA) && titleA.length >= 8)
  ) {
    return authorsCompatible;
  }

  // 3. Near title match with identical author (e.g. typo "my husbands wifr" vs "my husbands wife")
  if (authorsCompatible && authA && authB && (authA === authB || authA.includes(authB) || authB.includes(authA))) {
    const maxLen = Math.max(titleA.length, titleB.length);
    const dist = levenshteinDistance(titleA, titleB);
    if (dist <= 2 && maxLen >= 6) {
      return true;
    }
    if (dist <= 3 && maxLen >= 14) {
      return true;
    }
  }

  return false;
}

/**
 * Normalizes title and author to produce a matching fingerprint key for cross-device book deduplication
 */
export function normalizeBookKey(title?: string, author?: string): string {
  const t = normalizeTitleFingerprint(title);
  const a = normalizeAuthorFingerprint(author);
  return t ? `${t}___${a}` : '';
}

/**
 * Deduplicate books by combining entries with identical or near-identical titles and compatible authors.
 * Merges the best fields (reading progress, chapters, covers, rating, status) into a single canonical book.
 */
export function deduplicateBooks(rawList: Book[]): {
  deduplicated: Book[];
  removedIds: string[];
} {
  if (!Array.isArray(rawList)) return { deduplicated: [], removedIds: [] };

  const cleanList = filterRealBooksOnly(rawList);
  const clusters: Book[][] = [];
  const removedIds: string[] = [];

  for (const book of cleanList) {
    if (!book || !book.id || isBookLocallyDeleted(book.id, book.title, book.author)) continue;

    let placed = false;
    for (const cluster of clusters) {
      if (cluster.some((existing) => areBooksDuplicate(existing, book))) {
        cluster.push(book);
        placed = true;
        break;
      }
    }

    if (!placed) {
      clusters.push([book]);
    }
  }

  const deduplicated: Book[] = [];

  for (const cluster of clusters) {
    if (cluster.length === 1) {
      const single = cluster[0];
      if (single.status !== 'leido' && single.rating !== 0) {
        deduplicated.push({ ...single, rating: 0 });
      } else {
        deduplicated.push(single);
      }
      continue;
    }

    // Sort group: prefer status 'leido' > 'leyendo' > others, prefer non-empty cover, chapters, etc.
    cluster.sort((a, b) => {
      const score = (bk: Book) => {
        let s = 0;
        if (bk.status === 'leido') s += 1000;
        else if (bk.status === 'leyendo') s += 500;
        else if (bk.status === 'pausado') s += 200;
        if (bk.coverImage) s += 150;
        if (Array.isArray(bk.chapters) && bk.chapters.length > 0) s += 100 + bk.chapters.length;
        if (bk.rating && bk.rating > 0) s += 50;
        if (bk.startDate || bk.endDate) s += 50;
        if (bk.totalPages && bk.totalPages > 0) s += 30;
        if (bk.currentPage && bk.currentPage > 0) s += 20;
        const time = new Date(bk.updatedAt || bk.createdAt || 0).getTime();
        return s + (time > 0 ? 10 : 0);
      };
      return score(b) - score(a);
    });

    const canonical = cluster[0];
    const duplicates = cluster.slice(1);

    let bestTitle = canonical.title;
    let bestAuthor = canonical.author;
    let bestTotalPages = canonical.totalPages || 0;
    let bestCurrentPage = canonical.currentPage || 0;
    let bestCover = canonical.coverImage;
    let bestChapters = Array.isArray(canonical.chapters) ? canonical.chapters : [];
    let bestParts = Array.isArray(canonical.parts) ? canonical.parts : [];
    let bestHasParts = canonical.hasParts ?? false;
    let bestRating = canonical.rating || 0;
    let bestStartDate = canonical.startDate;
    let bestEndDate = canonical.endDate;
    let bestReadYear = canonical.readYear;
    let bestReadingDays = canonical.readingDays || 0;
    let bestSaga = canonical.saga;
    let bestSagaOrder = canonical.sagaOrder;
    let bestDescription = canonical.description;
    let bestStatus = canonical.status;
    let bestFormat = canonical.format;
    let bestCategory = canonical.category;

    duplicates.forEach((dup) => {
      removedIds.push(dup.id);
      recordLocalDeletedBook(dup.id, dup.title, dup.author);

      // Take higher quality title if canonical has placeholder or typo
      if (
        !isCorruptedOrPlaceholderTitle(dup.title) &&
        (isCorruptedOrPlaceholderTitle(bestTitle) || dup.title.length > bestTitle.length)
      ) {
        bestTitle = dup.title;
      }
      if (!bestAuthor && dup.author) bestAuthor = dup.author;
      if (dup.author && bestAuthor && dup.author.length > bestAuthor.length) bestAuthor = dup.author;
      if ((dup.totalPages || 0) > bestTotalPages) bestTotalPages = dup.totalPages;
      if ((dup.currentPage || 0) > bestCurrentPage) bestCurrentPage = dup.currentPage;
      if (!bestCover && dup.coverImage) bestCover = dup.coverImage;
      if (!bestFormat && dup.format) bestFormat = dup.format;
      if ((!bestCategory || bestCategory === 'General') && dup.category && dup.category !== 'General') {
        bestCategory = dup.category;
      }
      if (Array.isArray(dup.chapters) && dup.chapters.length > bestChapters.length) {
        bestChapters = dup.chapters;
      }
      if (Array.isArray(dup.parts) && dup.parts.length > bestParts.length) {
        bestParts = dup.parts;
        bestHasParts = dup.hasParts ?? bestHasParts;
      }
      if (!bestRating && dup.rating) bestRating = dup.rating;
      if (!bestStartDate && dup.startDate) bestStartDate = dup.startDate;
      if (!bestEndDate && dup.endDate) bestEndDate = dup.endDate;
      if (!bestReadYear && dup.readYear) bestReadYear = dup.readYear;
      if (!bestReadingDays && dup.readingDays) bestReadingDays = dup.readingDays;
      if (!bestSaga && dup.saga) {
        bestSaga = dup.saga;
        bestSagaOrder = dup.sagaOrder;
      }
      if (!bestDescription && dup.description) bestDescription = dup.description;
      if (dup.status === 'leido' && bestStatus !== 'leido') bestStatus = 'leido';
      else if (dup.status === 'leyendo' && bestStatus === 'pendiente') bestStatus = 'leyendo';
    });

    const mergedCanonical: Book = {
      ...canonical,
      title: bestTitle,
      author: bestAuthor,
      totalPages: bestTotalPages,
      currentPage: bestStatus === 'leido' && bestTotalPages > 0 ? bestTotalPages : bestCurrentPage,
      coverImage: bestCover,
      format: bestFormat,
      category: bestCategory,
      chapters: bestChapters,
      parts: bestParts,
      hasParts: bestHasParts,
      rating: bestStatus === 'leido' ? (bestRating || 0) : 0,
      startDate: bestStartDate,
      endDate: bestEndDate,
      readYear: bestReadYear,
      readingDays: bestReadingDays,
      saga: bestSaga,
      sagaOrder: bestSagaOrder,
      description: bestDescription,
      status: bestStatus,
      updatedAt: new Date().toISOString(),
    };

    deduplicated.push(mergedCanonical);
  }

  return { deduplicated, removedIds };
}

/**
 * Detect if an object is a reading challenge item (e.g. Desafío de Lectura 2026/2027)
 * which must never appear in the library books collection.
 */
export function isChallengeItem(b: any): boolean {
  if (!b || typeof b !== 'object') return false;
  const idStr = String(b.id || '').trim().toLowerCase();
  const titleStr = String(b.title || b.titulo || b.name || '').trim().toLowerCase();

  if (
    idStr.startsWith('annual-challenge') ||
    idStr.startsWith('challenge-') ||
    idStr.includes('desafio-lectura') ||
    idStr.includes('desafio_lectura') ||
    idStr.includes('annual_challenge') ||
    idStr.includes('annualchallenge') ||
    /^desaf[ií]o\s*(de\s*lectura)?(\s*\d{4})?$/i.test(titleStr) ||
    titleStr.includes('desafío de lectura') ||
    titleStr.includes('desafio de lectura') ||
    /^desaf[ií]o\s+\d{4}$/i.test(titleStr)
  ) {
    return true;
  }
  // Check if object has challenge attributes (months, targetBooks) with no totalPages
  if ((b.months !== undefined || b.targetBooks !== undefined || b.year !== undefined) && (!b.totalPages || b.totalPages === 0)) {
    return true;
  }
  return false;
}

/**
 * Detect if a book title is corrupt, pure numeric timestamp, a reading challenge item, or an auto-generated placeholder
 * like "Libro recuperado book-178", "Libro book-...", "Sin título", "Desafío de Lectura 2026", etc.
 */
export function isCorruptedOrPlaceholderTitle(title?: string): boolean {
  if (!title) return true;
  const trimmed = String(title).trim();
  if (!trimmed) return true;
  const lower = trimmed.toLowerCase();
  if (lower === 'sin título' || lower === 'sin titulo' || lower === 'untitled') return true;
  if (/^\d{10,}$/.test(trimmed)) return true; // e.g. "1788143571951"
  if (/^libro\s*recuperado/i.test(trimmed)) return true; // e.g. "Libro recuperado book-178"
  if (/^libro\s*book[-_]/i.test(trimmed)) return true; // e.g. "Libro book-178..."
  if (/^book[-_]\d+/i.test(trimmed)) return true; // e.g. "book-1788..."
  if (/^dummy/i.test(trimmed)) return true;
  if (/^desaf[ií]o\s*(de\s*lectura)?(\s*\d{4})?$/i.test(trimmed)) return true;
  if (lower.includes('desafío de lectura') || lower.includes('desafio de lectura')) return true;
  return false;
}

/**
 * Identify any item that represents a chapter extracted as a standalone book or challenge item
 */
export function isChapterDerivedBook(b: any, allBooksContext?: Book[]): boolean {
  if (!b || typeof b !== 'object') return false;
  if (isChallengeItem(b)) return true;
  const idStr = String(b.id || '').trim();
  const titleStr = String(b.title || b.titulo || b.name || '').trim();
  if (isCorruptedOrPlaceholderTitle(titleStr)) return true;
  
  // 1. Explicit chapter markers
  if (idStr.includes('__chap_') || idStr.startsWith('chap_') || idStr.startsWith('chap-') || idStr.includes('_chap')) return true;
  if (b.parentBookId || b.isChapterBook || b.chapterId || b.chapterTitle) return true;
  if (b.chapterNumber !== undefined || b.chapterName !== undefined) return true;
  if (b.startPage !== undefined && b.endPage !== undefined && (!b.totalPages || b.totalPages === 0)) {
    return true;
  }

  if (!titleStr) return false;

  // 2. Check if title matches any chapter inside any other book in context
  if (Array.isArray(allBooksContext) && allBooksContext.length > 0) {
    for (const other of allBooksContext) {
      if (other && other.id !== b.id && Array.isArray(other.chapters) && other.chapters.length > 0) {
        const hasMatchingChap = other.chapters.some((c) => {
          if (!c || !c.title) return false;
          const cTitle = c.title.trim().toLowerCase();
          const tLower = titleStr.toLowerCase();
          return cTitle === tLower || (c.id && (c.id === b.id || b.id.includes(c.id)));
        });
        if (hasMatchingChap) {
          return true;
        }
      }
    }
  }

  // 3. Standalone chapter title patterns (Roman numerals, Chapter prefixes, Prefacio, etc.)
  const isZeroOrNoPages = !b.totalPages || b.totalPages === 0 || Number(b.totalPages) <= 5;
  
  // Pure Roman numerals: "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", etc.
  const isPureRoman = /^[IVXLCDMivxlcdm]+$/i.test(titleStr);
  if (isPureRoman && isZeroOrNoPages) return true;

  // Roman numeral with separator: "XI - ...", "I: ...", "IV. ..."
  const isRomanPrefix = /^[IVXLCDMivxlcdm]+\s*[-–—:.]\s*.+$/i.test(titleStr);
  if (isRomanPrefix && isZeroOrNoPages) return true;

  // Number with separator or standalone number: "1.", "1 - ...", "12"
  const isNumberPrefix = /^(?:\d{1,3})\s*[-–—:.]\s*.+$/i.test(titleStr);
  if (isNumberPrefix && isZeroOrNoPages) return true;

  // Pure chapter keywords
  const isChapterKeyword = /^(?:prefacio|prólogo|prologo|epílogo|epilogo|introducción|introduccion|capítulo|capitulo|cap\.|chapter|acto\s*\d+|canto\s*\d+|sección\s*\d+|seccion\s*\d+|apéndice|apendice)\b/i.test(titleStr);
  if (isChapterKeyword && isZeroOrNoPages) return true;

  // Exact match for known generic chapter titles
  const genericChapterTitles = new Set([
    'prefacio', 'prólogo', 'prologo', 'epílogo', 'epilogo', 'introducción', 'introduccion',
    'conclusión', 'conclusion', 'apéndice', 'apendice', 'postfacio', 'nota del autor',
    'nota previa', 'advertencia', 'intermedio', 'ex libris', 'dedicatoria'
  ]);
  if (genericChapterTitles.has(titleStr.toLowerCase()) && isZeroOrNoPages) return true;

  return false;
}

/**
 * Filter an array of books to return ONLY genuine books, discarding any chapter-derived entries
 */
export function filterRealBooksOnly(rawBooks: Book[]): Book[] {
  if (!Array.isArray(rawBooks)) return [];
  // Extract all chapter titles from parent books
  const allChapterTitles = new Set<string>();
  rawBooks.forEach((b) => {
    if (b && Array.isArray(b.chapters)) {
      b.chapters.forEach((c) => {
        if (c && c.title) allChapterTitles.add(c.title.trim().toLowerCase());
      });
    }
  });

  return rawBooks.filter((b) => {
    if (!b || !b.id) return false;
    if (isChapterDerivedBook(b, rawBooks)) return false;
    const titleLower = (b.title || '').trim().toLowerCase();
    if (allChapterTitles.has(titleLower) && (!b.totalPages || b.totalPages === 0)) {
      return false;
    }
    return true;
  });
}

/**
 * Permanently purge any chapter books that were previously generated as independent entries
 */
export async function purgeChapterStandaloneBooks(userId?: string): Promise<number> {
  let count = 0;
  try {
    // 1. IndexedDB clean
    const allLocal = await bookStorage.getAllBooks();
    const chapterBooks = allLocal.filter((b) => isChapterDerivedBook(b, allLocal));
    for (const cb of chapterBooks) {
      await bookStorage.deleteBook(cb.id);
      count++;
    }

    // 2. Local storage clean
    const cleanStorageKey = (key: string) => {
      try {
        const raw = safeStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const filtered = filterRealBooksOnly(parsed);
            if (filtered.length !== parsed.length) {
              safeStorage.setJson(key, filtered);
              count += (parsed.length - filtered.length);
            }
          }
        }
      } catch {}
    };

    cleanStorageKey('registro_lectura_guest_books_v1');
    cleanStorageKey('registro_lectura_books_v1');
    cleanStorageKey('registro_lectura_books');
    cleanStorageKey('registro_lectura_all_books_backup');
    if (userId) {
      cleanStorageKey(`registro_lectura_account_books_${userId}`);
    }

    // 3. Firestore clean
    if (userId) {
      const deleteChapterDocs = async (dbInstance: any) => {
        if (!dbInstance) return;
        try {
          const booksRef = collection(dbInstance, 'users', userId, 'books');
          const snapshot = await getDocs(booksRef);
          const allDocsData: any[] = [];
          snapshot.forEach((d) => {
            allDocsData.push({ id: d.id, ...d.data() });
          });

          const toDelete: string[] = [];
          allDocsData.forEach((d) => {
            if (isChapterDerivedBook(d, allDocsData)) {
              toDelete.push(d.id);
            }
          });

          if (toDelete.length > 0) {
            console.info(`[Sync] Purging ${toDelete.length} chapter standalone books from Firestore for user ${userId}`);
            for (let i = 0; i < toDelete.length; i += 400) {
              const chunk = toDelete.slice(i, i + 400);
              const batch = writeBatch(dbInstance);
              chunk.forEach((docId) => {
                batch.delete(doc(dbInstance, 'users', userId, 'books', docId));
                count++;
              });
              await batch.commit();
            }
          }
        } catch (e) {
          console.warn('[Sync] Firestore purge note:', e);
        }
      };

      await deleteChapterDocs(db);
      if (defaultDb && defaultDb !== db) {
        await deleteChapterDocs(defaultDb);
      }
    }
  } catch (e) {
    console.warn('[Sync] purgeChapterStandaloneBooks error:', e);
  }
  return count;
}

/**
 * Real-time listener for user's books collection
 */
export function subscribeToUserBooks(
  userId: string,
  onUpdate: (books: Book[]) => void
): Unsubscribe {
  const booksRef = collection(db, 'users', userId, 'books');
  return onSnapshot(
    booksRef,
    async (snapshot) => {
      const rawList: any[] = [];
      snapshot.forEach((docSnap) => {
        rawList.push({ id: docSnap.id, ...docSnap.data() });
      });

      const books: Book[] = [];
      const chapterDocsToDelete: string[] = [];
      rawList.forEach((item) => {
        if (isChapterDerivedBook(item, rawList)) {
          chapterDocsToDelete.push(item.id);
          return;
        }
        if (isBookLocallyDeleted(item.id, item.title, item.author)) {
          // If deleted locally, ensure cloud doc is also purged
          deleteDoc(doc(db, 'users', userId, 'books', item.id)).catch(() => {});
          return;
        }
        books.push(item as Book);
      });

      if (chapterDocsToDelete.length > 0) {
        setTimeout(() => {
          chapterDocsToDelete.forEach((docId) => {
            deleteDoc(doc(db, 'users', userId, 'books', docId)).catch(() => {});
            if (defaultDb && defaultDb !== db) {
              deleteDoc(doc(defaultDb, 'users', userId, 'books', docId)).catch(() => {});
            }
            bookStorage.deleteBook(docId).catch(() => {});
          });
        }, 50);
      }

      // Deduplicate books to ensure no duplicates ever reach the UI
      const { deduplicated, removedIds } = deduplicateBooks(books);

      if (removedIds.length > 0) {
        setTimeout(() => {
          removedIds.forEach((dupId) => {
            deleteDoc(doc(db, 'users', userId, 'books', dupId)).catch(() => {});
            if (defaultDb && defaultDb !== db) {
              deleteDoc(doc(defaultDb, 'users', userId, 'books', dupId)).catch(() => {});
            }
            bookStorage.deleteBook(dupId).catch(() => {});
          });
        }, 50);
      }

      // Sort by updatedAt or creation date
      deduplicated.sort((a, b) => {
        const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return dateB - dateA;
      });

      // Enrich any book missing coverImage from local IndexedDB cache
      try {
        const cachedCovers = await coverStorage.getAllCovers();
        if (cachedCovers && Object.keys(cachedCovers).length > 0) {
          deduplicated.forEach((b) => {
            if (!b.coverImage && cachedCovers[b.id]) {
              b.coverImage = cachedCovers[b.id];
            } else if (b.coverImage && typeof b.coverImage === 'string') {
              coverStorage.saveCover(b.id, b.coverImage);
            }
          });
        }
      } catch {}

      // Enrich any book missing chapters from local IndexedDB cache, and cache cloud chapters
      try {
        const cachedChapters = await chapterStorage.getAllChapters();
        if (cachedChapters && Object.keys(cachedChapters).length > 0) {
          deduplicated.forEach((b) => {
            const stored = cachedChapters[b.id];
            const cloudChaps = Array.isArray(b.chapters) ? b.chapters : [];
            if (stored && Array.isArray(stored.chapters) && stored.chapters.length > 0) {
              if (cloudChaps.length === 0 || stored.chapters.length > cloudChaps.length) {
                b.chapters = stored.chapters;
                b.hasParts = stored.hasParts ?? b.hasParts;
                b.parts = stored.parts && stored.parts.length > 0 ? stored.parts : b.parts;
              } else {
                chapterStorage.saveChapters(b.id, cloudChaps, b.hasParts, b.parts);
              }
            } else if (cloudChaps.length > 0) {
              chapterStorage.saveChapters(b.id, cloudChaps, b.hasParts, b.parts);
            }
          });
        } else {
          deduplicated.forEach((b) => {
            if (Array.isArray(b.chapters) && b.chapters.length > 0) {
              chapterStorage.saveChapters(b.id, b.chapters, b.hasParts, b.parts);
            }
          });
        }
      } catch {}

      onUpdate(deduplicated);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${userId}/books`);
      bookStorage.getAllBooks().then((localList) => {
        if (localList && localList.length > 0) {
          const { deduplicated } = deduplicateBooks(localList);
          onUpdate(deduplicated);
        } else {
          const fallback = collectAllLocalBooks(userId);
          const { deduplicated } = deduplicateBooks(fallback);
          if (deduplicated && deduplicated.length > 0) onUpdate(deduplicated);
        }
      }).catch(() => {});
    }
  );
}

/**
 * Real-time listener for user's wishlist collection
 */
export function subscribeToUserWishlist(
  userId: string,
  onUpdate: (wishlist: WishlistItem[]) => void
): Unsubscribe {
  const wishlistRef = collection(db, 'users', userId, 'wishlist');
  return onSnapshot(
    wishlistRef,
    (snapshot) => {
      const list: WishlistItem[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as WishlistItem);
      });
      list.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return dateB - dateA;
      });
      onUpdate(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${userId}/wishlist`);
    }
  );
}

/**
 * Real-time listener for user challenges
 */
export function subscribeToUserChallenges(
  userId: string,
  onUpdate: (data: {
    challenges: MonthlyChallenge[];
    annualChallenge?: AnnualChallenge;
    annualChallengesByYear?: Record<number, AnnualChallenge>;
  }) => void
): Unsubscribe {
  const challengesRef = collection(db, 'users', userId, 'challenges');
  return onSnapshot(
    challengesRef,
    (snapshot) => {
      const monthly: MonthlyChallenge[] = [];
      const annualMap: Record<number, AnnualChallenge> = {};
      let latestAnnual: AnnualChallenge | undefined;

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data && Array.isArray(data.months)) {
          const docId = docSnap.id;
          const parsedYear = data.year || (docId.includes('202') ? parseInt(docId.replace(/\D/g, ''), 10) : 2026);
          const ann: AnnualChallenge = {
            id: data.id || docId,
            year: parsedYear,
            title: data.title || `Desafío de Lectura ${parsedYear}`,
            months: data.months || [],
            createdAt: data.createdAt || `${parsedYear}-01-01T00:00:00.000Z`,
            updatedAt: data.updatedAt || new Date().toISOString(),
          };
          if (ann.year) {
            const existing = annualMap[ann.year];
            if (!existing) {
              annualMap[ann.year] = ann;
            } else {
              annualMap[ann.year] = mergeAnnualChallenges(existing, ann);
            }
          }
          latestAnnual = ann;
        } else {
          monthly.push(data as MonthlyChallenge);
        }
      });
      onUpdate({
        challenges: monthly,
        annualChallenge: latestAnnual,
        annualChallengesByYear: annualMap,
      });
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${userId}/challenges`);
    }
  );
}

/**
 * Real-time listener for user profile updates
 */
export function subscribeToUserProfile(
  userId: string,
  onUpdate: (profile: Partial<UserProfile>) => void
): Unsubscribe {
  const userRef = doc(db, 'users', userId);
  return onSnapshot(
    userRef,
    (docSnap) => {
      if (docSnap.exists()) {
        onUpdate(docSnap.data() as Partial<UserProfile>);
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${userId}`);
    }
  );
}

/**
 * Save a single book to Firestore
 */
export async function saveBookToCloud(userId: string, book: Book): Promise<void> {
  if (isFirestoreQuotaExceeded()) return;
  const path = `users/${userId}/books/${book.id}`;
  try {
    const bookRef = doc(db, 'users', userId, 'books', book.id);
    const dataToSave: Record<string, any> = sanitizeForFirestore(book);

    // If coverImage is a massive base64 string, store it in local IndexedDB and omit/compress in cloud payload to prevent 1MB document limit error
    if (typeof book.coverImage === 'string' && book.coverImage.length > 150000) {
      coverStorage.saveCover(book.id, book.coverImage);
      delete dataToSave.coverImage;
    }

    if (!book.startDate) {
      dataToSave.startDate = deleteField();
    }
    if (!book.endDate) {
      dataToSave.endDate = deleteField();
    }
    await setDoc(bookRef, dataToSave, { merge: true });
  } catch (error) {
    if (isQuotaError(error)) {
      markFirestoreQuotaExceeded();
    }
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Synchronizes the reading progress of ONLY a single active book with the cloud.
 * Directly queries the specific book document in Firestore to prevent full-library overhead.
 * Reconciles the latest reading position between devices, updates chapters and local IndexedDB.
 */
export async function syncSingleBookReadingProgress(
  userId: string,
  localBook: Book
): Promise<{
  book: Book;
  source: 'cloud' | 'local' | 'synced';
  message: string;
}> {
  if (!userId || !localBook || !localBook.id) {
    return {
      book: localBook,
      source: 'local',
      message: `✓ Avance guardado localmente (Pág. ${localBook.currentPage} de ${localBook.totalPages})`,
    };
  }

  try {
    const bookRef = doc(db, 'users', userId, 'books', localBook.id);
    const snap = await getDoc(bookRef);

    let cloudData: Partial<Book> | null = null;
    let canonicalId = localBook.id;

    if (snap.exists()) {
      cloudData = snap.data() as Partial<Book>;
    } else {
      // Look for a book with matching normalized title & author in cloud collection to avoid duplicates
      try {
        const booksCol = collection(db, 'users', userId, 'books');
        const qSnap = await getDocs(booksCol);
        const normLocalKey = normalizeBookKey(localBook.title, localBook.author);
        for (const docItem of qSnap.docs) {
          const dData = docItem.data() as Partial<Book>;
          if (normalizeBookKey(dData.title, dData.author) === normLocalKey) {
            canonicalId = docItem.id;
            cloudData = dData;
            break;
          }
        }
      } catch (qErr) {
        console.warn('[Sync] Book search note:', qErr);
      }
    }

    if (!cloudData) {
      // Cloud document does not exist yet, upload local book to cloud
      const bookToUpload: Book = {
        ...localBook,
        id: canonicalId,
        updatedAt: new Date().toISOString(),
      };
      await saveBookToCloud(userId, bookToUpload);
      await bookStorage.saveBook(bookToUpload);
      const pct = bookToUpload.totalPages > 0 ? Math.round((bookToUpload.currentPage / bookToUpload.totalPages) * 100) : 0;
      return {
        book: bookToUpload,
        source: 'synced',
        message: `✓ Avance sincronizado con Firebase: Pág. ${bookToUpload.currentPage} de ${bookToUpload.totalPages} (${pct}%)`,
      };
    }

    const cloudPage = typeof cloudData.currentPage === 'number' ? cloudData.currentPage : 0;
    const localPage = typeof localBook.currentPage === 'number' ? localBook.currentPage : 0;

    const cloudTime = new Date(cloudData.updatedAt || cloudData.createdAt || 0).getTime();
    const localTime = new Date(localBook.updatedAt || localBook.createdAt || 0).getTime();

    let resolvedBook: Book = { ...localBook, id: canonicalId };
    let source: 'cloud' | 'local' | 'synced' = 'synced';
    let message = '';

    // If cloud is further ahead in page, or cloud was updated more recently with a different page
    const cloudIsAhead = cloudPage > localPage;
    const cloudIsNewer = cloudTime > localTime && cloudPage !== localPage;

    if (cloudIsAhead || cloudIsNewer) {
      // Cloud has newer reading progress (e.g. read from another device)
      const totalPages = localBook.totalPages || cloudData.totalPages || 0;
      const effectivePage = Math.min(totalPages > 0 ? totalPages : cloudPage, cloudPage);

      // Reconcile chapters with the new page count
      const currentChapters = (cloudData.chapters && cloudData.chapters.length > 0)
        ? cloudData.chapters
        : (localBook.chapters || []);
      const updatedChapters = currentChapters.map((ch) => ({
        ...ch,
        isRead: ch.endPage > 0 ? ch.endPage <= effectivePage : ch.isRead,
      }));

      resolvedBook = {
        ...localBook,
        id: canonicalId,
        currentPage: effectivePage,
        totalPages: totalPages,
        status: (cloudData.status as BookStatus) || localBook.status,
        chapters: updatedChapters,
        startDate: cloudData.startDate || localBook.startDate,
        endDate: cloudData.endDate || localBook.endDate,
        rating: cloudData.rating || localBook.rating,
        updatedAt: cloudData.updatedAt || new Date().toISOString(),
      };
      source = 'cloud';
      const pct = resolvedBook.totalPages > 0 ? Math.round((resolvedBook.currentPage / resolvedBook.totalPages) * 100) : 0;
      message = `✓ Avance actualizado desde Firebase: Pág. ${resolvedBook.currentPage} de ${resolvedBook.totalPages} (${pct}%)`;
    } else {
      // Local device is ahead or updated more recently -> push to cloud
      resolvedBook = {
        ...localBook,
        id: canonicalId,
        updatedAt: new Date().toISOString(),
      };
      await saveBookToCloud(userId, resolvedBook);
      source = 'synced';
      const pct = resolvedBook.totalPages > 0 ? Math.round((resolvedBook.currentPage / resolvedBook.totalPages) * 100) : 0;
      message = `✓ Avance sincronizado con Firebase: Pág. ${resolvedBook.currentPage} de ${resolvedBook.totalPages} (${pct}%)`;
    }

    if (localBook.id !== canonicalId) {
      await bookStorage.deleteBook(localBook.id).catch(() => {});
    }

    // Persist to local IndexedDB to guarantee persistence across reloads
    await bookStorage.saveBook(resolvedBook);
    return { book: resolvedBook, source, message };
  } catch (error) {
    if (isQuotaError(error)) {
      markFirestoreQuotaExceeded();
    }
    await bookStorage.saveBook(localBook);
    const pct = localBook.totalPages > 0 ? Math.round((localBook.currentPage / localBook.totalPages) * 100) : 0;
    return {
      book: localBook,
      source: 'local',
      message: `✓ Avance guardado: Pág. ${localBook.currentPage} de ${localBook.totalPages} (${pct}%)`,
    };
  }
}

/**
 * Delete a book from Firestore with tombstone recording for instant multi-device deletion sync
 */
export async function deleteBookFromCloud(
  userId: string,
  bookId: string,
  title?: string,
  author?: string
): Promise<void> {
  // 1. Record local tombstone immediately to prevent resurrection
  recordLocalDeletedBook(bookId, title, author);

  // 2. Clean local storage engines
  await bookStorage.deleteBook(bookId).catch(() => {});
  await coverStorage.deleteCover(bookId).catch(() => {});
  await chapterStorage.deleteChapters(bookId).catch(() => {});

  // Clean from localStorage arrays
  const cleanKey = (k: string) => {
    try {
      const raw = safeStorage.getItem(k);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter((item: any) => item && item.id !== bookId);
          if (filtered.length !== parsed.length) {
            safeStorage.setJson(k, filtered);
          }
        }
      }
    } catch {}
  };
  cleanKey('registro_lectura_all_books_backup');
  cleanKey('registro_lectura_books_v1');
  cleanKey('registro_lectura_books');
  cleanKey('registro_lectura_guest_books_v1');
  if (userId) cleanKey(`registro_lectura_account_books_${userId}`);

  if (!userId || isFirestoreQuotaExceeded()) return;
  const path = `users/${userId}/books/${bookId}`;
  const nowStr = new Date().toISOString();

  const deleteFromDbInstance = async (dbInstance: any) => {
    if (!dbInstance) return;
    try {
      const bookRef = doc(dbInstance, 'users', userId, 'books', bookId);
      await deleteDoc(bookRef);
      const delRef = doc(dbInstance, 'users', userId, 'deleted_books', bookId);
      await setDoc(delRef, {
        deletedAt: nowStr,
        ...(title ? { title, author: author || '' } : {}),
      });
    } catch (error) {
      if (isQuotaError(error)) {
        markFirestoreQuotaExceeded();
      }
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  await deleteFromDbInstance(db);
  if (defaultDb && defaultDb !== db) {
    await deleteFromDbInstance(defaultDb);
  }
}

/**
 * Save a single wishlist item to Firestore
 */
export async function saveWishToCloud(userId: string, wish: WishlistItem): Promise<void> {
  if (isFirestoreQuotaExceeded()) return;
  const path = `users/${userId}/wishlist/${wish.id}`;
  try {
    const wishRef = doc(db, 'users', userId, 'wishlist', wish.id);
    const sanitized = sanitizeForFirestore(wish) as Record<string, any>;
    if (wish.offerPrice === undefined || wish.offerPrice === null) {
      sanitized.offerPrice = deleteField();
    }
    if (wish.estimatedPrice === undefined || wish.estimatedPrice === null) {
      sanitized.estimatedPrice = deleteField();
    }
    await setDoc(wishRef, sanitized, { merge: true });
  } catch (error) {
    if (isQuotaError(error)) {
      markFirestoreQuotaExceeded();
    }
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Delete a wishlist item from Firestore with tombstone recording
 */
export async function deleteWishFromCloud(userId: string, wishId: string): Promise<void> {
  if (isFirestoreQuotaExceeded()) return;
  const path = `users/${userId}/wishlist/${wishId}`;
  try {
    const wishRef = doc(db, 'users', userId, 'wishlist', wishId);
    await deleteDoc(wishRef);
    const delRef = doc(db, 'users', userId, 'deleted_wishlist', wishId);
    await setDoc(delRef, { deletedAt: new Date().toISOString() });
  } catch (error) {
    if (isQuotaError(error)) {
      markFirestoreQuotaExceeded();
    }
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Save annual challenge to Firestore
 */
export async function saveAnnualChallengeToCloud(
  userId: string,
  annualChallenge: AnnualChallenge
): Promise<void> {
  if (isFirestoreQuotaExceeded()) return;
  const challengeId = annualChallenge.id || `annual-challenge-${annualChallenge.year || 2026}`;
  const path = `users/${userId}/challenges/${challengeId}`;
  try {
    const ref = doc(db, 'users', userId, 'challenges', challengeId);
    const sanitizedMonths = (annualChallenge.months || []).map((m) => ({
      ...m,
      monthNumber: Number(m.monthNumber),
      notes: m.notes || '',
      books: (m.books || []).map((b) => ({
        id: b.id,
        bookId: b.bookId || b.id,
        title: b.title,
        author: b.author,
        totalPages: b.totalPages,
        isRead: !!b.isRead,
        ...(b.coverImage ? { coverImage: b.coverImage } : {}),
      })),
    }));

    const sanitized = sanitizeForFirestore({
      ...annualChallenge,
      id: challengeId,
      year: annualChallenge.year || 2026,
      months: sanitizedMonths,
      updatedAt: new Date().toISOString(),
    });
    await setDoc(ref, sanitized, { merge: true });
  } catch (error) {
    if (isQuotaError(error)) {
      markFirestoreQuotaExceeded();
    }
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Save monthly challenges to Firestore
 */
export async function saveChallengesToCloud(
  userId: string,
  challenges: MonthlyChallenge[]
): Promise<void> {
  if (isFirestoreQuotaExceeded() || !challenges || challenges.length === 0) return;
  try {
    const batch = writeBatch(db);
    challenges.forEach((ch) => {
      const ref = doc(db, 'users', userId, 'challenges', ch.id);
      batch.set(ref, sanitizeForFirestore(ch), { merge: true });
    });
    await batch.commit();
  } catch (error) {
    if (isQuotaError(error)) {
      markFirestoreQuotaExceeded();
    }
    handleFirestoreError(error, OperationType.WRITE, `users/${userId}/challenges`);
  }
}

/**
 * Save user profile and preferences to Firestore
 */
export async function saveUserProfileToCloud(
  userId: string,
  profile: Partial<UserProfile> & { theme?: string }
): Promise<void> {
  if (isFirestoreQuotaExceeded()) return;
  const path = `users/${userId}`;
  try {
    const userRef = doc(db, 'users', userId);
    await setDoc(
      userRef,
      sanitizeForFirestore({
        ...profile,
        updatedAt: new Date().toISOString(),
      }),
      { merge: true }
    );
  } catch (error) {
    if (isQuotaError(error)) {
      markFirestoreQuotaExceeded();
    }
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Seed initial user data to Firestore only if explicitly needed (starts clean without dummy books)
 */
export async function seedInitialDataIfEmpty(
  _userId: string,
  _initialBooks: Book[],
  _initialWishlist: WishlistItem[],
  _initialChallenges: MonthlyChallenge[],
  _initialAnnualChallenge: AnnualChallenge
): Promise<boolean> {
  // Brand new accounts start completely clean with 0 books
  return false;
}

/**
 * Fetch all user books directly from Firestore (One-shot fetch with error handling and fallback database check)
 */
export async function fetchUserBooks(userId: string): Promise<Book[]> {
  const booksMap = new Map<string, Book>();
  let primaryError: any = null;

  // 0. Fetch cloud deleted tombstones to ensure deleted books are never returned
  const deletedSet = getLocalDeletedBookIds();
  try {
    const delRef = collection(db, 'users', userId, 'deleted_books');
    const delSnap = await getDocs(delRef);
    delSnap.forEach((d) => {
      deletedSet.add(d.id);
      recordLocalDeletedBook(d.id, d.data()?.title, d.data()?.author);
    });
  } catch {}

  // 1. Fetch from primary database (e.g. ai-studio-miregistrodelect-...)
  try {
    const booksRef = collection(db, 'users', userId, 'books');
    const snapshot = await getDocs(booksRef);
    snapshot.forEach((docSnap) => {
      const item = docSnap.data() as any;
      if (item && item.id && !isChapterDerivedBook(item) && !isChapterDerivedBook({ id: docSnap.id, ...item })) {
        if (!deletedSet.has(item.id) && !isBookLocallyDeleted(item.id, item.title, item.author)) {
          booksMap.set(item.id, item as Book);
        }
      }
    });
  } catch (error: any) {
    primaryError = error;
    handleFirestoreError(error, OperationType.LIST, `users/${userId}/books`);
  }

  // 2. ALWAYS also check default database in Firestore to recover any books created there
  if (defaultDb && defaultDb !== db) {
    try {
      const fallbackRef = collection(defaultDb, 'users', userId, 'books');
      const fallbackSnap = await getDocs(fallbackRef);
      fallbackSnap.forEach((docSnap) => {
        const item = docSnap.data() as any;
        if (item && item.id && !booksMap.has(item.id) && !isChapterDerivedBook(item) && !isChapterDerivedBook({ id: docSnap.id, ...item })) {
          if (!deletedSet.has(item.id) && !isBookLocallyDeleted(item.id, item.title, item.author)) {
            booksMap.set(item.id, item as Book);
          }
        }
      });
    } catch (fallbackErr) {
      console.warn('[Sync] Fallback default database check note:', fallbackErr);
    }
  }

  // 3. Merge with IndexedDB master persistent books store
  try {
    const localDbBooks = await bookStorage.getAllBooks();
    localDbBooks.forEach((b) => {
      if (!b || !b.id || isChapterDerivedBook(b)) return;
      if (deletedSet.has(b.id) || isBookLocallyDeleted(b.id, b.title, b.author)) {
        bookStorage.deleteBook(b.id).catch(() => {});
        return;
      }
      if (!booksMap.has(b.id)) {
        booksMap.set(b.id, b);
      } else {
        const existing = booksMap.get(b.id)!;
        if (isCorruptedOrPlaceholderTitle(existing.title) && !isCorruptedOrPlaceholderTitle(b.title)) {
          booksMap.set(b.id, {
            ...existing,
            title: b.title,
            author: b.author || existing.author,
            coverImage: existing.coverImage || b.coverImage,
            totalPages: existing.totalPages || b.totalPages,
          });
        }
      }
    });
  } catch {}

  if (booksMap.size === 0 && primaryError) {
    throw primaryError;
  }

  const rawBooks = Array.from(booksMap.values());
  const { deduplicated, removedIds } = deduplicateBooks(rawBooks);

  if (removedIds.length > 0) {
    setTimeout(() => {
      removedIds.forEach((dupId) => {
        deleteDoc(doc(db, 'users', userId, 'books', dupId)).catch(() => {});
        if (defaultDb && defaultDb !== db) {
          deleteDoc(doc(defaultDb, 'users', userId, 'books', dupId)).catch(() => {});
        }
        bookStorage.deleteBook(dupId).catch(() => {});
      });
    }, 50);
  }

  deduplicated.sort((a, b) => {
    const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return dateB - dateA;
  });
  return deduplicated;
}

/**
 * Fetch all user wishlist items directly from Firestore
 */
export async function fetchUserWishlist(userId: string): Promise<WishlistItem[]> {
  const list: WishlistItem[] = [];
  let primaryError: any = null;

  try {
    const wishlistRef = collection(db, 'users', userId, 'wishlist');
    const snapshot = await getDocs(wishlistRef);
    snapshot.forEach((docSnap) => {
      list.push(docSnap.data() as WishlistItem);
    });
  } catch (error: any) {
    primaryError = error;
    handleFirestoreError(error, OperationType.LIST, `users/${userId}/wishlist`);
  }

  if (list.length === 0 && defaultDb && defaultDb !== db) {
    try {
      const fallbackRef = collection(defaultDb, 'users', userId, 'wishlist');
      const fallbackSnap = await getDocs(fallbackRef);
      fallbackSnap.forEach((docSnap) => {
        list.push(docSnap.data() as WishlistItem);
      });
    } catch {}
  }

  if (list.length === 0 && primaryError) {
    throw primaryError;
  }

  list.sort((a, b) => {
    const dateA = new Date(a.createdAt || 0).getTime();
    const dateB = new Date(b.createdAt || 0).getTime();
    return dateB - dateA;
  });
  return list;
}

/**
 * Fetch user challenges directly from Firestore
 */
export async function fetchUserChallenges(userId: string): Promise<{
  challenges: MonthlyChallenge[];
  annualChallengesByYear: Record<number, AnnualChallenge>;
}> {
  const monthly: MonthlyChallenge[] = [];
  const annualMap: Record<number, AnnualChallenge> = {};
  let primaryError: any = null;

  try {
    const challengesRef = collection(db, 'users', userId, 'challenges');
    const snapshot = await getDocs(challengesRef);

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data && Array.isArray(data.months)) {
        const docId = docSnap.id;
        const parsedYear = data.year || (docId.includes('202') ? parseInt(docId.replace(/\D/g, ''), 10) : 2026);
        const ann: AnnualChallenge = {
          id: data.id || docId,
          year: parsedYear,
          title: data.title || `Desafío de Lectura ${parsedYear}`,
          months: data.months || [],
          createdAt: data.createdAt || `${parsedYear}-01-01T00:00:00.000Z`,
          updatedAt: data.updatedAt || '1970-01-01T00:00:00.000Z',
        };
        if (ann.year) {
          const existing = annualMap[ann.year];
          if (!existing) {
            annualMap[ann.year] = ann;
          } else {
            annualMap[ann.year] = mergeAnnualChallenges(existing, ann);
          }
        }
      } else {
        monthly.push(data as MonthlyChallenge);
      }
    });
  } catch (error: any) {
    primaryError = error;
    handleFirestoreError(error, OperationType.LIST, `users/${userId}/challenges`);
  }

  if (Object.keys(annualMap).length === 0 && monthly.length === 0 && defaultDb && defaultDb !== db) {
    try {
      const fallbackRef = collection(defaultDb, 'users', userId, 'challenges');
      const fallbackSnap = await getDocs(fallbackRef);
      fallbackSnap.forEach((docSnap) => {
        const data = docSnap.data();
        if (data && Array.isArray(data.months)) {
          const docId = docSnap.id;
          const parsedYear = data.year || (docId.includes('202') ? parseInt(docId.replace(/\D/g, ''), 10) : 2026);
          const ann: AnnualChallenge = {
            id: data.id || docId,
            year: parsedYear,
            title: data.title || `Desafío de Lectura ${parsedYear}`,
            months: data.months || [],
            createdAt: data.createdAt || `${parsedYear}-01-01T00:00:00.000Z`,
            updatedAt: data.updatedAt || '1970-01-01T00:00:00.000Z',
          };
          if (ann.year) {
            annualMap[ann.year] = ann;
          }
        } else {
          monthly.push(data as MonthlyChallenge);
        }
      });
    } catch {}
  }

  if (Object.keys(annualMap).length === 0 && monthly.length === 0 && primaryError) {
    throw primaryError;
  }

  return {
    challenges: monthly,
    annualChallengesByYear: annualMap,
  };
}

/**
 * Save books in batches to Firestore (Efficient multi-book upload with cover protection)
 */
export async function saveBooksBatchToCloud(userId: string, books: Book[]): Promise<void> {
  if (isFirestoreQuotaExceeded() || !books || books.length === 0) return;
  const CHUNK_SIZE = 15;
  for (let i = 0; i < books.length; i += CHUNK_SIZE) {
    if (isFirestoreQuotaExceeded()) return;
    const chunk = books.slice(i, i + CHUNK_SIZE);
    try {
      const batch = writeBatch(db);
      chunk.forEach((b) => {
        const ref = doc(db, 'users', userId, 'books', b.id);
        const bookCopy = { ...b };
        if (bookCopy.coverImage && typeof bookCopy.coverImage === 'string') {
          bookCopy.coverImage = ensureHttps(bookCopy.coverImage);
          if (bookCopy.coverImage.length > 150000) {
            coverStorage.saveCover(b.id, bookCopy.coverImage);
            delete bookCopy.coverImage;
          }
        }
        const data: Record<string, any> = sanitizeForFirestore(bookCopy);
        if (!b.startDate) data.startDate = deleteField();
        if (!b.endDate) data.endDate = deleteField();
        batch.set(ref, data, { merge: true });
      });
      await batch.commit();
    } catch (batchErr) {
      if (isQuotaError(batchErr)) {
        markFirestoreQuotaExceeded();
        return;
      }
      handleFirestoreError(batchErr, OperationType.WRITE, `users/${userId}/books`);
    }
  }
}

/**
 * Save wishlist in batches to Firestore
 */
export async function saveWishlistBatchToCloud(userId: string, items: WishlistItem[]): Promise<void> {
  if (isFirestoreQuotaExceeded() || !items || items.length === 0) return;
  const CHUNK_SIZE = 50;
  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    if (isFirestoreQuotaExceeded()) return;
    const chunk = items.slice(i, i + CHUNK_SIZE);
    try {
      const batch = writeBatch(db);
      chunk.forEach((w) => {
        const ref = doc(db, 'users', userId, 'wishlist', w.id);
        const sanitized: Record<string, any> = sanitizeForFirestore(w);
        if (w.offerPrice === undefined || w.offerPrice === null) {
          sanitized.offerPrice = deleteField();
        }
        if (w.estimatedPrice === undefined || w.estimatedPrice === null) {
          sanitized.estimatedPrice = deleteField();
        }
        batch.set(ref, sanitized, { merge: true });
      });
      await batch.commit();
    } catch (batchErr) {
      if (isQuotaError(batchErr)) {
        markFirestoreQuotaExceeded();
        return;
      }
      handleFirestoreError(batchErr, OperationType.WRITE, `users/${userId}/wishlist`);
    }
  }
}

/**
 * Checks if an annual challenge has actual user entries (books entered or custom categories)
 */
export function hasAnnualChallengeContent(ann?: AnnualChallenge | null): boolean {
  if (!ann || !Array.isArray(ann.months)) return false;
  return ann.months.some(
    (m) =>
      (Array.isArray(m.books) && m.books.length > 0) ||
      (typeof m.category === 'string' && m.category.trim() !== '')
  );
}

const MONTH_NAMES_STANDARDIZED = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/**
 * Safely merge two annual challenges for the same year without losing any books or categories.
 * Strictly guarantees all 12 months (especially December) are retained.
 */
export function mergeAnnualChallenges(
  a: AnnualChallenge,
  b: AnnualChallenge
): AnnualChallenge {
  const year = a.year || b.year || 2026;
  const aMonths = Array.isArray(a.months) ? a.months : [];
  const bMonths = Array.isArray(b.months) ? b.months : [];

  const timeA = new Date(a.updatedAt || 0).getTime();
  const timeB = new Date(b.updatedAt || 0).getTime();
  const bIsNewer = timeB > timeA;

  // We iterate through all 12 months (1..12) to ensure no month is ever dropped or lost
  const mergedMonths: AnnualMonthChallenge[] = [];

  for (let mNum = 1; mNum <= 12; mNum++) {
    const mA = aMonths.find((m) => Number(m.monthNumber) === mNum);
    const mB = bMonths.find((m) => Number(m.monthNumber) === mNum);

    const defaultName = MONTH_NAMES_STANDARDIZED[mNum - 1];

    if (!mA && !mB) {
      mergedMonths.push({
        monthNumber: mNum,
        monthName: defaultName,
        category: '',
        notes: '',
        books: [],
      });
      continue;
    }

    if (!mA && mB) {
      mergedMonths.push({
        ...mB,
        monthNumber: mNum,
        monthName: mB.monthName || defaultName,
        notes: mB.notes || '',
        books: (mB.books || []).map((bk) => ({
          ...bk,
          coverImage: bk.coverImage || undefined,
        })),
      });
      continue;
    }

    if (mA && !mB) {
      mergedMonths.push({
        ...mA,
        monthNumber: mNum,
        monthName: mA.monthName || defaultName,
        notes: mA.notes || '',
        books: (mA.books || []).map((bk) => ({
          ...bk,
          coverImage: bk.coverImage || undefined,
        })),
      });
      continue;
    }

    // Both mA and mB exist for this month: merge them intelligently without losing books
    const bookMap = new Map<string, MonthChallengeBook>();

    const addOrMergeBook = (bk: MonthChallengeBook) => {
      const key = bk.id || bk.bookId || bk.title;
      if (!key) return;
      const cleanBook: MonthChallengeBook = {
        ...bk,
        id: bk.id || bk.bookId || key,
        coverImage: bk.coverImage || undefined,
      };
      const existing = bookMap.get(key);
      if (!existing) {
        bookMap.set(key, cleanBook);
      } else {
        bookMap.set(key, {
          ...existing,
          ...cleanBook,
          isRead: existing.isRead || cleanBook.isRead,
          totalPages: cleanBook.totalPages || existing.totalPages,
          coverImage: cleanBook.coverImage || existing.coverImage,
        });
      }
    };

    (mA!.books || []).forEach(addOrMergeBook);
    (mB!.books || []).forEach(addOrMergeBook);

    // Pick category: prefer non-empty; if both non-empty, prefer newer
    let chosenCategory = '';
    const catA = (mA!.category || '').trim();
    const catB = (mB!.category || '').trim();
    if (catA && catB) {
      chosenCategory = bIsNewer ? catB : catA;
    } else {
      chosenCategory = catA || catB;
    }

    // Pick notes: prefer non-empty; if both non-empty, prefer newer
    let chosenNotes = '';
    const notesA = (mA!.notes || '').trim();
    const notesB = (mB!.notes || '').trim();
    if (notesA && notesB) {
      chosenNotes = bIsNewer ? notesB : notesA;
    } else {
      chosenNotes = notesA || notesB;
    }

    mergedMonths.push({
      monthNumber: mNum,
      monthName: mA!.monthName || mB!.monthName || defaultName,
      category: chosenCategory,
      notes: chosenNotes,
      books: Array.from(bookMap.values()),
    });
  }

  const latestTime = Math.max(timeA, timeB);

  return {
    id: a.id || b.id || `annual-challenge-${year}`,
    year,
    title: a.title || b.title || `Desafío de Lectura ${year}`,
    createdAt: a.createdAt || b.createdAt || `${year}-01-01T00:00:00.000Z`,
    updatedAt: latestTime > 0 ? new Date(latestTime).toISOString() : new Date().toISOString(),
    months: mergedMonths,
  };
}

/**
 * Merge local books with cloud books (deduplicated by id and title/author fingerprint, picking latest updatedAt/progress)
 */
export function mergeBooks(localList: Book[], cloudList: Book[]): {
  merged: Book[];
  toUpload: Book[];
  removedIds: string[];
} {
  const map = new Map<string, Book>();
  const toUpload: Book[] = [];

  const cleanCloud = filterRealBooksOnly(cloudList || []);
  const cleanLocal = filterRealBooksOnly(localList || []);

  const isCorrupted = (b?: Book) => {
    if (!b || !b.title) return true;
    return isCorruptedOrPlaceholderTitle(b.title);
  };

  // Index cloud books
  cleanCloud.forEach((cb) => {
    if (cb && cb.id) {
      map.set(cb.id, cb);
    }
  });

  // Reconcile with local books
  cleanLocal.forEach((lb) => {
    if (!lb || !lb.id) return;
    let existing = map.get(lb.id);
    let matchedByTitle = false;

    if (!existing && !isCorrupted(lb)) {
      // Find matching cloud book by duplicate algorithm
      for (const cb of Array.from(map.values())) {
        if (areBooksDuplicate(cb, lb)) {
          existing = cb;
          matchedByTitle = true;
          break;
        }
      }
    }

    if (!existing) {
      map.set(lb.id, lb);
      toUpload.push(lb);
    } else {
      const localTime = new Date(lb.updatedAt || lb.createdAt || 0).getTime();
      const cloudTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
      const bestCover = lb.coverImage || existing.coverImage;

      // Always choose the non-zero totalPages if one device is missing it
      const bestTotalPages = Math.max(lb.totalPages || 0, existing.totalPages || 0);

      // Check if finished status or total pages reached on either side
      const lbIsFinished = lb.status === 'leido' || (lb.totalPages > 0 && (lb.currentPage || 0) >= lb.totalPages);
      const cloudIsFinished = existing.status === 'leido' || (existing.totalPages > 0 && (existing.currentPage || 0) >= existing.totalPages);

      let bestCurrentPage = 0;
      if (lbIsFinished || cloudIsFinished) {
        bestCurrentPage = bestTotalPages > 0 ? bestTotalPages : Math.max(lb.currentPage || 0, existing.currentPage || 0);
      } else if (localTime > cloudTime) {
        bestCurrentPage = lb.currentPage ?? existing.currentPage ?? 0;
      } else if (cloudTime > localTime) {
        bestCurrentPage = existing.currentPage ?? lb.currentPage ?? 0;
      } else {
        bestCurrentPage = Math.max(lb.currentPage || 0, existing.currentPage || 0);
      }

      if (bestTotalPages > 0 && bestCurrentPage > bestTotalPages) {
        bestCurrentPage = bestTotalPages;
      }

      // Reconcile status
      let bestStatus: BookStatus = (cloudTime >= localTime ? existing.status : lb.status) || 'pendiente';
      if (lbIsFinished || cloudIsFinished || (bestTotalPages > 0 && bestCurrentPage >= bestTotalPages)) {
        bestStatus = 'leido';
      } else if (lb.status === 'leyendo' || existing.status === 'leyendo' || bestCurrentPage > 0) {
        bestStatus = 'leyendo';
      } else if (lb.status === 'abandonado' || existing.status === 'abandonado') {
        bestStatus = 'abandonado';
      } else if (lb.status === 'pausado' || existing.status === 'pausado') {
        bestStatus = 'pausado';
      }

      // Reconcile chapters
      const localChapters = Array.isArray(lb.chapters) ? lb.chapters : [];
      const cloudChapters = Array.isArray(existing.chapters) ? existing.chapters : [];

      let bestChapters = cloudChapters.length >= localChapters.length ? cloudChapters : localChapters;
      let chaptersNeedUpload = false;

      if (localChapters.length > 0 && cloudChapters.length === 0) {
        bestChapters = localChapters;
        chaptersNeedUpload = true;
      } else if (localChapters.length === 0 && cloudChapters.length > 0) {
        bestChapters = cloudChapters;
      } else if (localChapters.length > 0 && cloudChapters.length > 0) {
        if (localChapters.length > cloudChapters.length) {
          bestChapters = localChapters;
          chaptersNeedUpload = true;
        } else if (cloudChapters.length > localChapters.length) {
          bestChapters = cloudChapters;
        } else {
          if (cloudTime >= localTime) {
            bestChapters = cloudChapters;
          } else {
            bestChapters = localChapters;
            chaptersNeedUpload = true;
          }
        }
      }

      const bestParts = (lb.parts && lb.parts.length > 0) ? lb.parts : (existing.parts || []);
      const bestHasParts = lb.hasParts !== undefined ? lb.hasParts : (existing.hasParts ?? false);

      const bestStartDate = cloudTime >= localTime ? (existing.startDate || lb.startDate) : (lb.startDate || existing.startDate);
      const bestEndDate = cloudTime >= localTime ? (existing.endDate || lb.endDate) : (lb.endDate || existing.endDate);
      const bestRating = cloudTime >= localTime ? (existing.rating ?? lb.rating) : (lb.rating ?? existing.rating);
      const bestFormat = existing.format || lb.format;
      const bestCategory = (existing.category && existing.category !== 'General') ? existing.category : (lb.category || existing.category);

      const existingHasReal = !isCorruptedOrPlaceholderTitle(existing.title);
      const lbHasReal = !isCorruptedOrPlaceholderTitle(lb.title);

      let bestTitle = lb.title;
      let bestAuthor = lb.author;
      let titleWasRepaired = false;

      if (existingHasReal && !lbHasReal) {
        bestTitle = existing.title;
        bestAuthor = existing.author || lb.author;
        titleWasRepaired = true;
      } else if (!existingHasReal && lbHasReal) {
        bestTitle = lb.title;
        bestAuthor = lb.author || existing.author;
        titleWasRepaired = true;
      } else {
        bestTitle = (cloudTime >= localTime ? existing.title : lb.title) || lb.title;
        bestAuthor = (cloudTime >= localTime ? existing.author : lb.author) || lb.author;
      }

      const baseObj = (existingHasReal && !lbHasReal) ? existing : ((!existingHasReal && lbHasReal) ? lb : (cloudTime >= localTime ? existing : lb));
      const targetCanonicalId = existing.id || lb.id;

      const mergedBook: Book = {
        ...baseObj,
        id: targetCanonicalId,
        title: bestTitle,
        author: bestAuthor,
        totalPages: bestTotalPages > 0 ? bestTotalPages : (existing.totalPages || lb.totalPages || 0),
        currentPage: bestCurrentPage,
        format: bestFormat,
        category: bestCategory,
        status: bestStatus,
        startDate: bestStartDate,
        endDate: bestEndDate,
        coverImage: bestCover,
        chapters: bestChapters,
        parts: bestParts,
        hasParts: bestHasParts,
        rating: bestRating,
        updatedAt: new Date(Math.max(localTime, cloudTime)).toISOString(),
      };

      map.set(targetCanonicalId, mergedBook);

      if (matchedByTitle && lb.id !== targetCanonicalId) {
        recordLocalDeletedBook(lb.id, lb.title, lb.author);
        bookStorage.deleteBook(lb.id).catch(() => {});
      }

      if (
        matchedByTitle ||
        titleWasRepaired ||
        localTime > cloudTime ||
        mergedBook.currentPage > (existing.currentPage || 0) ||
        mergedBook.totalPages > (existing.totalPages || 0) ||
        mergedBook.status !== existing.status ||
        chaptersNeedUpload ||
        (lb.coverImage && (!existing.coverImage || existing.coverImage !== lb.coverImage))
      ) {
        toUpload.push(mergedBook);
      }
    }
  });

  // Run full deduplication pass to resolve any remaining collisions
  const { deduplicated, removedIds } = deduplicateBooks(Array.from(map.values()));
  removedIds.forEach((dupId) => {
    bookStorage.deleteBook(dupId).catch(() => {});
  });

  const merged = deduplicated.sort((a, b) => {
    const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return dateB - dateA;
  });

  return { merged, toUpload, removedIds };
}

/**
 * Merge local wishlist with cloud wishlist
 */
export function mergeWishlists(localList: WishlistItem[], cloudList: WishlistItem[]): {
  merged: WishlistItem[];
  toUpload: WishlistItem[];
} {
  const map = new Map<string, WishlistItem>();
  const toUpload: WishlistItem[] = [];

  cloudList.forEach((cw) => {
    map.set(cw.id, cw);
  });

  localList.forEach((lw) => {
    const existing = map.get(lw.id);
    if (!existing) {
      map.set(lw.id, lw);
      toUpload.push(lw);
    } else {
      const localTime = new Date(lw.updatedAt || lw.createdAt || 0).getTime();
      const cloudTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
      if (localTime > cloudTime) {
        map.set(lw.id, lw);
        toUpload.push(lw);
      }
    }
  });

  const merged = Array.from(map.values()).sort((a, b) => {
    const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return dateB - dateA;
  });

  return { merged, toUpload };
}

/**
 * Collect all local books from any local storage keys on this device
 */
export function collectAllLocalBooks(userId?: string): Book[] {
  const booksMap = new Map<string, Book>();
  const dummyIds = new Set(['book-1', 'book-2', 'book-3', 'book-4', 'book-5', 'book-6']);
  const defaultTitles = new Set(['Cien años de soledad', '1984', 'El Principito', 'Hábitos Atómicos', 'Dune', 'Sapiens']);
  const deletedSet = getLocalDeletedBookIds();

  const tryAdd = (raw: string | null) => {
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (isChallengeItem(parsed)) return;

      if (Array.isArray(parsed)) {
        parsed.forEach((b: Book) => {
          if (b && b.id && b.title && !isChapterDerivedBook(b)) {
            if (deletedSet.has(b.id) || isBookLocallyDeleted(b.id, b.title, b.author)) return;
            const isDummy = dummyIds.has(b.id) && defaultTitles.has(b.title);
            if (!isDummy) {
              const existing = booksMap.get(b.id);
              if (!existing) {
                booksMap.set(b.id, b);
              } else {
                const existingHasReal = !isCorruptedOrPlaceholderTitle(existing.title);
                const bHasReal = !isCorruptedOrPlaceholderTitle(b.title);
                if (!existingHasReal && bHasReal) {
                  booksMap.set(b.id, { ...b, coverImage: b.coverImage || existing.coverImage });
                } else if (existingHasReal && !bHasReal) {
                  booksMap.set(b.id, { ...existing, coverImage: existing.coverImage || b.coverImage });
                } else {
                  const exTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
                  const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
                  if (bTime > exTime) {
                    booksMap.set(b.id, { ...b, coverImage: b.coverImage || existing.coverImage });
                  }
                }
              }
            }
          }
        });
      } else if (parsed && typeof parsed === 'object') {
        if (Array.isArray(parsed.books)) {
          parsed.books.forEach((b: Book) => {
            if (b && b.id && b.title && !isChapterDerivedBook(b)) {
              if (deletedSet.has(b.id) || isBookLocallyDeleted(b.id, b.title, b.author)) return;
              const isDummy = dummyIds.has(b.id) && defaultTitles.has(b.title);
              if (!isDummy) {
                const existing = booksMap.get(b.id);
                if (!existing) {
                  booksMap.set(b.id, b);
                } else {
                  const existingHasReal = !isCorruptedOrPlaceholderTitle(existing.title);
                  const bHasReal = !isCorruptedOrPlaceholderTitle(b.title);
                  if (!existingHasReal && bHasReal) {
                    booksMap.set(b.id, { ...b, coverImage: b.coverImage || existing.coverImage });
                  } else if (existingHasReal && !bHasReal) {
                    booksMap.set(b.id, { ...existing, coverImage: existing.coverImage || b.coverImage });
                  } else {
                    const exTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
                    const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
                    if (bTime > exTime) {
                      booksMap.set(b.id, { ...b, coverImage: b.coverImage || existing.coverImage });
                    }
                  }
                }
              }
            }
          });
        }
      }
    } catch {}
  };

  if (userId) {
    tryAdd(safeStorage.getItem(`registro_lectura_account_books_${userId}`));
  }
  tryAdd(safeStorage.getItem('registro_lectura_guest_books_v1'));
  tryAdd(safeStorage.getItem('registro_lectura_books_v1'));
  tryAdd(safeStorage.getItem('registro_lectura_books'));
  tryAdd(safeStorage.getItem('registro_lectura_all_books_backup'));

  // Also check any other account books or library keys in localStorage
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (
          k &&
          (k.startsWith('registro_lectura_') ||
            k.includes('book') ||
            k.includes('libro') ||
            k.includes('library')) &&
          !k.includes('annual') &&
          !k.includes('challenge') &&
          !k.includes('wish') &&
          !k.includes('deseo') &&
          !k.includes('deleted')
        ) {
          tryAdd(safeStorage.getItem(k));
        }
      }
    }
  } catch {}

  const rawList = Array.from(booksMap.values());
  const { deduplicated } = deduplicateBooks(rawList);
  return deduplicated;
}

/**
 * Collect all local annual challenges from any storage keys on this device
 */
export function collectAllLocalAnnualChallenges(userId?: string): Record<number, AnnualChallenge> {
  const annualMap: Record<number, AnnualChallenge> = {};

  const tryAddAnnual = (ann: any) => {
    if (!ann || !ann.year || !Array.isArray(ann.months)) return;
    const yr = Number(ann.year);
    const existing = annualMap[yr];
    if (!existing) {
      annualMap[yr] = ann;
    } else {
      annualMap[yr] = mergeAnnualChallenges(existing, ann);
    }
  };

  const tryAddFromStr = (raw: string | null) => {
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        if (Array.isArray(parsed.months)) {
          tryAddAnnual(parsed);
        } else {
          // Object with year keys
          Object.values(parsed).forEach((val) => tryAddAnnual(val));
        }
      }
    } catch {}
  };

  if (userId) {
    tryAddFromStr(safeStorage.getItem(`registro_lectura_account_annuals_${userId}`));
  }

  // Only pull in guest data for years that are missing or if guest has real content
  const currentYears = new Set(Object.keys(annualMap).map(Number));

  const tryAddGuestStr = (raw: string | null) => {
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return;
      const candidates: any[] = Array.isArray(parsed.months) ? [parsed] : Object.values(parsed);
      candidates.forEach((cand) => {
        if (!cand || !cand.year || !Array.isArray(cand.months)) return;
        const yr = Number(cand.year);
        if (!currentYears.has(yr)) {
          tryAddAnnual(cand);
        } else if (hasAnnualChallengeContent(cand)) {
          tryAddAnnual(cand);
        }
      });
    } catch {}
  };

  tryAddGuestStr(safeStorage.getItem('registro_lectura_guest_annual_challenge_v1'));

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith('registro_lectura_guest_annual_challenge_year_')) {
          tryAddGuestStr(safeStorage.getItem(k));
        }
      }
    }
  } catch {}

  return annualMap;
}

/**
 * Collect all local wishlist items from this device
 */
export function collectAllLocalWishlist(userId?: string): WishlistItem[] {
  const wishMap = new Map<string, WishlistItem>();
  const dummyIds = new Set(['wish-1', 'wish-2', 'wish-3', 'wish-4']);

  const tryAdd = (raw: string | null) => {
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsed.forEach((w: WishlistItem) => {
          if (w && w.id && !dummyIds.has(w.id)) {
            wishMap.set(w.id, w);
          }
        });
      }
    } catch {}
  };

  if (userId) {
    tryAdd(safeStorage.getItem(`registro_lectura_account_wishlist_${userId}`));
  }
  tryAdd(safeStorage.getItem('registro_lectura_guest_wishlist_v1'));
  tryAdd(safeStorage.getItem('registro_lectura_wishlist_v1'));

  return Array.from(wishMap.values());
}

/**
 * Master two-way synchronization engine across multiple devices
 * Reconciles local data from all storage sources with Firestore cloud data.
 */
let inFlightReconcilePromise: Promise<{
  books: Book[];
  wishlist: WishlistItem[];
  annualChallengesByYear: Record<number, AnnualChallenge>;
  challenges: MonthlyChallenge[];
  cloudFetchError?: string | null;
}> | null = null;

export async function reconcileAndSyncAllData(
  userId: string,
  inMemoryBooks: Book[] = [],
  inMemoryWishlist: WishlistItem[] = [],
  inMemoryAnnuals: Record<number, AnnualChallenge> = {}
): Promise<{
  books: Book[];
  wishlist: WishlistItem[];
  annualChallengesByYear: Record<number, AnnualChallenge>;
  challenges: MonthlyChallenge[];
  cloudFetchError?: string | null;
}> {
  if (inFlightReconcilePromise) {
    return inFlightReconcilePromise;
  }

  inFlightReconcilePromise = (async () => {
    try {
      return await _executeReconcileAndSyncAllData(userId, inMemoryBooks, inMemoryWishlist, inMemoryAnnuals);
    } finally {
      inFlightReconcilePromise = null;
    }
  })();

  return inFlightReconcilePromise;
}

async function _executeReconcileAndSyncAllData(
  userId: string,
  inMemoryBooks: Book[] = [],
  inMemoryWishlist: WishlistItem[] = [],
  inMemoryAnnuals: Record<number, AnnualChallenge> = {}
): Promise<{
  books: Book[];
  wishlist: WishlistItem[];
  annualChallengesByYear: Record<number, AnnualChallenge>;
  challenges: MonthlyChallenge[];
  cloudFetchError?: string | null;
}> {
  console.info(`[Sync] Starting full multi-device reconciliation for user: ${userId}`);

  // 1. Gather all local sources (in-memory state + IndexedDB Master Storage + localStorage + Deep Scan)
  let deepScannedBooks: Book[] = [];
  try {
    const deepRes = await scanAndRecoverAllBooks(inMemoryBooks, userId);
    deepScannedBooks = deepRes.books;
  } catch {}

  const combinedLocalBooksMap = new Map<string, Book>();

  // 1a. Load from Deep Scanned & IndexedDB Master storage (safely preserves all 311+ books)
  deepScannedBooks.forEach((b) => {
    if (b && b.id) combinedLocalBooksMap.set(b.id, b);
  });

  try {
    const indexedDbBooks = await bookStorage.getAllBooks();
    indexedDbBooks.forEach((b) => {
      if (b && b.id && !combinedLocalBooksMap.has(b.id)) {
        combinedLocalBooksMap.set(b.id, b);
      }
    });
  } catch {}

  const mergeIntoLocalBooksMap = (b: Book) => {
    if (!b || !b.id) return;
    const existing = combinedLocalBooksMap.get(b.id);
    if (!existing) {
      combinedLocalBooksMap.set(b.id, b);
      return;
    }
    const existingHasReal = !isCorruptedOrPlaceholderTitle(existing.title);
    const bHasReal = !isCorruptedOrPlaceholderTitle(b.title);
    if (!existingHasReal && bHasReal) {
      combinedLocalBooksMap.set(b.id, {
        ...b,
        coverImage: b.coverImage || existing.coverImage,
        chapters: (b.chapters && b.chapters.length > 0) ? b.chapters : existing.chapters,
      });
    } else if (existingHasReal && !bHasReal) {
      combinedLocalBooksMap.set(b.id, {
        ...existing,
        coverImage: existing.coverImage || b.coverImage,
        currentPage: Math.max(existing.currentPage || 0, b.currentPage || 0),
        chapters: (existing.chapters && existing.chapters.length > 0) ? existing.chapters : b.chapters,
      });
    } else {
      const exTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
      const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
      const chosen = bTime >= exTime ? b : existing;
      combinedLocalBooksMap.set(b.id, {
        ...chosen,
        coverImage: b.coverImage || existing.coverImage,
      });
    }
  };

  // 1b. Merge from localStorage keys
  const storedBooks = collectAllLocalBooks(userId);
  storedBooks.forEach((b) => mergeIntoLocalBooksMap(b));

  // 1c. Merge from in-memory state
  inMemoryBooks.forEach((b) => mergeIntoLocalBooksMap(b));

  const allLocalBooks = Array.from(combinedLocalBooksMap.values());

  // 1b. Retrieve all local IndexedDB covers so covers pruned by localStorage limits are fully restored
  try {
    const localIndexedCovers = await coverStorage.getAllCovers();
    if (localIndexedCovers && Object.keys(localIndexedCovers).length > 0) {
      allLocalBooks.forEach((b) => {
        if (!b.coverImage && localIndexedCovers[b.id]) {
          b.coverImage = localIndexedCovers[b.id];
        }
      });
    }
  } catch {}

  // 1c. Retrieve all local IndexedDB chapters so chapters are fully restored
  try {
    const localIndexedChapters = await chapterStorage.getAllChapters();
    if (localIndexedChapters && Object.keys(localIndexedChapters).length > 0) {
      allLocalBooks.forEach((b) => {
        const stored = localIndexedChapters[b.id];
        if (stored && Array.isArray(stored.chapters) && stored.chapters.length > 0) {
          const currentChaps = Array.isArray(b.chapters) ? b.chapters : [];
          if (currentChaps.length < stored.chapters.length) {
            b.chapters = stored.chapters;
            b.hasParts = stored.hasParts ?? b.hasParts;
            b.parts = stored.parts && stored.parts.length > 0 ? stored.parts : b.parts;
          }
        }
      });
    }
  } catch {}

  const storedWishlist = collectAllLocalWishlist(userId);
  const combinedLocalWishMap = new Map<string, WishlistItem>();
  storedWishlist.forEach((w) => combinedLocalWishMap.set(w.id, w));
  inMemoryWishlist.forEach((w) => {
    if (w && w.id) combinedLocalWishMap.set(w.id, w);
  });
  const allLocalWishlist = Array.from(combinedLocalWishMap.values());

  const storedAnnuals = collectAllLocalAnnualChallenges(userId);
  const allLocalAnnuals: Record<number, AnnualChallenge> = { ...storedAnnuals };
  Object.entries(inMemoryAnnuals).forEach(([yrKey, ann]) => {
    const yr = Number(yrKey);
    const existing = allLocalAnnuals[yr];
    if (!existing) {
      allLocalAnnuals[yr] = ann;
    } else {
      allLocalAnnuals[yr] = mergeAnnualChallenges(existing, ann);
    }
  });

  // 2. Fetch fresh cloud data via direct one-shot HTTP calls
  let cloudBooks: Book[] = [];
  let cloudWishlist: WishlistItem[] = [];
  let cloudChallengeData: {
    challenges: MonthlyChallenge[];
    annualChallengesByYear: Record<number, AnnualChallenge>;
  } = { challenges: [], annualChallengesByYear: {} };
  let cloudFetchError: any = null;

  try {
    const [fetchedBooks, fetchedWishlist, fetchedChallenges] = await Promise.all([
      fetchUserBooks(userId),
      fetchUserWishlist(userId),
      fetchUserChallenges(userId),
    ]);
    cloudBooks = fetchedBooks;
    cloudWishlist = fetchedWishlist;
    cloudChallengeData = fetchedChallenges;
  } catch (err: any) {
    cloudFetchError = err;
    console.warn('[Sync] Cloud fetch note during reconciliation:', err?.message || err);
  }

  // 3. Reconcile Books
  const { merged: mergedBooks, toUpload: booksToUpload, removedIds } = mergeBooks(allLocalBooks, cloudBooks);
  if (booksToUpload.length > 0 && !cloudFetchError) {
    console.info(`[Sync] Uploading ${booksToUpload.length} local books to cloud for multi-device availability.`);
    try {
      await saveBooksBatchToCloud(userId, booksToUpload);
    } catch (saveErr) {
      console.warn('[Sync] Could not upload books batch to cloud:', saveErr);
    }
  }

  // Purge any removed duplicate IDs from Firestore and IndexedDB
  if (removedIds.length > 0) {
    setTimeout(() => {
      removedIds.forEach((dupId) => {
        deleteDoc(doc(db, 'users', userId, 'books', dupId)).catch(() => {});
        if (defaultDb && defaultDb !== db) {
          deleteDoc(doc(defaultDb, 'users', userId, 'books', dupId)).catch(() => {});
        }
        bookStorage.deleteBook(dupId).catch(() => {});
      });
    }, 100);
  }

  // Durably cache all retrieved covers in local IndexedDB
  mergedBooks.forEach((b) => {
    if (b.coverImage && typeof b.coverImage === 'string') {
      coverStorage.saveCover(b.id, b.coverImage);
    }
  });

  // Durably cache all retrieved chapters in local IndexedDB
  mergedBooks.forEach((b) => {
    if (Array.isArray(b.chapters) && b.chapters.length > 0) {
      chapterStorage.saveChapters(b.id, b.chapters, b.hasParts, b.parts);
    }
  });

  // 4. Reconcile Wishlist
  const { merged: mergedWishlist, toUpload: wishlistToUpload } = mergeWishlists(allLocalWishlist, cloudWishlist);
  if (wishlistToUpload.length > 0 && !cloudFetchError) {
    console.info(`[Sync] Uploading ${wishlistToUpload.length} local wishlist items to cloud.`);
    try {
      await saveWishlistBatchToCloud(userId, wishlistToUpload);
    } catch (saveWishErr) {
      console.warn('[Sync] Could not upload wishlist batch to cloud:', saveWishErr);
    }
  }

  // 5. Reconcile Annual Challenges
  const cloudAnnuals = cloudChallengeData.annualChallengesByYear || {};
  const reconciledAnnuals: Record<number, AnnualChallenge> = {
    2026: createAnnualChallengeForYear(2026),
    2027: createAnnualChallengeForYear(2027),
  };

  // Collect all years referenced in either cloud or local
  const allYears = new Set<number>([
    2026,
    2027,
    ...Object.keys(cloudAnnuals).map(Number),
    ...Object.keys(allLocalAnnuals).map(Number),
  ]);

  for (const yr of allYears) {
    const cloudAnn = cloudAnnuals[yr];
    const localAnn = allLocalAnnuals[yr];

    const cloudHasContent = hasAnnualChallengeContent(cloudAnn);
    const localHasContent = hasAnnualChallengeContent(localAnn);

    if (cloudHasContent && !localHasContent) {
      // Cloud has real data, local was blank/default -> adopt cloud
      reconciledAnnuals[yr] = cloudAnn;
    } else if (localHasContent && !cloudHasContent) {
      // Local has real data, cloud was blank -> upload local to cloud!
      reconciledAnnuals[yr] = localAnn;
      if (!cloudFetchError) {
        saveAnnualChallengeToCloud(userId, localAnn).catch(() => {});
      }
    } else if (localHasContent && cloudHasContent) {
      // Both devices have data -> merge them without losing anything!
      const mergedAnn = mergeAnnualChallenges(localAnn, cloudAnn);
      reconciledAnnuals[yr] = mergedAnn;
      if (!cloudFetchError) {
        saveAnnualChallengeToCloud(userId, mergedAnn).catch(() => {});
      }
    } else if (cloudAnn) {
      reconciledAnnuals[yr] = cloudAnn;
    } else if (localAnn) {
      reconciledAnnuals[yr] = localAnn;
    }
  }

  // Durably cache all merged books in local IndexedDB Master Store
  if (mergedBooks.length > 0) {
    try {
      await bookStorage.saveBooksBatch(mergedBooks);
    } catch {}
  }

  // 6. Cache reconciled clean data into localStorage for instant offline access
  if (mergedBooks.length > 0 || !cloudFetchError) {
    safeStorage.setJson(`registro_lectura_account_books_${userId}`, mergedBooks);
  }
  if (mergedWishlist.length > 0 || !cloudFetchError) {
    safeStorage.setJson(`registro_lectura_account_wishlist_${userId}`, mergedWishlist);
  }
  safeStorage.setJson(`registro_lectura_account_annuals_${userId}`, reconciledAnnuals);

  console.info(
    `[Sync] Multi-device reconciliation complete: ${mergedBooks.length} books, ${mergedWishlist.length} wishlist, challenges for years: [${Array.from(allYears).join(', ')}]`
  );

  let formattedCloudError: string | null = null;
  if (cloudFetchError) {
    if (isQuotaError(cloudFetchError)) {
      formattedCloudError = 'Cuota diaria de nube en pausa. Trabajando en modo local seguro con todos tus libros.';
    } else {
      formattedCloudError = 'Modo sin conexión. Datos resguardados localmente.';
    }
  }

  return {
    books: mergedBooks,
    wishlist: mergedWishlist,
    annualChallengesByYear: reconciledAnnuals,
    challenges: cloudChallengeData.challenges || [],
    cloudFetchError: formattedCloudError,
  };
}

export interface DeepScanResult {
  totalFound: number;
  newlyRecovered: number;
  books: Book[];
  sources: {
    indexedDbMaster: number;
    localStorageSlots: number;
    annualChallenges: number;
    cloudDatabase: number;
  };
}

/**
 * Smart heuristic to repair any corrupted book records caused by timestamp titles or mislabeled duplicates
 */
export function repairAndSanitizeBook(book: Book): Book {
  if (!book || typeof book !== 'object') return book;
  const b = { ...book };
  const titleTrimmed = (b.title || '').trim();
  const idStr = String(b.id || '').trim();

  // 1. Repair specific numeric timestamp IDs to their real titles & authors
  if (idStr === '1788143571951' || titleTrimmed === '1788143571951') {
    b.title = 'Jardín sombrío';
    b.author = 'V.C. Andrews';
    b.category = 'Misterio';
    if (!b.totalPages || b.totalPages === 0) b.totalPages = 384;
  } else if (idStr === '1788145139381' || titleTrimmed === '1788145139381') {
    b.title = 'Casas vacías';
    b.author = 'Brenda Navarro';
    b.category = 'Ficción contemporánea';
    if (!b.totalPages || b.totalPages === 0) b.totalPages = 160;
  } else if (idStr === '1788145217908' || titleTrimmed === '1788145217908') {
    b.title = 'Azúcar quemado';
    b.author = 'Avni Doshi';
    b.category = 'Ficción contemporánea';
    if (!b.totalPages || b.totalPages === 0) b.totalPages = 288;
  } else if (idStr === '1788190194512' || titleTrimmed === '1788190194512') {
    b.title = 'La bruja de Buchenwald';
    b.author = 'Francisco Javier Aspas';
    b.category = 'Ficción histórica';
    if (!b.totalPages || b.totalPages === 0) b.totalPages = 512;
  }

  // 2. Repair mislabeled "Lolita" titles on classics like Crimen y Castigo and Frankenstein
  if (titleTrimmed.toLowerCase() === 'lolita') {
    const hasDostoyevski =
      (b.author && b.author.toLowerCase().includes('dostoyevski')) ||
      (b.chapters && b.chapters.some((c) => c.title && c.title.toLowerCase().includes('sexta')));
    const isCrimen = hasDostoyevski || b.totalPages === 496;

    const hasShelley =
      (b.author && b.author.toLowerCase().includes('shelley')) ||
      (b.chapters && b.chapters.some((c) => c.title && (c.title.toLowerCase().includes('volumen') || c.title.toLowerCase().includes('walton'))));
    const isFrankenstein = !isCrimen && (hasShelley || (b.totalPages === 384 && idStr.includes('frank')));

    if (isCrimen) {
      b.title = 'Crimen y castigo';
      b.author = 'Fiódor Dostoyevski';
      b.category = 'Clásico';
      b.totalPages = 496;
      b.status = 'pendiente';
      b.currentPage = 0;
      delete b.startDate;
    } else if (isFrankenstein) {
      b.title = 'Frankenstein';
      b.author = 'Mary Shelley';
      b.category = 'Clásico';
      b.totalPages = 384;
      b.status = 'pendiente';
      b.currentPage = 0;
      delete b.startDate;
    }
  }

  // 3. Ensure status is always a valid normalized value
  const validStatuses = new Set(['leido', 'leyendo', 'pausado', 'pendiente', 'abandonado']);
  if (!b.status || !validStatuses.has(b.status)) {
    const rawSt = String(b.status || '').toLowerCase().trim();
    if (rawSt === 'read' || rawSt === 'terminado') {
      b.status = 'leido';
    } else if (rawSt === 'reading' || rawSt === 'en_progreso') {
      b.status = 'leyendo';
    } else if (rawSt === 'paused') {
      b.status = 'pausado';
    } else if (rawSt === 'abandoned' || rawSt === 'dropped') {
      b.status = 'abandonado';
    } else if (b.currentPage && b.totalPages && b.currentPage >= b.totalPages && b.totalPages > 0) {
      b.status = 'leido';
    } else if (b.currentPage && b.currentPage > 0) {
      b.status = 'leyendo';
    } else {
      b.status = 'pendiente';
    }
  }

  // 4. Ensure non-read books default to 0 stars
  if (b.status !== 'leido') {
    if (b.status === 'pendiente' || !b.rating || b.rating === 5) {
      b.rating = 0;
    }
  }

  return b;
}

/**
 * Scan all browser IndexedDB databases dynamically to recover any user books
 */
async function scanAllBrowserIndexedDBs(): Promise<Book[]> {
  const found: Book[] = [];
  if (typeof window === 'undefined' || !window.indexedDB) return found;

  const scannedDbNames = new Set<string>();

  try {
    if (typeof (window.indexedDB as any).databases === 'function') {
      const dbs = await (window.indexedDB as any).databases();
      if (Array.isArray(dbs)) {
        dbs.forEach((d: any) => {
          if (d && d.name) {
            // Do NOT scan chapters DB or covers DB as books!
            if (d.name !== 'registro_lectura_chapters_db' && d.name !== 'registro_lectura_covers_db') {
              scannedDbNames.add(d.name);
            }
          }
        });
      }
    }
  } catch {}

  // Always check the primary books master DB
  scannedDbNames.add('registro_lectura_books_master_db');

  for (const dbName of scannedDbNames) {
    if (dbName === 'registro_lectura_chapters_db' || dbName === 'registro_lectura_covers_db') continue;
    try {
      await new Promise<void>((resolve) => {
        let req: IDBOpenDBRequest;
        try {
          req = window.indexedDB.open(dbName);
        } catch {
          return resolve();
        }

        req.onerror = () => resolve();
        req.onblocked = () => resolve();
        req.onsuccess = () => {
          const dbInstance = req.result;
          const storeNames = Array.from(dbInstance.objectStoreNames || []);
          if (storeNames.length === 0) {
            try { dbInstance.close(); } catch {}
            return resolve();
          }

          let pendingStores = storeNames.length;
          const checkDone = () => {
            pendingStores--;
            if (pendingStores <= 0) {
              try { dbInstance.close(); } catch {}
              resolve();
            }
          };

          storeNames.forEach((sName) => {
            try {
              if (!dbInstance.objectStoreNames.contains(sName)) {
                checkDone();
                return;
              }

              const tx = dbInstance.transaction(sName, 'readonly');
              const store = tx.objectStore(sName);
              const getAllReq = store.getAll();

              getAllReq.onsuccess = () => {
                const results = getAllReq.result;
                const extractBooksFromObject = (val: any) => {
                  if (!val) return;
                  if (typeof val === 'string') {
                    try {
                      const p = JSON.parse(val);
                      extractBooksFromObject(p);
                    } catch {}
                    return;
                  }
                  if (typeof val !== 'object') return;

                  if (isChapterDerivedBook(val)) return;

                  if (val.id && (val.title || val.totalPages) && val.startPage === undefined && val.endPage === undefined) {
                    found.push(val as Book);
                  }
                  if (Array.isArray(val)) {
                    val.forEach(extractBooksFromObject);
                  } else {
                    if (Array.isArray(val.books)) {
                      val.books.forEach(extractBooksFromObject);
                    }
                    if (Array.isArray(val.months)) {
                      val.months.forEach((m: any) => {
                        if (m && Array.isArray(m.books)) m.books.forEach(extractBooksFromObject);
                      });
                    }
                  }
                };

                if (Array.isArray(results)) {
                  results.forEach(extractBooksFromObject);
                }
                checkDone();
              };

              getAllReq.onerror = () => {
                checkDone();
              };

              tx.onerror = () => {
                checkDone();
              };
            } catch {
              checkDone();
            }
          });
        };
      });
    } catch {}
  }

  return found;
}

/**
 * Deep scan across all IndexedDB stores, localStorage slots, annual challenge months,
 * and Firestore databases to locate and reconstruct any missing or lost books.
 */
export async function scanAndRecoverAllBooks(
  currentBooks: Book[] = [],
  userId?: string
): Promise<DeepScanResult> {
  const booksMap = new Map<string, Book>();
  const dummyIds = new Set(['book-1', 'book-2', 'book-3', 'book-4', 'book-5', 'book-6']);
  const defaultTitles = new Set(['Cien años de soledad', '1984', 'El Principito', 'Hábitos Atómicos', 'Dune', 'Sapiens']);

  let countFromIdb = 0;
  let countFromStorage = 0;
  let countFromAnnuals = 0;
  let countFromCloud = 0;

  const isCorruptedTitle = (title?: string) => {
    return isCorruptedOrPlaceholderTitle(title);
  };

  const registerBook = (rawBook: any, source: 'idb' | 'storage' | 'annual' | 'cloud') => {
    if (!rawBook || typeof rawBook !== 'object' || isChapterDerivedBook(rawBook)) return;
    const titleVal = rawBook.title || rawBook.titulo || rawBook.name;
    if (!rawBook.id && !titleVal) return;

    if (isBookLocallyDeleted(rawBook.id, titleVal, rawBook.author || rawBook.autor)) {
      return;
    }

    const bookObj: Book = {
      id: String(rawBook.id || `book_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`),
      title: String(titleVal || `Libro ${rawBook.id || ''}`).trim(),
      author: String(rawBook.author || rawBook.autor || '').trim(),
      coverImage: rawBook.coverImage || rawBook.cover || '',
      status: rawBook.status || (rawBook.isRead ? 'leido' : 'pendiente'),
      format: rawBook.format || 'fisico',
      category: rawBook.category || rawBook.genero || 'General',
      chapters: Array.isArray(rawBook.chapters) ? rawBook.chapters : [],
      parts: Array.isArray(rawBook.parts) ? rawBook.parts : [],
      hasParts: rawBook.hasParts ?? false,
      rating: rawBook.status === 'leido' || rawBook.isRead ? (rawBook.rating || 0) : 0,
      totalPages: rawBook.totalPages || 0,
      currentPage: rawBook.currentPage || (rawBook.isRead ? (rawBook.totalPages || 0) : 0),
      readYear: rawBook.readYear,
      startDate: rawBook.startDate,
      endDate: rawBook.endDate || rawBook.readDate,
      saga: rawBook.saga,
      sagaOrder: rawBook.sagaOrder,
      description: rawBook.description || rawBook.notes || rawBook.review || '',
      createdAt: rawBook.createdAt || new Date().toISOString(),
      updatedAt: rawBook.updatedAt || new Date().toISOString(),
    };

    const b = repairAndSanitizeBook(bookObj);
    const isDummy = dummyIds.has(b.id) && defaultTitles.has(b.title);
    if (isDummy) return;

    const existing = booksMap.get(b.id);
    if (!existing) {
      booksMap.set(b.id, b);
      if (source === 'idb') countFromIdb++;
      else if (source === 'storage') countFromStorage++;
      else if (source === 'annual') countFromAnnuals++;
      else if (source === 'cloud') countFromCloud++;
    } else {
      // Check if this is actually a DIFFERENT book with an ID collision
      const existingTitleNorm = existing.title.trim().toLowerCase();
      const bTitleNorm = b.title.trim().toLowerCase();
      if (existingTitleNorm !== bTitleNorm && !isCorruptedTitle(existing.title) && !isCorruptedTitle(b.title)) {
        const uniqueId = `${b.id}_recovered_${Math.random().toString(36).substring(2, 7)}`;
        b.id = uniqueId;
        booksMap.set(uniqueId, b);
        return;
      }

      const existingHasReal = !isCorruptedTitle(existing.title);
      const bHasReal = !isCorruptedTitle(b.title);

      // Prefer non-corrupted/real titles always
      let baseBook = existing;
      if (existingHasReal && !bHasReal) {
        baseBook = existing;
      } else if (!existingHasReal && bHasReal) {
        baseBook = b;
      } else {
        const exTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
        const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
        baseBook = bTime >= exTime ? b : existing;
      }

      const bestTitle = (existingHasReal && !bHasReal) ? existing.title : (bHasReal ? b.title : baseBook.title);
      const bestAuthor = (existingHasReal && !bHasReal && existing.author) ? existing.author : (b.author || baseBook.author);
      const bestCover = b.coverImage || existing.coverImage;
      const bChaps = Array.isArray(b.chapters) ? b.chapters : [];
      const exChaps = Array.isArray(existing.chapters) ? existing.chapters : [];
      const bestChapters = bChaps.length >= exChaps.length ? (bChaps.length > 0 ? bChaps : exChaps) : exChaps;
      const bestParts = (b.parts && b.parts.length > 0) ? b.parts : (existing.parts || []);
      const bestHasParts = b.hasParts !== undefined ? b.hasParts : (existing.hasParts ?? false);

      const merged: Book = {
        ...baseBook,
        title: bestTitle,
        author: bestAuthor,
        coverImage: bestCover,
        chapters: bestChapters,
        parts: bestParts,
        hasParts: bestHasParts,
      };
      booksMap.set(b.id, merged);
    }
  };

  // 1. Current in-memory books
  currentBooks.forEach((b) => registerBook(b, 'storage'));

  // 2. Comprehensive All-IndexedDB scanner
  try {
    const allIdbBooks = await scanAllBrowserIndexedDBs();
    allIdbBooks.forEach((b) => registerBook(b, 'idb'));
  } catch (err) {
    console.warn('[Recovery] IndexedDB scan note:', err);
  }

  // 3. LocalStorage and SessionStorage keys scanner
  const scanStorageObject = (storage: Storage, sourceLabel: 'storage' | 'annual') => {
    try {
      for (let i = 0; i < storage.length; i++) {
        const k = storage.key(i);
        if (
          k &&
          !k.includes('wish') &&
          !k.includes('deseo') &&
          !k.includes('challenge') &&
          !k.includes('annual') &&
          !k.includes('deleted')
        ) {
          const raw = storage.getItem(k);
          if (raw) {
            try {
              const parsed = JSON.parse(raw);
              if (isChallengeItem(parsed)) {
                return;
              }
              if (Array.isArray(parsed)) {
                parsed.forEach((item) => {
                  if (!isChallengeItem(item)) {
                    registerBook(item, sourceLabel);
                  }
                });
              } else if (parsed && typeof parsed === 'object') {
                if (Array.isArray(parsed.books)) {
                  parsed.books.forEach((item: any) => {
                    if (!isChallengeItem(item)) {
                      registerBook(item, sourceLabel);
                    }
                  });
                }
              }
            } catch {}
          }
        }
      }
    } catch {}
  };

  if (typeof window !== 'undefined') {
    if (window.localStorage) scanStorageObject(window.localStorage, 'storage');
    if (window.sessionStorage) scanStorageObject(window.sessionStorage, 'storage');
  }

  // 4. Annual Challenges scanner across all years (only genuine user books inside challenge months)
  const annuals = collectAllLocalAnnualChallenges(userId);
  Object.values(annuals).forEach((ann) => {
    if (ann && Array.isArray(ann.months)) {
      ann.months.forEach((m) => {
        if (Array.isArray(m.books)) {
          m.books.forEach((mb) => {
            if (!mb || !mb.title || isChallengeItem(mb) || isCorruptedOrPlaceholderTitle(mb.title)) {
              return;
            }
            if (isBookLocallyDeleted(mb.id, mb.title, mb.author)) return;
            const rawMb = mb as any;
            registerBook(
              {
                id: mb.id,
                title: mb.title,
                author: mb.author || '',
                coverImage: mb.coverImage || '',
                status: mb.isRead ? 'leido' : 'pendiente',
                format: 'fisico',
                category: 'General',
                chapters: [],
                rating: mb.isRead ? (rawMb.rating || 0) : 0,
                endDate: rawMb.readDate || '',
                readYear: ann.year,
                totalPages: mb.totalPages || 0,
                currentPage: mb.isRead ? (mb.totalPages || 0) : 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
              'annual'
            );
          });
        }
      });
    }
  });

  // 5. Cloud Firestore Databases (both primary db and defaultDb)
  if (userId) {
    try {
      const primarySnap = await getDocs(collection(db, 'users', userId, 'books'));
      primarySnap.forEach((docSnap) => registerBook(docSnap.data(), 'cloud'));
    } catch {}

    if (defaultDb && defaultDb !== db) {
      try {
        const fallbackSnap = await getDocs(collection(defaultDb, 'users', userId, 'books'));
        fallbackSnap.forEach((docSnap) => registerBook(docSnap.data(), 'cloud'));
      } catch {}
    }
  }

  // Restore covers & chapters from IndexedDB caches to existing books
  try {
    const covers = await coverStorage.getAllCovers();
    Object.entries(covers).forEach(([bookId, coverUrl]) => {
      if (coverUrl) {
        const existing = booksMap.get(bookId);
        if (existing && !existing.coverImage) {
          existing.coverImage = coverUrl;
        }
      }
    });
    // Also durably cache covers for any book that has coverImage set
    booksMap.forEach((b) => {
      if (b.id && b.coverImage) {
        coverStorage.saveCover(b.id, b.coverImage).catch(() => {});
      }
    });
  } catch {}

  // Preserve every recovered book and run deduplication
  const allBooksList = Array.from(booksMap.values()).map((b) => repairAndSanitizeBook(b));
  const { deduplicated: deduplicatedList, removedIds } = deduplicateBooks(allBooksList);

  if (removedIds.length > 0 && userId) {
    setTimeout(() => {
      removedIds.forEach((dupId) => {
        deleteDoc(doc(db, 'users', userId, 'books', dupId)).catch(() => {});
        if (defaultDb && defaultDb !== db) {
          deleteDoc(doc(defaultDb, 'users', userId, 'books', dupId)).catch(() => {});
        }
        bookStorage.deleteBook(dupId).catch(() => {});
      });
    }, 50);
  }

  const recoveredBooks = deduplicatedList.sort((a, b) => {
    const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return dateB - dateA;
  });

  // Permanently preserve the recovered library into master IndexedDB
  if (recoveredBooks.length > 0) {
    try {
      await bookStorage.saveBooksBatch(recoveredBooks);
    } catch {}
  }

  // If user is logged in, upload missing books to cloud in background
  if (userId && recoveredBooks.length > 0) {
    saveBooksBatchToCloud(userId, recoveredBooks).catch(() => {});
  }

  const prevIds = new Set(currentBooks.map((b) => b.id));
  const newlyRecovered = recoveredBooks.filter((b) => !prevIds.has(b.id)).length;

  return {
    totalFound: recoveredBooks.length,
    newlyRecovered,
    books: recoveredBooks,
    sources: {
      indexedDbMaster: countFromIdb,
      localStorageSlots: countFromStorage,
      annualChallenges: countFromAnnuals,
      cloudDatabase: countFromCloud,
    },
  };
}

export interface FullLibraryBackup {
  version: number;
  exportedAt: string;
  user?: UserProfile;
  books: Book[];
  wishlist?: WishlistItem[];
  annualChallenges?: Record<number, AnnualChallenge>;
  annualChallengesByYear?: Record<number, AnnualChallenge>;
  challenges?: MonthlyChallenge[];
}

export function generateLibraryBackupJson(
  books: Book[],
  wishlist?: WishlistItem[],
  annualChallenges?: Record<number, AnnualChallenge>,
  user?: UserProfile,
  challenges?: MonthlyChallenge[]
): string {
  const cleanBooks = filterRealBooksOnly(books || []);
  const backup: FullLibraryBackup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    user,
    books: cleanBooks,
    wishlist: wishlist || [],
    annualChallenges: annualChallenges || {},
    annualChallengesByYear: annualChallenges || {},
    challenges: challenges || [],
  };
  return JSON.stringify(backup, null, 2);
}

export function downloadLibraryBackupFile(jsonContent: string, fileName?: string): void {
  if (typeof window === 'undefined') return;
  const dateStr = new Date().toISOString().split('T')[0];
  const name = fileName || `mi_registro_de_lectura_respaldo_${dateStr}.json`;
  const blob = new Blob([jsonContent], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function parseLibraryBackupJson(jsonString: string): {
  books: Book[];
  wishlist: WishlistItem[];
  annualChallenges: Record<number, AnnualChallenge>;
  challenges: MonthlyChallenge[];
  user?: UserProfile;
} {
  try {
    const parsed = JSON.parse(jsonString);
    let books: Book[] = [];
    let wishlist: WishlistItem[] = [];
    let annualChallenges: Record<number, AnnualChallenge> = {};
    let challenges: MonthlyChallenge[] = [];
    let user: UserProfile | undefined;

    if (Array.isArray(parsed)) {
      books = filterRealBooksOnly(parsed.filter((b) => b && typeof b === 'object' && b.id && b.title));
    } else if (typeof parsed === 'object' && parsed !== null) {
      if (Array.isArray(parsed.books)) {
        books = filterRealBooksOnly(parsed.books.filter((b: any) => b && typeof b === 'object' && b.id && b.title));
      } else if (Array.isArray(parsed.data)) {
        books = filterRealBooksOnly(parsed.data.filter((b: any) => b && typeof b === 'object' && b.id && b.title));
      } else if (Array.isArray(parsed.libros)) {
        books = filterRealBooksOnly(parsed.libros.filter((b: any) => b && typeof b === 'object' && b.id && b.title));
      }

      if (Array.isArray(parsed.wishlist)) {
        wishlist = parsed.wishlist;
      }
      if (parsed.annualChallenges && typeof parsed.annualChallenges === 'object') {
        annualChallenges = parsed.annualChallenges;
      } else if (parsed.annualChallengesByYear && typeof parsed.annualChallengesByYear === 'object') {
        annualChallenges = parsed.annualChallengesByYear;
      }
      if (Array.isArray(parsed.challenges)) {
        challenges = parsed.challenges;
      }
      if (parsed.user && typeof parsed.user === 'object') {
        user = parsed.user;
      }
    }

    return { books, wishlist, annualChallenges, challenges, user };
  } catch (err) {
    throw new Error('El archivo no tiene un formato JSON válido.');
  }
}

