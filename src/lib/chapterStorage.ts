/**
 * IndexedDB storage helper for book chapters and structure.
 * Guarantees chapters are never lost across sessions, quota limits, or cloud sync delays.
 */

import { Chapter } from '../types';

const DB_NAME = 'registro_lectura_chapters_db';
const STORE_NAME = 'book_chapters';
const DB_VERSION = 1;

export interface StoredChaptersData {
  bookId: string;
  chapters: Chapter[];
  hasParts?: boolean;
  parts?: string[];
  updatedAt: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.reject(new Error('IndexedDB not supported'));
  }

  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'bookId' });
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const currentVersion = db.version || 1;
          db.close();
          const upgradeReq = window.indexedDB.open(DB_NAME, currentVersion + 1);
          upgradeReq.onupgradeneeded = () => {
            const upDb = upgradeReq.result;
            if (!upDb.objectStoreNames.contains(STORE_NAME)) {
              upDb.createObjectStore(STORE_NAME, { keyPath: 'bookId' });
            }
          };
          upgradeReq.onsuccess = () => resolve(upgradeReq.result);
          upgradeReq.onerror = () => reject(upgradeReq.error);
          return;
        }
        resolve(db);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  return dbPromise;
}

export const chapterStorage = {
  async saveChapters(
    bookId: string,
    chapters: Chapter[],
    hasParts?: boolean,
    parts?: string[]
  ): Promise<boolean> {
    if (!bookId) return false;
    try {
      const db = await getDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const data: StoredChaptersData = {
          bookId,
          chapters: Array.isArray(chapters) ? chapters : [],
          hasParts: !!hasParts,
          parts: Array.isArray(parts) ? parts : [],
          updatedAt: new Date().toISOString(),
        };
        store.put(data);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
    } catch {
      return false;
    }
  },

  async getChapters(bookId: string): Promise<StoredChaptersData | null> {
    if (!bookId) return null;
    try {
      const db = await getDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(bookId);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  },

  async getAllChapters(): Promise<Record<string, StoredChaptersData>> {
    try {
      const db = await getDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.getAll();
        request.onsuccess = () => {
          const result: Record<string, StoredChaptersData> = {};
          if (Array.isArray(request.result)) {
            request.result.forEach((item: StoredChaptersData) => {
              if (item && item.bookId) {
                result[item.bookId] = item;
              }
            });
          }
          resolve(result);
        };
        request.onerror = () => resolve({});
      });
    } catch {
      return {};
    }
  },

  async deleteChapters(bookId: string): Promise<boolean> {
    if (!bookId) return false;
    try {
      const db = await getDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.delete(bookId);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
    } catch {
      return false;
    }
  },
};
