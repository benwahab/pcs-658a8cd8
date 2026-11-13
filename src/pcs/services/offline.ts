const DB_NAME = "pcs-offline-v1";
const DB_VERSION = 2;
const STORE_VERIFICATIONS = "field-verifications";
const STORE_RESOLUTIONS = "resolution-videos";
const MAX_RESOLUTION_VIDEO_SIZE_BYTES = 100 * 1024 * 1024;

type PendingVerification = {
  id: string;
  agentId: string;
  reportId: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  createdAt: string;
};

type PendingResolution = {
  id: string;
  agentId: string;
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
      if (!db.objectStoreNames.contains(STORE_VERIFICATIONS))
        db.createObjectStore(STORE_VERIFICATIONS, { keyPath: "id" });
      if (!db.objectStoreNames.contains(STORE_RESOLUTIONS))
        db.createObjectStore(STORE_RESOLUTIONS, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function closeDb(db: IDBDatabase) {
  db.close();
}

type FlushResult = { sent: number; failed: number };

export async function queueFieldVerification(item: Omit<PendingVerification, "id" | "createdAt">) {
  const db = await openDb();
  try {
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
  } finally {
    closeDb(db);
  }
}

export async function flushFieldVerifications(
  agentId: string,
  send: (item: PendingVerification) => Promise<void>,
): Promise<FlushResult> {
  if (!navigator.onLine) return { sent: 0, failed: 0 };
  const db = await openDb();
  let sent = 0,
    failed = 0;
  try {
    const items = await new Promise<PendingVerification[]>((resolve, reject) => {
      const req = db
        .transaction(STORE_VERIFICATIONS, "readonly")
        .objectStore(STORE_VERIFICATIONS)
        .getAll();
      req.onsuccess = () =>
        resolve(req.result.filter((item: PendingVerification) => item.agentId === agentId));
      req.onerror = () => reject(req.error);
    });
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
      } catch {
        failed++;
      }
    }
    return { sent, failed };
  } finally {
    closeDb(db);
  }
}

export async function pendingFieldVerificationCount(agentId: string) {
  const db = await openDb();
  try {
    return await new Promise<number>((resolve, reject) => {
      const req = db
        .transaction(STORE_VERIFICATIONS, "readonly")
        .objectStore(STORE_VERIFICATIONS)
        .getAll();
      req.onsuccess = () =>
        resolve(req.result.filter((item: PendingVerification) => item.agentId === agentId).length);
      req.onerror = () => reject(req.error);
    });
  } finally {
    closeDb(db);
  }
}

const MISSIONS_PREFIX = "pcs_offline_agent_missions_v2_";

export function cacheAgentMissions(agentId: string, missions: unknown[]) {
  try {
    localStorage.setItem(MISSIONS_PREFIX + agentId, JSON.stringify(missions));
  } catch {}
}

export function clearCachedAgentMissions(agentId: string) {
  try {
    localStorage.removeItem(MISSIONS_PREFIX + agentId);
  } catch {}
}

export function getCachedAgentMissions<T = any>(agentId: string): T[] {
  try {
    return JSON.parse(localStorage.getItem(MISSIONS_PREFIX + agentId) || "[]") as T[];
  } catch {
    return [];
  }
}

export async function queueResolutionVideo(item: Omit<PendingResolution, "id" | "createdAt">) {
  if (item.video.size <= 0) throw new Error("La vidéo est vide.");
  if (item.video.size > MAX_RESOLUTION_VIDEO_SIZE_BYTES)
    throw new Error("La vidéo ne doit pas dépasser 100 Mo.");
  const db = await openDb();
  try {
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
  } finally {
    closeDb(db);
  }
}

export async function flushResolutionVideos(
  agentId: string,
  send: (item: PendingResolution) => Promise<void>,
): Promise<FlushResult> {
  if (!navigator.onLine) return { sent: 0, failed: 0 };
  const db = await openDb();
  let sent = 0,
    failed = 0;
  try {
    const items = await new Promise<PendingResolution[]>((resolve, reject) => {
      const req = db
        .transaction(STORE_RESOLUTIONS, "readonly")
        .objectStore(STORE_RESOLUTIONS)
        .getAll();
      req.onsuccess = () =>
        resolve(req.result.filter((item: PendingResolution) => item.agentId === agentId));
      req.onerror = () => reject(req.error);
    });
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
      } catch {
        failed++;
      }
    }
    return { sent, failed };
  } finally {
    closeDb(db);
  }
}

export async function pendingResolutionVideoCount(agentId: string) {
  const db = await openDb();
  try {
    return await new Promise<number>((resolve, reject) => {
      const req = db
        .transaction(STORE_RESOLUTIONS, "readonly")
        .objectStore(STORE_RESOLUTIONS)
        .getAll();
      req.onsuccess = () =>
        resolve(req.result.filter((item: PendingResolution) => item.agentId === agentId).length);
      req.onerror = () => reject(req.error);
    });
  } finally {
    closeDb(db);
  }
}
