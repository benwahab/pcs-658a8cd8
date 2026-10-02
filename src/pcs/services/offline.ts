const DB_NAME = "pcs-offline-v1";
const DB_VERSION = 2;
const STORE_VERIFICATIONS = "field-verifications";
const STORE_RESOLUTIONS = "resolution-videos";

type PendingVerification = {
  id: string;
  reportId: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  createdAt: string;
};

type PendingResolution = {
  id: string;
  reportId: string;
  video: Blob;
  fileName: string;
  fileType: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  createdAt: string;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_VERIFICATIONS)) {
        db.createObjectStore(STORE_VERIFICATIONS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_RESOLUTIONS)) {
        db.createObjectStore(STORE_RESOLUTIONS, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function closeDb(db: IDBDatabase) {
  db.close();
}

export async function queueFieldVerification(item: Omit<PendingVerification, "id" | "createdAt">) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_VERIFICATIONS, "readwrite");
    tx.objectStore(STORE_VERIFICATIONS).put({
      ...item,
      id: String(Date.now()) + "-" + crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  closeDb(db);
}

export async function flushFieldVerifications(send: (item: PendingVerification) => Promise<void>) {
  if (!navigator.onLine) return 0;
  const db = await openDb();
  const items = await new Promise<PendingVerification[]>((resolve, reject) => {
    const req = db
      .transaction(STORE_VERIFICATIONS, "readonly")
      .objectStore(STORE_VERIFICATIONS)
      .getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  let sent = 0;
  for (const item of items) {
    try {
      await send(item);
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_VERIFICATIONS, "readwrite");
        tx.objectStore(STORE_VERIFICATIONS).delete(item.id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
      sent++;
    } catch {}
  }
  closeDb(db);
  return sent;
}

export async function pendingFieldVerificationCount() {
  const db = await openDb();
  const count = await new Promise<number>((resolve, reject) => {
    const req = db
      .transaction(STORE_VERIFICATIONS, "readonly")
      .objectStore(STORE_VERIFICATIONS)
      .count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  closeDb(db);
  return count;
}

const MISSIONS_KEY = "pcs_offline_agent_missions_v1";

export function cacheAgentMissions(missions: unknown[]) {
  try {
    localStorage.setItem(MISSIONS_KEY, JSON.stringify(missions));
  } catch {}
}

export function getCachedAgentMissions<T = any>(): T[] {
  try {
    return JSON.parse(localStorage.getItem(MISSIONS_KEY) || "[]") as T[];
  } catch {
    return [];
  }
}

export async function queueResolutionVideo(item: Omit<PendingResolution, "id" | "createdAt">) {
  if (item.video.size > 50 * 1024 * 1024) {
    throw new Error("Vidéo trop volumineuse. Maximum : 50 Mo.");
  }
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_RESOLUTIONS, "readwrite");
    tx.objectStore(STORE_RESOLUTIONS).put({
      ...item,
      id: String(Date.now()) + "-" + crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  closeDb(db);
}

export async function flushResolutionVideos(send: (item: PendingResolution) => Promise<void>) {
  if (!navigator.onLine) return 0;
  const db = await openDb();
  const items = await new Promise<PendingResolution[]>((resolve, reject) => {
    const req = db
      .transaction(STORE_RESOLUTIONS, "readonly")
      .objectStore(STORE_RESOLUTIONS)
      .getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  let sent = 0;
  for (const item of items) {
    try {
      await send(item);
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_RESOLUTIONS, "readwrite");
        tx.objectStore(STORE_RESOLUTIONS).delete(item.id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
      sent++;
    } catch {}
  }
  closeDb(db);
  return sent;
}

export async function pendingResolutionVideoCount() {
  const db = await openDb();
  const count = await new Promise<number>((resolve, reject) => {
    const req = db
      .transaction(STORE_RESOLUTIONS, "readonly")
      .objectStore(STORE_RESOLUTIONS)
      .count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  closeDb(db);
  return count;
}
