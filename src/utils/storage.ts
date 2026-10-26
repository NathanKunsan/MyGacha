import { PackSeries } from '../types';

/**
 * Optimizes/compresses uploaded image files to maintain high visual fidelity
 * while preventing localStorage quota exceeded errors and network congestion.
 */
export const compressImageFile = (
  file: File,
  maxDimension = 1200,
  quality = 0.85
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const rawDataUrl = e.target?.result as string;
      if (!rawDataUrl) {
        resolve('');
        return;
      }

      // If file is SVG or already small (< 150KB), no need to compress
      if (file.type === 'image/svg+xml' || file.size < 150 * 1024) {
        resolve(rawDataUrl);
        return;
      }

      const img = new Image();
      img.onload = () => {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        if (width <= maxDimension && height <= maxDimension && file.size < 300 * 1024) {
          resolve(rawDataUrl);
          return;
        }

        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(rawDataUrl);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Try webp first, fallback to jpeg
        try {
          const webpData = canvas.toDataURL('image/webp', quality);
          if (webpData.startsWith('data:image/webp')) {
            resolve(webpData);
            return;
          }
        } catch {}

        resolve(canvas.toDataURL('image/jpeg', quality));
      };

      img.onerror = () => resolve(rawDataUrl);
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  });
};

/**
 * IndexedDB storage engine for packs to provide virtually unlimited local persistence
 * without hitting browser 5MB localStorage quotas.
 */
const DB_NAME = 'MyGachaDatabase_v2';
const DB_VERSION = 1;
const STORE_PACKS = 'saved_packs';

function openIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB not supported'));
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_PACKS)) {
        db.createObjectStore(STORE_PACKS, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function idbSavePack(pack: PackSeries): Promise<void> {
  try {
    const db = await openIndexedDB();
    const tx = db.transaction(STORE_PACKS, 'readwrite');
    tx.objectStore(STORE_PACKS).put(pack);
    await new Promise<void>((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  } catch (err) {
    console.warn('IndexedDB savePack skipped:', err);
  }
}

export async function idbGetPack(id: string): Promise<PackSeries | null> {
  try {
    const db = await openIndexedDB();
    const tx = db.transaction(STORE_PACKS, 'readonly');
    const store = tx.objectStore(STORE_PACKS);
    const req = store.get(id);
    return await new Promise<PackSeries | null>((res, rej) => {
      req.onsuccess = () => res((req.result as PackSeries) || null);
      req.onerror = () => rej(req.error);
    });
  } catch {
    return null;
  }
}

export async function idbSaveActiveDraft(pack: PackSeries): Promise<void> {
  return idbSavePack({ ...pack, id: '__creator_draft__' });
}

export async function idbGetActiveDraft(): Promise<PackSeries | null> {
  return idbGetPack('__creator_draft__');
}

export async function idbGetAllPacks(): Promise<PackSeries[]> {
  try {
    const db = await openIndexedDB();
    const tx = db.transaction(STORE_PACKS, 'readonly');
    const store = tx.objectStore(STORE_PACKS);
    const req = store.getAll();
    return await new Promise<PackSeries[]>((res, rej) => {
      req.onsuccess = () => {
        const list = (req.result as PackSeries[]) || [];
        // Exclude internal draft placeholder from all-packs list
        res(list.filter(p => p.id !== '__creator_draft__'));
      };
      req.onerror = () => rej(req.error);
    });
  } catch {
    return [];
  }
}

export async function idbDeletePack(id: string): Promise<void> {
  try {
    const db = await openIndexedDB();
    const tx = db.transaction(STORE_PACKS, 'readwrite');
    tx.objectStore(STORE_PACKS).delete(id);
    await new Promise<void>((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  } catch (err) {
    console.warn('IndexedDB deletePack skipped:', err);
  }
}

export async function idbClearAllPacks(): Promise<void> {
  try {
    const db = await openIndexedDB();
    const tx = db.transaction(STORE_PACKS, 'readwrite');
    tx.objectStore(STORE_PACKS).clear();
    await new Promise<void>((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  } catch (err) {
    console.warn('IndexedDB clearAll skipped:', err);
  }
}

