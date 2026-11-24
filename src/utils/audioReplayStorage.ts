export interface StoredAudioReplay {
  key: string;
  interviewId: string;
  questionId: string;
  blob: Blob;
  mimeType: string;
  durationSec: number;
  chunkCount: number;
  recordedAt: string;
}

const DB_NAME = 'intervyou_audio_replays';
const DB_VERSION = 1;
const STORE_NAME = 'replays';

function makeReplayKey(interviewId: string, questionId: string): string {
  return `${interviewId}::${questionId}`;
}

function openReplayDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      reject(new Error('IndexedDB is unavailable in this browser.'));
      return;
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        store.createIndex('by_interview', 'interviewId', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open audio replay store.'));
  });
}

export async function saveLocalAudioReplay(params: {
  interviewId: string;
  questionId: string;
  blob: Blob;
  mimeType: string;
  durationSec: number;
  chunkCount: number;
}): Promise<void> {
  try {
    const db = await openReplayDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const record: StoredAudioReplay = {
        key: makeReplayKey(params.interviewId, params.questionId),
        interviewId: params.interviewId,
        questionId: params.questionId,
        blob: params.blob,
        mimeType: params.mimeType || params.blob.type || 'audio/webm',
        durationSec: Math.max(1, Math.round(params.durationSec)),
        chunkCount: params.chunkCount,
        recordedAt: new Date().toISOString(),
      };
      store.put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Failed to store audio replay.'));
    });
    db.close();
  } catch (err) {
    console.warn('Could not persist audio replay locally:', err);
  }
}

export async function getLocalAudioReplay(
  interviewId: string,
  questionId: string
): Promise<StoredAudioReplay | null> {
  try {
    const db = await openReplayDb();
    const record = await new Promise<StoredAudioReplay | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(makeReplayKey(interviewId, questionId));
      req.onsuccess = () => resolve((req.result as StoredAudioReplay | undefined) || null);
      req.onerror = () => reject(req.error || new Error('Failed to read audio replay.'));
    });
    db.close();
    return record;
  } catch {
    return null;
  }
}

export async function listLocalAudioReplaysForInterview(
  interviewId: string
): Promise<Record<string, StoredAudioReplay>> {
  try {
    const db = await openReplayDb();
    const items = await new Promise<StoredAudioReplay[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('by_interview');
      const req = index.getAll(interviewId);
      req.onsuccess = () => resolve((req.result as StoredAudioReplay[]) || []);
      req.onerror = () => reject(req.error || new Error('Failed to list audio replays.'));
    });
    db.close();
    const byQuestion: Record<string, StoredAudioReplay> = {};
    for (const item of items) {
      byQuestion[item.questionId] = item;
    }
    return byQuestion;
  } catch {
    return {};
  }
}
