/**
 * Dedicated IndexedDB persistent engine for Books.
 * Guarantees all user books (whether 30, 311, or thousands) are durably preserved
 * across browser sessions, completely bypassing localStorage 5MB quota restrictions.
 */

import { Book } from '../types';

const DB_NAME = 'registro_lectura_books_master_db';
const DB_VERSION = 1;
const STORE_NAME = 'books_store';

function openBooksDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported in this environment'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        // Database exists but store is missing (e.g. created at empty version) - bump version to create store
        const currentVersion = db.version || 1;
        db.close();
        const upgradeReq = window.indexedDB.open(DB_NAME, currentVersion + 1);
        upgradeReq.onupgradeneeded = (e: IDBVersionChangeEvent) => {
          const upDb = (e.target as IDBOpenDBRequest).result;
          if (!upDb.objectStoreNames.contains(STORE_NAME)) {
            upDb.createObjectStore(STORE_NAME, { keyPath: 'id' });
          }
        };
        upgradeReq.onsuccess = () => resolve(upgradeReq.result);
        upgradeReq.onerror = () => reject(upgradeReq.error || new Error('Failed to upgrade books database'));
        return;
      }
      resolve(db);
    };
    request.onerror = () => reject(request.error || new Error('Failed to open books database'));
  });
}

export const bookStorage = {
  /**
   * Retrieve all books stored in IndexedDB
   */
  async getAllBooks(): Promise<Book[]> {
    try {
      const db = await openBooksDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();

        req.onsuccess = () => {
          const list = req.result;
          if (Array.isArray(list)) {
            resolve(list);
          } else {
            resolve([]);
          }
        };

        req.onerror = () => {
          console.warn('[bookStorage] Error reading all books:', req.error);
          resolve([]);
        };
      });
    } catch {
      return [];
    }
  },

  /**
   * Save a single book to IndexedDB
   */
  async saveBook(book: Book): Promise<void> {
    if (!book || !book.id) return;
    try {
      const db = await openBooksDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(book);

        req.onsuccess = () => resolve();
        req.onerror = () => {
          console.warn(`[bookStorage] Error saving book ${book.id}:`, req.error);
          reject(req.error);
        };
      });
    } catch (err) {
      console.warn(`[bookStorage] Failed to save book ${book.id}:`, err);
    }
  },

  /**
   * Save multiple books in a single transaction to IndexedDB
   */
  async saveBooksBatch(books: Book[]): Promise<void> {
    if (!books || books.length === 0) return;
    try {
      const db = await openBooksDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);

        for (const book of books) {
          if (book && book.id) {
            store.put(book);
          }
        }

        tx.oncomplete = () => resolve();
        tx.onerror = () => {
          console.warn('[bookStorage] Error in saveBooksBatch transaction:', tx.error);
          reject(tx.error);
        };
      });
    } catch (err) {
      console.warn('[bookStorage] Failed to batch save books:', err);
    }
  },

  /**
   * Delete a book by ID from IndexedDB
   */
  async deleteBook(bookId: string): Promise<void> {
    if (!bookId) return;
    try {
      const db = await openBooksDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(bookId);

        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn(`[bookStorage] Failed to delete book ${bookId}:`, err);
    }
  },

  /**
   * Clear all books from IndexedDB
   */
  async clearAll(): Promise<void> {
    try {
      const db = await openBooksDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.clear();

        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('[bookStorage] Failed to clear books store:', err);
    }
  },
};
