// ── 8D Audio Library & Pack Export/Import Engine ──────────────────────────────
import { AudioFileItem, AudioProcessingOptions } from "@/types";

const DB_NAME = "8dAudioStudioDB";
const DB_VERSION = 1;
const STORE_NAME = "savedTracks";
const PACK_MAGIC = "8DPACK01"; // 8-byte magic identifier

export interface SavedTrackRecord {
  id: string;
  name: string;
  artist?: string;
  thumbnail?: string;
  size: number;
  blob: Blob;
  savedAt: number;
  options?: AudioProcessingOptions;
  sourceType?: "upload" | "youtube" | "demo";
  sourceUrl?: string;
}

// ── IndexedDB Helpers ─────────────────────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      return reject(new Error("IndexedDB is not supported in this environment."));
    }

    const req = window.indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("Failed to open IndexedDB"));
  });
}

export async function saveTrackToStorage(
  item: AudioFileItem,
  audioBlob: Blob
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    const record: SavedTrackRecord = {
      id: item.id,
      name: item.name,
      artist: item.artist,
      thumbnail: item.thumbnail,
      size: audioBlob.size,
      blob: audioBlob,
      savedAt: Date.now(),
      sourceType: item.sourceType,
      sourceUrl: item.sourceUrl,
    };

    const req = store.put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

export async function getSavedTracks(): Promise<SavedTrackRecord[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();

    req.onsuccess = () => {
      resolve(req.result || []);
    };
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

export async function deleteSavedTrack(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

export async function clearAllSavedTracks(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.clear();

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

export interface StorageQuotaInfo {
  usageMB: number;
  quotaMB: number;
  percentage: number;
}

export async function getStorageQuota(): Promise<StorageQuotaInfo | null> {
  if (
    typeof navigator === "undefined" ||
    !navigator.storage ||
    !navigator.storage.estimate
  ) {
    return null;
  }
  try {
    const estimate = await navigator.storage.estimate();
    const usage = estimate.usage || 0;
    const quota = estimate.quota || 0;
    const usageMB = Math.round((usage / (1024 * 1024)) * 10) / 10;
    const quotaMB = Math.round((quota / (1024 * 1024)) * 10) / 10;
    const percentage =
      quota > 0 ? Math.min(100, Math.round((usage / quota) * 1000) / 10) : 0;
    return { usageMB, quotaMB, percentage };
  } catch {
    return null;
  }
}

// ── .8dpack Container Export & Import ─────────────────────────────────────────
// Container format:
// [8 bytes ASCII]: "8DPACK01"
// [4 bytes uint32]: length of JSON manifest
// [N bytes UTF-8]: JSON manifest describing each track and its byteLength
// [Payload]: Concatenated WAV bytes for each track

interface PackManifestItem {
  id: string;
  name: string;
  artist?: string;
  thumbnail?: string;
  byteLength: number;
  options?: AudioProcessingOptions;
  sourceType?: "upload" | "youtube" | "demo";
  sourceUrl?: string;
}

export async function exportTracksToPackFile(
  tracks: { item: AudioFileItem; blob: Blob }[]
): Promise<Blob> {
  if (tracks.length === 0) {
    throw new Error("No converted tracks selected for export.");
  }

  // 1. Prepare manifest
  const manifest: PackManifestItem[] = tracks.map(({ item, blob }) => ({
    id: item.id,
    name: item.name,
    artist: item.artist,
    thumbnail: item.thumbnail,
    byteLength: blob.size,
    sourceType: item.sourceType,
    sourceUrl: item.sourceUrl,
  }));

  const manifestJson = JSON.stringify(manifest);
  const encoder = new TextEncoder();
  const manifestBytes = encoder.encode(manifestJson);

  // 2. Prepare header
  const magicBytes = encoder.encode(PACK_MAGIC); // 8 bytes
  const headerBuffer = new ArrayBuffer(12);
  const headerView = new DataView(headerBuffer);

  // Copy 8-byte magic
  new Uint8Array(headerBuffer, 0, 8).set(magicBytes);
  // Write 4-byte manifest length (uint32 LittleEndian)
  headerView.setUint32(8, manifestBytes.byteLength, true);

  // 3. Assemble full blob parts
  const audioBlobs = tracks.map((t) => t.blob);
  const fullBlobParts = [
    headerBuffer,
    manifestBytes,
    ...audioBlobs,
  ];

  return new Blob(fullBlobParts as unknown as BlobPart[], { type: "application/octet-stream" });
}

export async function importTracksFromPackFile(
  file: File
): Promise<{ item: AudioFileItem; blob: Blob }[]> {
  const arrayBuffer = await file.arrayBuffer();
  if (arrayBuffer.byteLength < 12) {
    throw new Error("Invalid .8dpack file (file is too small).");
  }

  const decoder = new TextDecoder("utf-8");
  const magic = decoder.decode(new Uint8Array(arrayBuffer, 0, 8));
  if (magic !== PACK_MAGIC) {
    throw new Error("Not a valid 8D Audio Package file (.8dpack).");
  }

  const headerView = new DataView(arrayBuffer);
  const manifestLength = headerView.getUint32(8, true);

  if (12 + manifestLength > arrayBuffer.byteLength) {
    throw new Error("Corrupted .8dpack file manifest.");
  }

  const manifestBytes = new Uint8Array(arrayBuffer, 12, manifestLength);
  const manifestJson = decoder.decode(manifestBytes);
  let manifest: PackManifestItem[];

  try {
    manifest = JSON.parse(manifestJson);
  } catch {
    throw new Error("Failed to parse .8dpack manifest.");
  }

  let currentOffset = 12 + manifestLength;
  const importedTracks: { item: AudioFileItem; blob: Blob }[] = [];

  for (const entry of manifest) {
    if (currentOffset + entry.byteLength > arrayBuffer.byteLength) {
      throw new Error(`Corrupted track payload for "${entry.name}".`);
    }

    const audioSlice = arrayBuffer.slice(
      currentOffset,
      currentOffset + entry.byteLength
    );
    const audioBlob = new Blob([audioSlice], { type: "audio/wav" });
    currentOffset += entry.byteLength;

    const item: AudioFileItem = {
      id: `imported-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: entry.name,
      artist: entry.artist || "8D Audio Master",
      thumbnail: entry.thumbnail,
      size: audioBlob.size,
      originalUrl: "",
      convertedUrl: "", // will be assigned ObjectURL when registered
      status: "complete",
      progress: 100,
      sourceType: entry.sourceType || "upload",
      sourceUrl: entry.sourceUrl,
      addedAt: Date.now(),
    };

    importedTracks.push({ item, blob: audioBlob });
  }

  return importedTracks;
}

// ── Persistent Active Queue Manifest ───────────────────────────────────────────
// Allows in-flight and pending queues (like imported 30+ track YouTube playlists)
// to survive page reloads and automatically resume processing without losing the queue.

const QUEUE_STORAGE_KEY = "8d_active_queue_manifest";

export interface PersistedQueueItem {
  id: string;
  name: string;
  artist?: string;
  thumbnail?: string;
  size?: number;
  status: "pending" | "converting" | "complete" | "error";
  progress?: number;
  stage?: string;
  sourceType: "upload" | "youtube" | "demo";
  sourceUrl?: string;
  addedAt?: number;
  retryCount?: number;
}

export function saveQueueManifest(items: AudioFileItem[]): void {
  if (typeof window === "undefined") return;
  try {
    const serialized: PersistedQueueItem[] = items.map((f) => ({
      id: f.id,
      name: f.name,
      artist: f.artist,
      thumbnail: f.thumbnail,
      size: f.size,
      // If refreshed mid-conversion, reset to pending so it resumes cleanly
      status: f.status === "converting" ? "pending" : f.status,
      progress: f.status === "complete" ? 100 : 0,
      stage: f.stage,
      sourceType: f.sourceType,
      sourceUrl: f.sourceUrl,
      addedAt: f.addedAt,
      retryCount: f.retryCount,
    }));
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(serialized));
  } catch (e) {
    console.warn("Could not save queue manifest to localStorage:", e);
  }
}

export function getQueueManifest(): PersistedQueueItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function clearQueueManifest(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(QUEUE_STORAGE_KEY);
  } catch {}
}

