/**
 * IndexedDB storage for document bytes (resume / cover letter).
 *
 * Files are kept here rather than in chrome.storage.local because that area is
 * JSON-serialized and capped near ~5MB. IndexedDB stores Blobs efficiently and
 * has a far larger quota. Only extension pages / the service worker use this —
 * content scripts run in the page's origin and must not read it.
 */
const DB_NAME = 'autovault';
const DB_VERSION = 1;
const STORE = 'documents';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode);
        const request = run(transaction.objectStore(STORE));
        transaction.oncomplete = () => {
          resolve(request.result);
          db.close();
        };
        transaction.onerror = () => {
          reject(transaction.error);
          db.close();
        };
      }),
  );
}

export function putDocumentBlob(key: string, blob: Blob): Promise<void> {
  return tx('readwrite', (s) => s.put(blob, key)).then(() => undefined);
}

export async function getDocumentBlob(key: string): Promise<Blob | undefined> {
  const result = await tx<Blob | undefined>('readonly', (s) => s.get(key));
  return result ?? undefined;
}

export function deleteDocumentBlob(key: string): Promise<void> {
  return tx('readwrite', (s) => s.delete(key)).then(() => undefined);
}

export function clearAllDocuments(): Promise<void> {
  return tx('readwrite', (s) => s.clear()).then(() => undefined);
}

/** Read a stored document back as an object URL for previewing. */
export async function getDocumentObjectUrl(key: string): Promise<string | undefined> {
  const blob = await getDocumentBlob(key);
  return blob ? URL.createObjectURL(blob) : undefined;
}
