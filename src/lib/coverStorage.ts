/**
 * IndexedDB storage helper for high-resolution book covers.
 * Bypasses localStorage 5MB limits and guarantees cover preservation across sessions.
 */

const DB_NAME = 'registro_lectura_covers_db';
const STORE_NAME = 'book_covers';
const DB_VERSION = 1;

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
          db.createObjectStore(STORE_NAME);
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
              upDb.createObjectStore(STORE_NAME);
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

export const coverStorage = {
  async saveCover(bookId: string, coverData: string): Promise<boolean> {
    if (!bookId || !coverData) return false;
    try {
      const db = await getDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put(coverData, bookId);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
    } catch {
      return false;
    }
  },

  async getCover(bookId: string): Promise<string | null> {
    if (!bookId) return null;
    try {
      const db = await getDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(bookId);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  },

  async deleteCover(bookId: string): Promise<boolean> {
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

  async getAllCovers(): Promise<Record<string, string>> {
    try {
      const db = await getDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const map: Record<string, string> = {};
        const req = store.openCursor();
        req.onsuccess = (event: any) => {
          const cursor = event.target.result;
          if (cursor) {
            if (cursor.key && cursor.value) {
              map[String(cursor.key)] = cursor.value;
            }
            cursor.continue();
          } else {
            resolve(map);
          }
        };
        req.onerror = () => resolve(map);
      });
    } catch {
      return {};
    }
  },
};
