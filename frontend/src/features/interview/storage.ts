export interface AnswerDraft {
  key: string;
  sessionId: string;
  seq: number;
  answer: string;
  code: string;
  language: string;
  clientTurnId: string;
}
export interface RecordingChunk {
  key: string;
  sessionId: string;
  segmentId: string;
  seq: number;
  mimeType: string;
  blob: Blob;
}
function openStore(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('careerai-interviews', 2);
    request.onupgradeneeded = () => {
      for (const name of ['drafts', 'chunks']) {
        const store = request.result.objectStoreNames.contains(name)
          ? request.transaction!.objectStore(name)
          : request.result.createObjectStore(name, { keyPath: 'key' });
        if (!store.indexNames.contains('sessionId')) store.createIndex('sessionId', 'sessionId');
      }
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Close other interview tabs to enable local recovery.'));
  });
}
async function transact<T>(store: 'drafts' | 'chunks', mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openStore();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(store, mode);
    const request = run(transaction.objectStore(store));
    // Resolve on commit, not request success: a quota failure can still abort the transaction.
    transaction.oncomplete = () => { db.close(); resolve(request.result); };
    transaction.onabort = () => { db.close(); reject(transaction.error || new Error('Local storage failed.')); };
    transaction.onerror = () => { db.close(); reject(transaction.error || new Error('Local storage failed.')); };
  });
}
export const saveDraft = (draft: AnswerDraft) => transact('drafts', 'readwrite', s => s.put(draft));
export const readDraft = (key: string): Promise<AnswerDraft | undefined> => transact('drafts', 'readonly', s => s.get(key));
export const deleteDraft = (key: string) => transact('drafts', 'readwrite', s => s.delete(key));
export const saveChunk = (chunk: RecordingChunk) => transact('chunks', 'readwrite', s => s.put(chunk));
export const readChunks = (sessionId: string): Promise<RecordingChunk[]> => transact('chunks', 'readonly', s => s.index('sessionId').getAll(sessionId));
export const deleteChunk = (key: string) => transact('chunks', 'readwrite', s => s.delete(key));

export async function deleteLocalSession(sessionId: string): Promise<void> {
  const db = await openStore();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['drafts', 'chunks'], 'readwrite');
    for (const name of ['drafts', 'chunks']) {
      const store = transaction.objectStore(name);
      const request = store.index('sessionId').openKeyCursor(IDBKeyRange.only(sessionId));
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        store.delete(cursor.primaryKey);
        cursor.continue();
      };
    }
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onabort = () => { db.close(); reject(transaction.error || new Error('Local cleanup failed.')); };
    transaction.onerror = () => { db.close(); reject(transaction.error || new Error('Local cleanup failed.')); };
  });
}
