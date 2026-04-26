import { enableIndexedDbPersistence } from 'firebase/firestore';
import { db } from './firebase';

let isOffline = false;
const listeners: Set<(offline: boolean) => void> = new Set();

export function initOfflineSupport(): void {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('Offline persistence failed: multiple tabs open');
    } else if (err.code === 'unimplemented') {
      console.warn('Offline persistence not supported by browser');
    }
  });

  window.addEventListener('online', () => setOffline(false));
  window.addEventListener('offline', () => setOffline(true));
  setOffline(!navigator.onLine);
}

function setOffline(offline: boolean) {
  isOffline = offline;
  listeners.forEach((cb) => cb(offline));
}

export function getIsOffline(): boolean {
  return isOffline;
}

export function subscribeToOfflineChanges(callback: (offline: boolean) => void): () => void {
  listeners.add(callback);
  callback(isOffline);
  return () => listeners.delete(callback);
}
