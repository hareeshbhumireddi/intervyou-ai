const DATABASE_NAME = 'intervyou-files';
const STORE_NAME = 'resumes';
const RESUME_KEY = 'current-resume';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);

    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open resume storage.'));
  });
}

export async function saveResumeFile(file: File): Promise<void> {
  const database = await openDatabase();

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(file, RESUME_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('Could not save the resume.'));
    transaction.onabort = () => reject(transaction.error || new Error('Resume saving was cancelled.'));
  }).finally(() => database.close());
}

export async function loadResumeFile(): Promise<File | null> {
  const database = await openDatabase();

  return new Promise<File | null>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).get(RESUME_KEY);
    let file: File | null = null;

    request.onsuccess = () => {
      file = (request.result as File | undefined) || null;
    };
    transaction.oncomplete = () => {
      database.close();
      resolve(file);
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || new Error('Could not read the saved resume.'));
    };
  });
}

export async function deleteResumeFile(): Promise<void> {
  const database = await openDatabase();

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).delete(RESUME_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('Could not delete the resume.'));
    transaction.onabort = () => reject(transaction.error || new Error('Resume deletion was cancelled.'));
  }).finally(() => database.close());
}