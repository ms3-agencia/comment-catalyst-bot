// Persists the last successful video render in IndexedDB so the user
// can re-download / copy link even after a page refresh.

const DB_NAME = 'video-editor';
const STORE = 'last-render';
const KEY = 'current';

export type StoredRender = {
  contentId: string;
  fileName: string;
  ext: string;
  sizeBytes: number;
  mime: string;
  createdAt: number;
  blob: Blob;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveLastRender(data: Omit<StoredRender, 'createdAt'>): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({ ...data, createdAt: Date.now() }, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (e) {
    console.warn('[lastRenderStore] save failed', e);
  }
}

export async function loadLastRender(): Promise<StoredRender | null> {
  try {
    const db = await openDb();
    const result = await new Promise<StoredRender | null>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve((req.result as StoredRender) ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return result;
  } catch (e) {
    console.warn('[lastRenderStore] load failed', e);
    return null;
  }
}

export async function clearLastRender(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // ignore
  }
}
