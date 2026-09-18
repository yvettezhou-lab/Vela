const DB_NAME = 'vela-media';
const STORE_NAME = 'trip-covers';
const DB_VERSION = 1;
const KEY_PREFIX = 'idb:';

const openDb = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return reject(new Error('IndexedDB is unavailable in this browser.'));
  const request = indexedDB.open(DB_NAME, DB_VERSION);
  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error ?? new Error('Unable to open IndexedDB.'));
});

const normalizeKey = (key: string): string => key.startsWith(KEY_PREFIX) ? key.slice(KEY_PREFIX.length) : key;

export const isIndexedDbCoverKey = (value?: string): boolean => Boolean(value?.startsWith(KEY_PREFIX));

export const putTripCover = async (file: Blob): Promise<string> => {
  const id = crypto.randomUUID();
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(file, id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Unable to store trip cover.'));
      tx.onabort = () => reject(tx.error ?? new Error('Unable to store trip cover.'));
    });
    return KEY_PREFIX + id;
  } finally { db.close(); }
};

export const getTripCover = async (coverKey: string): Promise<Blob | null> => {
  if (!isIndexedDbCoverKey(coverKey)) return null;
  const db = await openDb();
  try {
    return await new Promise<Blob | null>((resolve, reject) => {
      const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(normalizeKey(coverKey));
      request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : null);
      request.onerror = () => reject(request.error ?? new Error('Unable to read trip cover.'));
    });
  } finally { db.close(); }
};

export const deleteTripCover = async (coverKey?: string): Promise<void> => {
  if (!coverKey || !isIndexedDbCoverKey(coverKey)) return;
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(normalizeKey(coverKey));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Unable to delete trip cover.'));
      tx.onabort = () => reject(tx.error ?? new Error('Unable to delete trip cover.'));
    });
  } finally { db.close(); }
};

export const resolveTripCoverUrl = async (coverImage?: string): Promise<string | null> => {
  if (!coverImage?.trim() || !isIndexedDbCoverKey(coverImage)) return coverImage?.trim() || null;
  const blob = await getTripCover(coverImage);
  return blob ? URL.createObjectURL(blob) : null;
};
