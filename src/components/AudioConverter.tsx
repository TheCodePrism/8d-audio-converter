/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Download,
  AlertCircle,
  X,
  Sparkles,
  RefreshCw,
  RotateCw,
  Upload,
  Youtube,
  Music,
  Headphones,
  Sliders,
  ListMusic,
  Plus,
  Play,
  Pause,
  Trash2,
  Disc3,
  Flame,
  CheckCircle2,
  Clock,
  Radio,
  Package,
  FolderDown,
  FolderUp,
  HardDrive,
  Archive,
  Save,
  Zap,
  MoreVertical,
  Copy,
  ExternalLink,
  Check,
} from "lucide-react";
import AudioPlayer from "./AudioPlayer";
import UploadForm from "./UploadForm";
import AudioSettings from "./AudioSettings";
import YouTubeInput from "./YouTubeInput";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AudioProcessingOptions, AudioFileItem, YouTubeTrack } from "@/types";
import {
  DEFAULT_OPTIONS,
  PRESETS,
  process8DAudio,
  float32ToWav,
  audioBufferToMp3,
  generateDemoAudioBuffer,
} from "@/lib/audioProcessing";
import {
  saveTrackToStorage,
  getSavedTracks,
  deleteSavedTrack,
  clearAllSavedTracks,
  exportTracksToPackFile,
  importTracksFromPackFile,
  SavedTrackRecord,
  saveQueueManifest,
  getQueueManifest,
  clearQueueManifest,
  getStorageQuota,
  StorageQuotaInfo,
} from "@/lib/storage";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const SUPPORTED_FORMATS = [
  "audio/mp3",
  "audio/wav",
  "audio/mpeg",
  "audio/ogg",
  "audio/m4a",
  "audio/x-m4a",
  "audio/flac",
];

export function getYouTubeUrl(item?: {
  id: string;
  sourceUrl?: string;
  originalUrl?: string;
  sourceType?: string;
} | null): string | null {
  if (!item) return null;
  if (
    item.sourceUrl &&
    (item.sourceUrl.includes("youtube.com") || item.sourceUrl.includes("youtu.be"))
  ) {
    return item.sourceUrl;
  }
  if (item.sourceType === "youtube" && item.sourceUrl) {
    return item.sourceUrl;
  }
  if (
    item.originalUrl &&
    (item.originalUrl.includes("youtube.com") || item.originalUrl.includes("youtu.be"))
  ) {
    return item.originalUrl;
  }
  if (item.id && item.id.startsWith("yt-")) {
    const parts = item.id.split("-");
    if (parts.length >= 2 && parts[1] && parts[1].length >= 8) {
      return `https://www.youtube.com/watch?v=${parts[1]}`;
    }
  }
  return null;
}

interface ContextMenuState {
  item: AudioFileItem;
  index: number;
  x: number;
  y: number;
}

export default function AudioConverter() {
  const [activeStudioTab, setActiveStudioTab] = useState<"queue" | "add" | "settings">("add");
  const [addMode, setAddMode] = useState<"upload" | "youtube" | "library">("upload");
  const [mobileTab, setMobileTab] = useState<"player" | "studio">("player");

  const [audioFiles, setAudioFiles] = useState<AudioFileItem[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(0);
  const [options, setOptions] = useState<AudioProcessingOptions>(DEFAULT_OPTIONS);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isShuffle, setIsShuffle] = useState<boolean>(false);
  const [isLooping, setIsLooping] = useState<boolean>(false);
  const [activePlaybackTime, setActivePlaybackTime] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  // Context Menu & Quick Toast State
  const [activeMenu, setActiveMenu] = useState<ContextMenuState | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Export / Import & Offline Persistence State
  const [savedLibrary, setSavedLibrary] = useState<SavedTrackRecord[]>([]);
  const [storageQuota, setStorageQuota] = useState<StorageQuotaInfo | null>(null);
  const [isExportingPack, setIsExportingPack] = useState<boolean>(false);
  const [isImportingPack, setIsImportingPack] = useState<boolean>(false);
  const [isWakeLocked, setIsWakeLocked] = useState<boolean>(false);

  const createdUrlsRef = useRef<string[]>([]);
  const wavBlobsRef = useRef<Map<string, Blob>>(new Map());
  const activeConvertingIdsRef = useRef<Set<string>>(new Set());
  const packFileInputRef = useRef<HTMLInputElement>(null);
  const isHydratedRef = useRef<boolean>(false);
  const wakeLockRef = useRef<any>(null);
  const hasNewSuccessRef = useRef<boolean>(false);

  const registerUrl = useCallback((url: string) => {
    createdUrlsRef.current.push(url);
    return url;
  }, []);

  const refreshSavedLibrary = useCallback(async () => {
    try {
      const tracks = await getSavedTracks();
      setSavedLibrary(tracks);
      const quota = await getStorageQuota();
      setStorageQuota(quota);
      return tracks;
    } catch (err) {
      console.warn("Could not retrieve saved library:", err);
      return [];
    }
  }, []);

  const copyToClipboard = useCallback(async (text: string, label: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setToastMessage(`Copied ${label}!`);
      setTimeout(() => {
        setToastMessage((prev) => (prev === `Copied ${label}!` ? null : prev));
      }, 2500);
    } catch (err) {
      console.warn("Clipboard copy failed:", err);
    }
  }, []);

  const handleOpenMenu = useCallback(
    (e: React.MouseEvent, item: AudioFileItem, index: number, isFromButton = false) => {
      e.preventDefault();
      e.stopPropagation();

      if (activeMenu?.item.id === item.id) {
        setActiveMenu(null);
        return;
      }

      const menuWidth = 260;
      const menuHeight = 280;
      let x: number;
      let y: number;

      if (isFromButton) {
        const rect = e.currentTarget.getBoundingClientRect();
        x = Math.max(10, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 10));
        y = Math.min(rect.bottom + 6, window.innerHeight - menuHeight - 10);
      } else {
        x = Math.max(10, Math.min(e.clientX, window.innerWidth - menuWidth - 10));
        y = Math.max(10, Math.min(e.clientY, window.innerHeight - menuHeight - 10));
      }

      setActiveMenu({ item, index, x, y });
    },
    [activeMenu]
  );

  // Auto-dismiss context menu when clicking outside, scrolling, or pressing Escape
  useEffect(() => {
    if (!activeMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveMenu(null);
    };
    const handleScroll = () => {
      setActiveMenu(null);
    };

    window.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      window.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [activeMenu]);

  // Auto-restore full queue (both in-flight/pending YouTube tracks and completed tracks) on mount/refresh
  useEffect(() => {
    let isMounted = true;

    async function restoreSession() {
      try {
        const savedTracks = await getSavedTracks();
        if (!isMounted) return;
        setSavedLibrary(savedTracks);

        const savedMap = new Map<string, SavedTrackRecord>();
        for (const t of savedTracks) {
          savedMap.set(t.id, t);
        }

        const queueManifest = getQueueManifest();

        setAudioFiles((prev) => {
          if (prev.length > 0) return prev; // If already populated in-memory, keep it

          if (queueManifest.length > 0) {
            const restored: AudioFileItem[] = [];
            for (const item of queueManifest) {
              const saved = savedMap.get(item.id);
              if (saved) {
                // Completed track: restore with cached MP3 blob
                const audioUrl = registerUrl(URL.createObjectURL(saved.blob));
                wavBlobsRef.current.set(item.id, saved.blob);
                restored.push({
                  id: item.id,
                  name: item.name,
                  artist: item.artist || "8D Audio Master",
                  thumbnail: item.thumbnail,
                  size: saved.size,
                  originalUrl: audioUrl,
                  convertedUrl: audioUrl,
                  status: "complete",
                  progress: 100,
                  sourceType: item.sourceType,
                  sourceUrl: item.sourceUrl,
                  addedAt: item.addedAt || saved.savedAt,
                });
              } else if (item.sourceType === "youtube" || item.sourceType === "demo") {
                // Pending/incomplete track: restore as pending so background worker resumes it
                restored.push({
                  id: item.id,
                  name: item.name,
                  artist: item.artist || "YouTube Music",
                  thumbnail: item.thumbnail,
                  size: item.size,
                  originalUrl: "",
                  sourceUrl: item.sourceUrl,
                  status: item.status === "error" ? "error" : "pending",
                  progress: 0,
                  sourceType: item.sourceType,
                  addedAt: item.addedAt || Date.now(),
                  retryCount: item.retryCount || 0,
                });
              }
            }
            if (restored.length > 0) {
              isHydratedRef.current = true;
              return restored;
            }
          }

          // Fallback: If no manifest exists, load all completed saved tracks
          if (savedTracks.length > 0) {
            const restored: AudioFileItem[] = savedTracks.map((record) => {
              const audioUrl = registerUrl(URL.createObjectURL(record.blob));
              wavBlobsRef.current.set(record.id, record.blob);
              return {
                id: record.id,
                name: record.name,
                artist: record.artist || "8D Audio Master",
                thumbnail: record.thumbnail,
                size: record.size,
                originalUrl: audioUrl,
                convertedUrl: audioUrl,
                status: "complete",
                progress: 100,
                sourceType: record.sourceType || "upload",
                sourceUrl: record.sourceUrl,
                addedAt: record.savedAt,
              };
            });
            isHydratedRef.current = true;
            return restored;
          }

          isHydratedRef.current = true;
          return [];
        });
      } catch (err) {
        console.warn("Could not auto-restore session queue on mount:", err);
      } finally {
        isHydratedRef.current = true;
      }
    }

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, [registerUrl]);

  // Persist active queue manifest to localStorage whenever the queue updates
  useEffect(() => {
    if (!isHydratedRef.current) return;
    saveQueueManifest(audioFiles);
  }, [audioFiles]);

  // Mobile Screen WakeLock: prevents mobile screens from turning off during batch conversion
  useEffect(() => {
    const isConverting = audioFiles.some((f) => f.status === "converting");

    async function handleWakeLock() {
      if (typeof navigator !== "undefined" && "wakeLock" in navigator) {
        if (isConverting) {
          try {
            if (!wakeLockRef.current) {
              wakeLockRef.current = await (navigator as any).wakeLock.request("screen");
              setIsWakeLocked(true);
            }
          } catch (err) {
            console.warn("Screen wake lock request failed:", err);
          }
        } else if (wakeLockRef.current) {
          try {
            await wakeLockRef.current.release();
          } catch {}
          wakeLockRef.current = null;
          setIsWakeLocked(false);
        }
      }
    }

    handleWakeLock();

    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };
  }, [audioFiles]);

  useEffect(() => {
    const urls = createdUrlsRef.current;
    return () => {
      urls.forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch {}
      });
    };
  }, []);

  const validateFile = (file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) {
      return `File size exceeds the ${MAX_FILE_SIZE / 1024 / 1024}MB limit.`;
    }
    const isSupported =
      SUPPORTED_FORMATS.includes(file.type) ||
      file.name.match(/\.(mp3|wav|ogg|m4a|flac)$/i);
    if (!isSupported) {
      return "Unsupported format. Please upload MP3, WAV, OGG, M4A, or FLAC.";
    }
    return null;
  };

  const updateItemProgress = useCallback(
    (id: string, percent: number, stage?: string) => {
      setAudioFiles((prev) =>
        prev.map((f) =>
          f.id === id
            ? { ...f, progress: percent, ...(stage ? { stage } : {}) }
            : f
        )
      );
    },
    []
  );

  const CONVERSION_TIMEOUT_MS = 55000; // 55 seconds timeout to prevent stalled conversions

  // --- Queue Worker Core Processing ---
  const processQueueItem = useCallback(
    async (item: AudioFileItem) => {
      setAudioFiles((prev) =>
        prev.map((f) =>
          f.id === item.id
            ? {
                ...f,
                status: "converting",
                progress: 10,
                stage: "Initializing conversion...",
                error: undefined,
                errorDetails: undefined,
              }
            : f
        )
      );

      let audioContext: any = null;
      let timeoutTimer: NodeJS.Timeout | null = null;
      const abortController = new AbortController();

      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutTimer = setTimeout(() => {
            abortController.abort();
            reject(
              new Error(
                "Conversion timed out (stalled for >55s). Moved to retry queue."
              )
            );
          }, CONVERSION_TIMEOUT_MS);
        });

        const doConversion = async () => {
          let decodedBuffer: AudioBuffer;
          let originalUrl = item.originalUrl;

          if (item.sourceType === "upload" && item.file) {
            updateItemProgress(item.id, 20, "Reading local audio file...");
            const validationError = validateFile(item.file);
            if (validationError) throw new Error(validationError);

            const arrayBuffer = await item.file.arrayBuffer();
            updateItemProgress(item.id, 45, "Decoding audio waveform (PCM)...");

            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            audioContext = new AudioCtx();
            decodedBuffer = await audioContext.decodeAudioData(arrayBuffer);
          } else if (item.sourceType === "youtube") {
            updateItemProgress(item.id, 20, "Connecting to audio stream...");
            const ytUrl = item.sourceUrl || item.originalUrl;
            if (!ytUrl) throw new Error("Missing YouTube source URL.");

            const streamRes = await fetch(
              `/api/youtube/stream?url=${encodeURIComponent(ytUrl)}`,
              { signal: abortController.signal }
            );

            if (!streamRes.ok) {
              let errMsg = "Failed to download YouTube audio stream.";
              try {
                const text = await streamRes.text();
                try {
                  const parsed = JSON.parse(text);
                  if (parsed.error) errMsg = parsed.error;
                } catch {
                  if (text && text.length < 200) errMsg = text;
                }
              } catch {}
              throw new Error(errMsg);
            }

            updateItemProgress(item.id, 40, "Downloading audio stream chunks...");
            const contentType = streamRes.headers.get("content-type") || "";
            const audioBlob = await streamRes.blob();

            if (
              contentType.includes("text") ||
              contentType.includes("json") ||
              audioBlob.size < 1024
            ) {
              let errMsg = "Received invalid audio response from server.";
              try {
                const text = await audioBlob.text();
                try {
                  const parsed = JSON.parse(text);
                  if (parsed.error) errMsg = parsed.error;
                } catch {
                  if (text && text.length < 300) {
                    const stripped = text.replace(/<[^>]+>/g, "").trim();
                    if (stripped) errMsg = stripped;
                  }
                }
              } catch {}
              throw new Error(errMsg);
            }

            originalUrl = registerUrl(URL.createObjectURL(audioBlob));
            const arrayBuffer = await audioBlob.arrayBuffer();

            updateItemProgress(item.id, 60, "Decoding audio waveform (PCM)...");
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            audioContext = new AudioCtx();
            try {
              decodedBuffer = await audioContext.decodeAudioData(arrayBuffer);
            } catch (decodeErr: any) {
              throw new Error(
                "Unable to decode audio data. The audio stream may be corrupt or encoded in an unsupported format."
              );
            }
          } else if (item.sourceType === "demo") {
            updateItemProgress(item.id, 40, "Synthesizing demo audio...");
            decodedBuffer = generateDemoAudioBuffer(44100, 16);
            const rawWavBlob = float32ToWav(decodedBuffer);
            originalUrl = registerUrl(URL.createObjectURL(rawWavBlob));
          } else {
            throw new Error("Unknown source type for conversion.");
          }

          updateItemProgress(item.id, 75, "Rendering 360° HRTF & spatial reverb...");
          const processedBuffer = await process8DAudio(decodedBuffer, options);
          const bitrate = options.exportQuality === "320" ? 320 : 192;

          updateItemProgress(item.id, 85, `Mastering studio MP3 (${bitrate} kbps)...`);
          const wavBlob = await audioBufferToMp3(processedBuffer, bitrate, (pct) =>
            updateItemProgress(
              item.id,
              pct,
              `Mastering studio MP3 (${pct}%)...`
            )
          );
          const convertedUrl = registerUrl(URL.createObjectURL(wavBlob));
          wavBlobsRef.current.set(item.id, wavBlob);

          // Auto-save to persistent browser storage so tracks survive page reloads
          saveTrackToStorage(item, wavBlob)
            .then(() => refreshSavedLibrary())
            .catch((e) => console.warn("Auto-save to storage failed:", e));

          setAudioFiles((prev) =>
            prev.map((f) =>
              f.id === item.id
                ? {
                    ...f,
                    originalUrl,
                    convertedUrl,
                    status: "complete",
                    progress: 100,
                    stage: "8D Spatial Master Ready",
                    size: wavBlob.size,
                    rawBuffer: decodedBuffer,
                  }
                : f
            )
          );

          // Flag that a track succeeded so the retry queue can interleave failed tracks next!
          hasNewSuccessRef.current = true;
        };

        await Promise.race([doConversion(), timeoutPromise]);
      } catch (err: any) {
        console.error("Conversion error for track:", item.name, err);
        const msg = err?.message || "Audio conversion failed.";
        setAudioFiles((prev) =>
          prev.map((f) =>
            f.id === item.id
              ? {
                  ...f,
                  status: "error",
                  error: msg,
                  errorDetails: String(err?.stack || err),
                  stage: "Failed",
                }
              : f
          )
        );
        // Suppress top-level global error banner; errors and retry controls are displayed directly within the queue track item.
      } finally {
        if (timeoutTimer) clearTimeout(timeoutTimer);
        if (audioContext && audioContext.state !== "closed") {
          try {
            await audioContext.close();
          } catch {}
        }
      }
    },
    [options, registerUrl, updateItemProgress, refreshSavedLibrary]
  );

  const MAX_AUTO_RETRIES = 2;

  // Background Parallel Queue Runner:
  // Dynamically launches up to options.concurrency (default 2) conversions in parallel.
  // Interleaves retries of failed tracks right after a successful one.
  useEffect(() => {
    const maxConcurrency = options.concurrency || 2;
    const convertingTracks = audioFiles.filter((f) => f.status === "converting");
    const activeCount = convertingTracks.length;
    const availableSlots = maxConcurrency - activeCount;

    if (availableSlots <= 0) return;

    // 1. If a track just succeeded, check if there is a failed track to retry first
    if (hasNewSuccessRef.current) {
      hasNewSuccessRef.current = false;
      const retryCandidate = audioFiles.find(
        (f) =>
          f.status === "error" &&
          (f.retryCount || 0) < MAX_AUTO_RETRIES &&
          !activeConvertingIdsRef.current.has(f.id)
      );
      if (retryCandidate) {
        const nextAttempt = (retryCandidate.retryCount || 0) + 1;
        console.log(
          `[Interleaved Retry] Automatically re-trying "${retryCandidate.name}" after a successful track (attempt ${nextAttempt}/${MAX_AUTO_RETRIES})...`
        );
        setAudioFiles((prev) =>
          prev.map((f) =>
            f.id === retryCandidate.id
              ? {
                  ...f,
                  status: "pending",
                  progress: 0,
                  stage: "Retrying after successful track...",
                  retryCount: nextAttempt,
                  error: undefined,
                  errorDetails: undefined,
                }
              : f
          )
        );
        return;
      }
    }

    // 2. Launch up to availableSlots pending tracks in parallel
    const pendingTracks = audioFiles.filter(
      (f) => f.status === "pending" && !activeConvertingIdsRef.current.has(f.id)
    );

    if (pendingTracks.length > 0) {
      const batchToStart = pendingTracks.slice(0, availableSlots);
      for (const track of batchToStart) {
        activeConvertingIdsRef.current.add(track.id);
        processQueueItem(track).finally(() => {
          activeConvertingIdsRef.current.delete(track.id);
        });
      }
      return;
    }

    // 3. All standard pending tracks in the list are finished!
    // If no active conversions remain, check if any failed track still has retries left
    if (activeCount === 0) {
      const failedTrackToRetry = audioFiles.find(
        (f) =>
          f.status === "error" &&
          (f.retryCount || 0) < MAX_AUTO_RETRIES &&
          !activeConvertingIdsRef.current.has(f.id)
      );

      if (failedTrackToRetry) {
        const nextAttempt = (failedTrackToRetry.retryCount || 0) + 1;
        console.log(
          `[Auto-Retry] All queue items processed. Automatically retrying "${failedTrackToRetry.name}" (attempt ${nextAttempt}/${MAX_AUTO_RETRIES})...`
        );

        const timer = setTimeout(() => {
          setAudioFiles((prev) =>
            prev.map((f) =>
              f.id === failedTrackToRetry.id
                ? {
                    ...f,
                    status: "pending",
                    progress: 0,
                    stage: "Auto-retrying...",
                    retryCount: nextAttempt,
                    error: undefined,
                    errorDetails: undefined,
                  }
                : f
            )
          );
        }, 1500);

        return () => clearTimeout(timer);
      }
    }
  }, [audioFiles, options.concurrency, processQueueItem]);

  // --- 1. Local File Upload Handler ---
  const handleFileUpload = (files: File[]) => {
    setError(null);
    const newItems: AudioFileItem[] = files.map((file) => ({
      id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: file.name.replace(/\.[^/.]+$/, ""),
      artist: "Local Audio File",
      size: file.size,
      file,
      originalUrl: registerUrl(URL.createObjectURL(file)),
      status: "pending",
      progress: 0,
      sourceType: "upload",
      addedAt: Date.now(),
    }));

    setAudioFiles((prev) => {
      const updated = [...prev, ...newItems];
      if (prev.length === 0) {
        setCurrentTrackIndex(0);
        setActiveStudioTab("queue");
        setMobileTab("player");
      }
      return updated;
    });
  };

  // --- 2. YouTube Single Track Handler ---
  const handleConvertYouTubeTrack = async (track: YouTubeTrack) => {
    setError(null);
    const item: AudioFileItem = {
      id: `yt-${track.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: track.title,
      artist: track.author || "YouTube Music",
      thumbnail: track.thumbnail,
      originalUrl: "",
      sourceUrl: track.url,
      status: "pending",
      progress: 0,
      sourceType: "youtube",
      addedAt: Date.now(),
    };

    setAudioFiles((prev) => {
      const updated = [...prev, item];
      if (prev.length === 0) {
        setCurrentTrackIndex(0);
        setActiveStudioTab("queue");
        setMobileTab("player");
      }
      return updated;
    });
  };

  // --- 2b. YouTube Batch / Playlist Handler (Non-blocking queue visibility) ---
  const handleConvertYouTubeBatch = async (tracks: YouTubeTrack[]) => {
    setError(null);
    const newItems: AudioFileItem[] = tracks.map((track) => ({
      id: `yt-${track.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: track.title,
      artist: track.author || "YouTube Music",
      thumbnail: track.thumbnail,
      originalUrl: "",
      sourceUrl: track.url,
      status: "pending",
      progress: 0,
      sourceType: "youtube",
      addedAt: Date.now(),
    }));

    setAudioFiles((prev) => {
      const updated = [...prev, ...newItems];
      if (prev.length === 0) {
        setCurrentTrackIndex(0);
        setActiveStudioTab("queue");
        setMobileTab("player");
      }
      return updated;
    });
  };

  // --- 3. Instant Demo Track Synthesizer ---
  const handleLoadDemoTrack = () => {
    setError(null);
    const demoId = `demo-${Date.now()}`;
    const item: AudioFileItem = {
      id: demoId,
      name: "Starlight Neon Dreams (8D Demo)",
      artist: "8D Spatial Synthesizer",
      originalUrl: "",
      status: "pending",
      progress: 0,
      sourceType: "demo",
      addedAt: Date.now(),
    };

    setAudioFiles((prev) => {
      const updated = [...prev, item];
      if (prev.length === 0) {
        setCurrentTrackIndex(0);
      }
      return updated;
    });

    setActiveStudioTab("queue");
    setMobileTab("player");
  };

  // --- 4. Retry Mechanism ---
  const handleRetryTrack = (id: string) => {
    setError(null);
    setAudioFiles((prev) =>
      prev.map((f) =>
        f.id === id
          ? {
              ...f,
              status: "pending",
              progress: 0,
              retryCount: 0, // Reset retry count on manual user trigger
              error: undefined,
              errorDetails: undefined,
            }
          : f
      )
    );
  };

  const handleRetryAllFailed = () => {
    setError(null);
    setAudioFiles((prev) =>
      prev.map((f) =>
        f.status === "error"
          ? {
              ...f,
              status: "pending",
              progress: 0,
              retryCount: 0, // Reset retry count on manual user trigger
              error: undefined,
              errorDetails: undefined,
            }
          : f
      )
    );
  };

  // Re-convert an existing track with custom options
  const handleReconvert = async (index: number, customOptions?: AudioProcessingOptions) => {
    const target = audioFiles[index];
    if (!target) return;
    const opts = customOptions || options;

    if (target.rawBuffer) {
      setAudioFiles((prev) =>
        prev.map((f, i) =>
          i === index ? { ...f, status: "converting", progress: 30 } : f
        )
      );

      try {
        const processedBuffer = await process8DAudio(target.rawBuffer, opts);
        const bitrate = opts.exportQuality === "320" ? 320 : 192;
        const wavBlob = await audioBufferToMp3(processedBuffer, bitrate);
        const convertedUrl = registerUrl(URL.createObjectURL(wavBlob));
        wavBlobsRef.current.set(target.id, wavBlob);
        saveTrackToStorage(target, wavBlob)
          .then(() => refreshSavedLibrary())
          .catch(() => {});

        setAudioFiles((prev) =>
          prev.map((f, i) =>
            i === index
              ? { ...f, convertedUrl, status: "complete", progress: 100 }
              : f
          )
        );
      } catch (err: any) {
        setAudioFiles((prev) =>
          prev.map((f, i) =>
            i === index ? { ...f, status: "error", error: err.message } : f
          )
        );
      }
    } else {
      // Re-queue the track for conversion
      handleRetryTrack(target.id);
    }
  };

  // --- 4b. Export / Import .8dpack & Saved Library Handlers ---
  const handleExportPack = async () => {
    const completeTracks = audioFiles.filter((f) => f.status === "complete");
    if (completeTracks.length === 0) {
      setError("No converted tracks available to export.");
      return;
    }

    setIsExportingPack(true);
    try {
      const packItems: { item: AudioFileItem; blob: Blob }[] = [];

      for (const track of completeTracks) {
        let blob = wavBlobsRef.current.get(track.id);
        if (!blob && track.convertedUrl) {
          try {
            const res = await fetch(track.convertedUrl);
            blob = await res.blob();
          } catch {}
        }
        if (blob) {
          packItems.push({ item: track, blob });
        }
      }

      if (packItems.length === 0) {
        throw new Error("Could not extract converted audio data for export.");
      }

      const packBlob = await exportTracksToPackFile(packItems);
      const packUrl = URL.createObjectURL(packBlob);
      const link = document.createElement("a");
      link.href = packUrl;
      link.download = `Spatial_8D_Tracks_${Date.now()}.8dpack`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(packUrl);
    } catch (err: any) {
      console.error("Export pack error:", err);
      setError(`Failed to export .8dpack: ${err?.message}`);
    } finally {
      setIsExportingPack(false);
    }
  };

  const handleImportPackFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImportingPack(true);
    setError(null);
    try {
      const imported = await importTracksFromPackFile(file);
      const newItems: AudioFileItem[] = [];

      for (const { item, blob } of imported) {
        const audioUrl = registerUrl(URL.createObjectURL(blob));
        item.originalUrl = audioUrl;
        item.convertedUrl = audioUrl;
        wavBlobsRef.current.set(item.id, blob);
        newItems.push(item);

        saveTrackToStorage(item, blob).catch(() => {});
      }

      setAudioFiles((prev) => {
        const updated = [...prev, ...newItems];
        if (prev.length === 0) setCurrentTrackIndex(0);
        return updated;
      });

      refreshSavedLibrary();
      setActiveStudioTab("queue");
      setMobileTab("player");
    } catch (err: any) {
      console.error("Import pack error:", err);
      setError(`Failed to import .8dpack: ${err?.message}`);
    } finally {
      setIsImportingPack(false);
      e.target.value = "";
    }
  };

  const handleLoadSavedTrack = (record: SavedTrackRecord) => {
    const audioUrl = registerUrl(URL.createObjectURL(record.blob));
    const newItem: AudioFileItem = {
      id: `saved-${record.id}-${Date.now()}`,
      name: record.name,
      artist: record.artist || "Saved 8D Master",
      thumbnail: record.thumbnail,
      size: record.size,
      originalUrl: audioUrl,
      convertedUrl: audioUrl,
      status: "complete",
      progress: 100,
      sourceType: record.sourceType || "upload",
      sourceUrl: record.sourceUrl,
      addedAt: record.savedAt,
    };
    wavBlobsRef.current.set(newItem.id, record.blob);

    setAudioFiles((prev) => {
      const updated = [...prev, newItem];
      if (prev.length === 0) setCurrentTrackIndex(0);
      return updated;
    });

    setActiveStudioTab("queue");
    setMobileTab("player");
  };

  const handleLoadAllSavedTracks = () => {
    if (savedLibrary.length === 0) return;

    const newItems: AudioFileItem[] = savedLibrary.map((record) => {
      const audioUrl = registerUrl(URL.createObjectURL(record.blob));
      const item: AudioFileItem = {
        id: `saved-${record.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: record.name,
        artist: record.artist || "Saved 8D Master",
        thumbnail: record.thumbnail,
        size: record.size,
        originalUrl: audioUrl,
        convertedUrl: audioUrl,
        status: "complete",
        progress: 100,
        sourceType: record.sourceType || "upload",
        sourceUrl: record.sourceUrl,
        addedAt: record.savedAt,
      };
      wavBlobsRef.current.set(item.id, record.blob);
      return item;
    });

    setAudioFiles((prev) => {
      const updated = [...prev, ...newItems];
      if (prev.length === 0) setCurrentTrackIndex(0);
      return updated;
    });

    setActiveStudioTab("queue");
    setMobileTab("player");
  };

  const handleDeleteSavedTrack = async (id: string) => {
    try {
      await deleteSavedTrack(id);
      await refreshSavedLibrary();
      setAudioFiles((prev) => prev.filter((f) => f.id !== id));
    } catch (err: any) {
      setError(`Could not remove track: ${err?.message}`);
    }
  };

  // --- 5. Playlist Navigation & Auto-play Next ---
  const handleNextTrack = useCallback(
    (autoPlay = false) => {
      const completeTracks = audioFiles
        .map((f, idx) => ({ f, idx }))
        .filter(({ f }) => f.status === "complete");

      if (completeTracks.length === 0) return;

      if (isShuffle) {
        const otherTracks = completeTracks.filter(({ idx }) => idx !== currentTrackIndex);
        const pool = otherTracks.length > 0 ? otherTracks : completeTracks;
        const randomPick = pool[Math.floor(Math.random() * pool.length)].idx;
        setCurrentTrackIndex(randomPick);
      } else {
        const nextSequential = completeTracks.find(({ idx }) => idx > currentTrackIndex);
        if (nextSequential) {
          setCurrentTrackIndex(nextSequential.idx);
        } else if (isLooping) {
          setCurrentTrackIndex(completeTracks[0].idx);
        }
      }

      if (autoPlay) {
        setIsPlaying(true);
      }
    },
    [audioFiles, currentTrackIndex, isShuffle, isLooping]
  );

  const handlePrevTrack = useCallback(
    (autoPlay = false) => {
      const completeTracks = audioFiles
        .map((f, idx) => ({ f, idx }))
        .filter(({ f }) => f.status === "complete");

      if (completeTracks.length === 0) return;

      const prevSequential = [...completeTracks]
        .reverse()
        .find(({ idx }) => idx < currentTrackIndex);

      if (prevSequential) {
        setCurrentTrackIndex(prevSequential.idx);
      } else {
        setCurrentTrackIndex(completeTracks[completeTracks.length - 1].idx);
      }

      if (autoPlay) {
        setIsPlaying(true);
      }
    },
    [audioFiles, currentTrackIndex]
  );

  const handleDownload = (convertedUrl: string, title: string) => {
    try {
      const link = document.createElement("a");
      link.href = convertedUrl;
      const cleanTitle = title.replace(/[^a-zA-Z0-9_-]/g, "_");
      link.download = `${cleanTitle}_8D_Spatial.mp3`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Download error:", err);
      setError("Failed to download file. Please try again.");
    }
  };

  const removeTrack = (index: number) => {
    setAudioFiles((prev) => {
      const target = prev[index];
      if (target) {
        if (target.originalUrl) URL.revokeObjectURL(target.originalUrl);
        if (target.convertedUrl) URL.revokeObjectURL(target.convertedUrl);
        deleteSavedTrack(target.id)
          .then(() => refreshSavedLibrary())
          .catch(() => {});
      }
      return prev.filter((_, i) => i !== index);
    });

    if (currentTrackIndex >= index && currentTrackIndex > 0) {
      setCurrentTrackIndex((prev) => prev - 1);
    }
  };

  const activeTrack = audioFiles[currentTrackIndex] || null;
  const isConvertingAny = audioFiles.some((f) => f.status === "converting");
  const failedTracks = audioFiles.filter((f) => f.status === "error");
  const pendingTracks = audioFiles.filter((f) => f.status === "pending");

  return (
    <div className="space-y-6">
      {/* Global Error Banner */}
      {error && (
        <Alert variant="destructive" className="bg-red-950/80 border-red-800 text-red-200">
          <AlertCircle className="w-4 h-4 text-red-400" />
          <AlertDescription className="flex items-center justify-between gap-2">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-xs text-red-300 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </AlertDescription>
        </Alert>
      )}

      {/* Mobile Top Navigation Segmented Switcher — sticky at top on mobile */}
      <div className="lg:hidden sticky top-16 z-30 flex items-center p-1 bg-slate-900/95 border border-slate-800 rounded-2xl shadow-xl backdrop-blur-md">
        <button
          type="button"
          onClick={() => setMobileTab("player")}
          className={`flex-1 py-3 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all touch-manipulation ${
            mobileTab === "player"
              ? "bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Headphones className="w-4 h-4" />
          <span>8D Player</span>
          {activeTrack?.status === "complete" && isPlaying && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setMobileTab("studio")}
          className={`flex-1 py-3 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all touch-manipulation ${
            mobileTab === "studio"
              ? "bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <ListMusic className="w-4 h-4" />
          <span>Queue</span>
          {audioFiles.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-mono leading-none">
              {audioFiles.length}
            </span>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
        {/* ========================================================= */}
        {/* LEFT COLUMN: THE 8D/16D SPATIAL MUSIC PLAYER (6 COLS)     */}
        {/* ========================================================= */}
        <div className={`space-y-4 sm:space-y-5 lg:col-span-6 ${mobileTab === "player" ? "block" : "hidden lg:block"}`}>
          {/* Deck Container */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl sm:rounded-3xl p-3 sm:p-5 md:p-6 shadow-2xl backdrop-blur-xl relative overflow-hidden">
            {/* Top Tag & Spatial Status */}
            <div className="flex items-center justify-between pb-2.5 sm:pb-3 border-b border-slate-800/80 mb-3 sm:mb-4">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${isPlaying ? "bg-emerald-400 animate-ping" : "bg-cyan-400"}`} />
                <span className="text-xs font-mono font-bold tracking-wider text-slate-300 uppercase">
                  360° HRTF Binaural Deck
                </span>
              </div>
              <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                {activeTrack?.status === "complete" ? "8D ACTIVE" : "STUDIO ENGINE"}
              </span>
            </div>

            {/* Audio Player with Transparent 360°/16D Radar Overlay */}
            {activeTrack ? (
              <AudioPlayer
                src={activeTrack.convertedUrl || activeTrack.originalUrl}
                originalSrc={activeTrack.originalUrl}
                title={activeTrack.name}
                artist={activeTrack.artist || "8D Audio Master"}
                thumbnail={activeTrack.thumbnail}
                sourceUrl={getYouTubeUrl(activeTrack) || activeTrack.sourceUrl}
                onCopySourceUrl={(url) => copyToClipboard(url, "YouTube link")}
                is8DReady={!!activeTrack.convertedUrl}
                options={options}
                isShuffle={isShuffle}
                onToggleShuffle={() => setIsShuffle((prev) => !prev)}
                isLooping={isLooping}
                onToggleLoop={() => setIsLooping((prev) => !prev)}
                onTimeUpdate={setActivePlaybackTime}
                onPlayStateChange={setIsPlaying}
                onNext={handleNextTrack}
                onPrev={handlePrevTrack}
                onDownload={
                  activeTrack.convertedUrl
                    ? () => handleDownload(activeTrack.convertedUrl!, activeTrack.name)
                    : undefined
                }
                onSelectPreset={(pOptions) => {
                  setOptions(pOptions);
                  if (activeTrack && activeTrack.rawBuffer && activeTrack.status === "complete") {
                    handleReconvert(currentTrackIndex, pOptions);
                  }
                }}
              />
            ) : (
              /* Idle Deck State */
              <div className="space-y-4">
                <AudioPlayer
                  src=""
                  title="8D Spatial Soundscape"
                  artist="Load tracks from YouTube, local files, or try the instant demo track"
                  thumbnail={undefined}
                  is8DReady={false}
                  options={options}
                  onSelectPreset={(pOptions) => setOptions(pOptions)}
                />
                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleLoadDemoTrack}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-cyan-500/20 transition-all"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Try Instant Demo Song</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileTab("studio");
                      setActiveStudioTab("add");
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Music to Queue</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ========================================================= */}
        {/* RIGHT COLUMN: QUEUE, ADD MUSIC & 8D STUDIO TABS (6 COLS)  */}
        {/* ========================================================= */}
        <div className={`space-y-4 lg:col-span-6 ${mobileTab === "studio" ? "block" : "hidden lg:block"}`}>
          {/* Quick Return to Player Banner on Mobile */}
          {activeTrack && (
            <div
              onClick={() => setMobileTab("player")}
              className="lg:hidden p-3 bg-gradient-to-r from-cyan-950/60 to-purple-950/40 border border-cyan-500/40 rounded-2xl flex items-center justify-between cursor-pointer hover:border-cyan-400 transition-all shadow-lg"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className={`w-2.5 h-2.5 rounded-full ${isPlaying ? "bg-emerald-400 animate-ping" : "bg-cyan-400"}`} />
                <div className="min-w-0">
                  <span className="text-[10px] text-cyan-400 font-mono font-semibold uppercase block">
                    {isPlaying ? "Now Playing" : "Loaded in Deck"}
                  </span>
                  <span className="text-xs font-semibold text-white truncate block max-w-[200px]">
                    {activeTrack.name}
                  </span>
                </div>
              </div>
              <span className="text-[11px] font-semibold text-cyan-300 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
                View Deck →
              </span>
            </div>
          )}

          <div className="flex items-center justify-between p-1.5 bg-slate-900/90 border border-slate-800 rounded-2xl">
            <button
              type="button"
              onClick={() => setActiveStudioTab("queue")}
              className={`flex-1 py-3 px-2 sm:px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                activeStudioTab === "queue"
                  ? "bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <ListMusic className="w-4 h-4 shrink-0" />
              <span className="truncate">Queue</span>
              {audioFiles.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-mono">
                  {audioFiles.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveStudioTab("add")}
              className={`flex-1 py-3 px-2 sm:px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                activeStudioTab === "add"
                  ? "bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span className="truncate">Add Music</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveStudioTab("settings")}
              className={`flex-1 py-3 px-2 sm:px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                activeStudioTab === "settings"
                  ? "bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Sliders className="w-4 h-4 shrink-0" />
              <span className="truncate">8D Tuning</span>
            </button>
          </div>

          {/* TAB 1: PLAYLIST / QUEUE */}
          {activeStudioTab === "queue" && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-3 sm:p-5 shadow-xl backdrop-blur-xl space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-100">
                    Track Queue ({audioFiles.length})
                  </h3>
                  {pendingTracks.length > 0 && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                      {pendingTracks.length} Queued
                    </span>
                  )}
                  {isWakeLocked && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                      <Zap className="w-2.5 h-2.5 fill-current text-amber-400" />
                      Screen Awake
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {failedTracks.length > 0 && (
                    <button
                      type="button"
                      onClick={handleRetryAllFailed}
                      className="text-xs text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1 font-semibold px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/30 shadow-sm"
                      title="Retry all failed tracks"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      <span>Retry Failed ({failedTracks.length})</span>
                    </button>
                  )}

                  {audioFiles.some((f) => f.status === "complete") && (
                    <button
                      type="button"
                      onClick={handleExportPack}
                      disabled={isExportingPack}
                      className="text-xs text-purple-400 hover:text-purple-300 disabled:opacity-50 transition-colors flex items-center gap-1 font-semibold px-2.5 py-1 rounded-xl bg-purple-500/10 border border-purple-500/30 shadow-sm"
                      title="Export all converted tracks as a portable .8dpack file"
                    >
                      <Package className="w-3.5 h-3.5" />
                      <span>{isExportingPack ? "Exporting…" : "Export .8dpack"}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleLoadDemoTrack}
                    className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1 font-medium"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>+ Demo Song</span>
                  </button>

                  {audioFiles.length > 0 && (
                    <>
                      <span className="text-slate-700">•</span>
                      <button
                        type="button"
                        onClick={async () => {
                          setAudioFiles([]);
                          setCurrentTrackIndex(0);
                          clearQueueManifest();
                          await clearAllSavedTracks();
                          await refreshSavedLibrary();
                        }}
                        className="text-xs text-slate-500 hover:text-red-400 transition-colors"
                      >
                        Clear All
                      </button>
                    </>
                  )}
                </div>
              </div>

              {audioFiles.length === 0 ? (
                <div className="p-8 text-center space-y-3">
                  <Music className="w-10 h-10 text-slate-600 mx-auto" />
                  <p className="text-xs text-slate-400">
                    Your queue is currently empty.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveStudioTab("add")}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-all"
                  >
                    + Add Tracks Now
                  </button>
                </div>
              ) : (
                <div className="space-y-3 max-h-[50vh] sm:max-h-[460px] overflow-y-auto pr-1 custom-scrollbar">
                  {audioFiles.map((item, index) => {
                    const isCurrent = currentTrackIndex === index;
                    const ytLink = getYouTubeUrl(item);
                    return (
                      <div
                        key={item.id}
                        onContextMenu={(e) => handleOpenMenu(e, item, index, false)}
                        className={`p-3.5 rounded-2xl border transition-all ${
                          isCurrent
                            ? "bg-slate-950 border-cyan-500/60 shadow-lg shadow-cyan-500/5 ring-1 ring-cyan-500/30"
                            : "bg-slate-950/50 border-slate-800/80 hover:border-slate-700"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {/* Track Thumbnail with Play/Pause Overlay */}
                          <button
                            type="button"
                            onClick={() => {
                              setCurrentTrackIndex(index);
                              setMobileTab("player");
                            }}
                            className="relative w-11 h-11 sm:w-12 sm:h-12 rounded-xl overflow-hidden bg-slate-900 border border-slate-800 shrink-0 flex items-center justify-center group/cover shadow-md transition-transform active:scale-95"
                            title="Load in deck"
                          >
                            {item.thumbnail ? (
                              <img
                                src={item.thumbnail}
                                alt={item.name}
                                className="w-full h-full object-cover transition-transform duration-300 group-hover/cover:scale-110"
                              />
                            ) : (
                              <Headphones className="w-5 h-5 text-slate-500" />
                            )}
                            <div
                              className={`absolute inset-0 flex items-center justify-center transition-all ${
                                isCurrent && isPlaying
                                  ? "bg-cyan-950/70 text-cyan-300 backdrop-blur-[1px]"
                                  : "bg-slate-950/40 text-white opacity-0 group-hover/cover:opacity-100 backdrop-blur-[1px]"
                              }`}
                            >
                              {isCurrent && isPlaying ? (
                                <Pause className="w-5 h-5 fill-current" />
                              ) : (
                                <Play className="w-5 h-5 fill-current ml-0.5" />
                              )}
                            </div>
                          </button>

                          {/* Track Info */}
                          <div
                            className="flex-1 min-w-0 cursor-pointer"
                            onClick={() => {
                              setCurrentTrackIndex(index);
                              setMobileTab("player");
                            }}
                          >
                            <div className="flex items-center gap-1.5">
                              <h4
                                className={`text-xs md:text-sm font-semibold truncate transition-colors ${
                                  isCurrent ? "text-cyan-300 font-bold" : "text-slate-100"
                                }`}
                              >
                                {item.name}
                              </h4>
                              {isCurrent && isPlaying && (
                                <span className="flex items-end gap-0.5 h-3 shrink-0 ml-1" title="Now playing">
                                  <span className="w-0.5 h-3 bg-cyan-400 animate-pulse rounded-full" />
                                  <span className="w-0.5 h-2 bg-purple-400 animate-pulse rounded-full" style={{ animationDelay: "150ms" }} />
                                  <span className="w-0.5 h-3.5 bg-cyan-300 animate-pulse rounded-full" style={{ animationDelay: "300ms" }} />
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                              <span className="truncate">{item.artist || "Audio"}</span>
                              {ytLink && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    copyToClipboard(ytLink, "YouTube link");
                                  }}
                                  className="inline-flex items-center gap-1 text-[10px] text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 px-1.5 py-0.2 rounded transition-colors"
                                  title="Click to copy YouTube audio link (or right-click / 3-dots)"
                                >
                                  <Youtube className="w-2.5 h-2.5 fill-current text-red-500" />
                                  <span className="font-mono">YouTube</span>
                                </button>
                              )}
                              <span className="text-slate-600">•</span>
                              {item.status === "complete" && (
                                <span className="text-emerald-400 font-mono font-semibold flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" />
                                  8D Ready
                                </span>
                              )}
                              {item.status === "converting" && (
                                <span className="text-cyan-400 font-mono flex items-center gap-1.5 flex-wrap">
                                  <span className="animate-spin inline-block w-2.5 h-2.5 border border-cyan-400 border-t-transparent rounded-full" />
                                  <span>{item.progress || 10}%</span>
                                  {item.stage && (
                                    <span className="text-cyan-300/80 font-sans text-[10px] truncate max-w-[130px] sm:max-w-[200px]">
                                      • {item.stage}
                                    </span>
                                  )}
                                </span>
                              )}
                              {item.status === "pending" && (
                                <span className="text-amber-400 font-mono flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  Pending in Queue
                                </span>
                              )}
                              {item.status === "error" && (
                                <span className="text-red-400 font-mono flex items-center gap-1.5 flex-wrap">
                                  <AlertCircle className="w-3 h-3 shrink-0" />
                                  <span>Failed</span>
                                  {(item.retryCount || 0) < MAX_AUTO_RETRIES ? (
                                    <span className="text-amber-300 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.2 rounded font-sans text-[10px]">
                                      Will retry after next success ({item.retryCount || 0}/{MAX_AUTO_RETRIES})
                                    </span>
                                  ) : (
                                    <span className="text-red-400/70 font-sans text-[10px]">
                                      (Click Retry)
                                    </span>
                                  )}
                                </span>
                              )}
                            </div>

                            {/* Error Message Snippet */}
                            {item.status === "error" && item.error && (
                              <p className="text-[11px] text-red-300/80 truncate mt-1">
                                {item.error}
                              </p>
                            )}
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {/* Individual Retry Button for Failed Tracks */}
                            {item.status === "error" && (
                              <button
                                type="button"
                                onClick={() => handleRetryTrack(item.id)}
                                className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-semibold flex items-center gap-1 transition-all shadow-sm"
                                title="Retry conversion"
                              >
                                <RotateCw className="w-3 h-3" />
                                <span>Retry</span>
                              </button>
                            )}

                            {item.status === "complete" && item.convertedUrl && (
                              <button
                                type="button"
                                onClick={() => handleDownload(item.convertedUrl!, item.name)}
                                className="hidden sm:flex p-2 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 transition-all"
                                title="Download 8D Master (MP3)"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {item.status === "complete" && (
                              <button
                                type="button"
                                onClick={() => handleReconvert(index)}
                                className="hidden sm:flex p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-all"
                                title="Re-convert with current 8D settings"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* 3-Dots More Options Menu Button */}
                            <button
                              type="button"
                              onClick={(e) => handleOpenMenu(e, item, index, true)}
                              className={`p-2 rounded-lg transition-all border ${
                                activeMenu?.item.id === item.id
                                  ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-300"
                                  : "bg-slate-900 border-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                              }`}
                              title="More options (Copy YouTube link, etc.)"
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => removeTrack(index)}
                              className="p-2 rounded-lg bg-slate-900 hover:bg-red-950/60 text-slate-500 hover:text-red-400 transition-all border border-slate-800/80"
                              title="Remove track"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Progress Bar for Converting Tracks */}
                        {item.status === "converting" && (
                          <div className="mt-2.5 pt-2 border-t border-slate-900 space-y-1">
                            <div className="flex justify-between items-center text-[10px] font-mono">
                              <span className="text-cyan-300 font-medium truncate max-w-[240px] sm:max-w-xs">
                                {item.stage || "Processing audio..."}
                              </span>
                              <span className="text-cyan-400 font-bold">{item.progress || 10}%</span>
                            </div>
                            <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 h-1.5 transition-all duration-300"
                                style={{ width: `${Math.max(8, item.progress || 10)}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: ADD MUSIC */}
          {activeStudioTab === "add" && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-3 sm:p-5 shadow-xl backdrop-blur-xl space-y-4">
              {/* Hidden file input for .8dpack import */}
              <input
                ref={packFileInputRef}
                type="file"
                accept=".8dpack"
                className="hidden"
                onChange={handleImportPackFile}
              />

              {/* Sub Mode Toggle: File Upload vs YouTube vs Saved Library */}
              <div className="flex gap-1.5 p-1 bg-slate-950/70 border border-slate-800 rounded-xl">
                <button
                  type="button"
                  onClick={() => setAddMode("upload")}
                  className={`flex-1 py-2 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                    addMode === "upload"
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Upload Files</span>
                  <span className="sm:hidden">Upload</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAddMode("youtube")}
                  className={`flex-1 py-2 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                    addMode === "youtube"
                      ? "bg-red-500/20 text-red-300 border border-red-500/30"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Youtube className="w-3.5 h-3.5 text-red-400" />
                  <span className="hidden sm:inline">YouTube / Playlist</span>
                  <span className="sm:hidden">YouTube</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAddMode("library")}
                  className={`flex-1 py-2 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                    addMode === "library"
                      ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <HardDrive className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Saved Library</span>
                  <span className="sm:hidden">Library</span>
                  {savedLibrary.length > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-purple-500/30 text-purple-200 text-[10px] font-mono leading-none">
                      {savedLibrary.length}
                    </span>
                  )}
                </button>
              </div>

              {/* View according to submode */}
              {addMode === "upload" ? (
                <UploadForm
                  onUpload={handleFileUpload}
                  isConverting={isConvertingAny}
                  maxFileSize={MAX_FILE_SIZE}
                  supportedFormats={SUPPORTED_FORMATS}
                />
              ) : addMode === "youtube" ? (
                <YouTubeInput
                  onConvertTrack={handleConvertYouTubeTrack}
                  onConvertBatch={handleConvertYouTubeBatch}
                  isConverting={isConvertingAny}
                />
              ) : (
                /* ── Saved Library Panel ── */
                <div className="space-y-3">
                  {/* Library Header Actions */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <HardDrive className="w-3.5 h-3.5 text-purple-400" />
                      Offline 8D Library
                      {savedLibrary.length > 0 && (
                        <span className="text-[10px] font-mono text-slate-500">
                          ({savedLibrary.length} track{savedLibrary.length !== 1 ? "s" : ""})
                        </span>
                      )}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => packFileInputRef.current?.click()}
                        disabled={isImportingPack}
                        className="text-xs text-emerald-400 hover:text-emerald-300 disabled:opacity-50 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 font-semibold transition-all"
                        title="Import a .8dpack file"
                      >
                        <FolderUp className="w-3.5 h-3.5" />
                        <span>{isImportingPack ? "Importing…" : "Import"}</span>
                      </button>
                      {savedLibrary.length > 0 && (
                        <>
                          <button
                            type="button"
                            onClick={handleLoadAllSavedTracks}
                            className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/30 font-semibold transition-all"
                            title="Load all saved tracks into queue"
                          >
                            <FolderDown className="w-3.5 h-3.5" />
                            <span>Load All</span>
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await clearAllSavedTracks();
                              await refreshSavedLibrary();
                            }}
                            className="text-xs text-slate-500 hover:text-red-400 flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-red-500/10 transition-all"
                            title="Clear all saved tracks from browser storage"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Storage Quota Usage Meter */}
                  {storageQuota && (
                    <div className="p-2.5 rounded-xl bg-slate-950/40 border border-slate-800/80 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400 flex items-center gap-1 font-mono">
                          <HardDrive className="w-3 h-3 text-purple-400" />
                          Storage Quota
                        </span>
                        <span className="font-mono text-purple-300 font-semibold text-[10px]">
                          {storageQuota.usageMB} MB /{" "}
                          {storageQuota.quotaMB > 1024
                            ? `${(storageQuota.quotaMB / 1024).toFixed(1)} GB`
                            : `${storageQuota.quotaMB} MB`}{" "}
                          ({storageQuota.percentage}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-purple-500 to-cyan-400 h-1.5 rounded-full transition-all duration-300"
                          style={{
                            width: `${Math.min(100, Math.max(1, storageQuota.percentage))}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Library Track List */}
                  {savedLibrary.length === 0 ? (
                    <div className="py-10 text-center space-y-3">
                      <div className="w-12 h-12 mx-auto rounded-full bg-slate-900 flex items-center justify-center border border-slate-800">
                        <HardDrive className="w-6 h-6 text-slate-600" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-slate-400">No saved tracks yet</p>
                        <p className="text-[11px] text-slate-500 max-w-[220px] mx-auto">
                          Convert a song and it will auto-save here. You can also import a{" "}
                          <span className="font-mono text-purple-400">.8dpack</span> file.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => packFileInputRef.current?.click()}
                        disabled={isImportingPack}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-500/10 hover:bg-purple-500/20 disabled:opacity-50 border border-purple-500/30 text-purple-300 text-xs font-semibold rounded-xl transition-all"
                      >
                        <FolderUp className="w-3.5 h-3.5" />
                        Import .8dpack File
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1 custom-scrollbar">
                      {savedLibrary.map((record) => (
                        <div
                          key={record.id}
                          className="flex items-center gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-purple-500/30 transition-all group"
                        >
                          {/* Thumbnail / Icon */}
                          <div className="w-9 h-9 rounded-lg flex-shrink-0 overflow-hidden bg-slate-900 border border-slate-800 flex items-center justify-center">
                            {record.thumbnail ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={record.thumbnail}
                                alt={record.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Headphones className="w-4 h-4 text-purple-400" />
                            )}
                          </div>

                          {/* Track Meta */}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-slate-100 truncate">
                              {record.name}
                            </p>
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                              <span className="truncate">{record.artist || "8D Master"}</span>
                              <span>•</span>
                              <span className="font-mono whitespace-nowrap">
                                {(record.size / 1024 / 1024).toFixed(1)} MB
                              </span>
                              <span>•</span>
                              <span className="whitespace-nowrap">
                                {new Date(record.savedAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>

                          {/* Load + Delete */}
                          <div className="flex items-center gap-1.5 flex-shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
                            {getYouTubeUrl(record) && (
                              <button
                                type="button"
                                onClick={() => {
                                  const yt = getYouTubeUrl(record);
                                  if (yt) copyToClipboard(yt, "YouTube link");
                                }}
                                className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition-all"
                                title="Copy YouTube link"
                              >
                                <Youtube className="w-3.5 h-3.5 fill-current" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleLoadSavedTrack(record)}
                              className="px-2.5 py-1.5 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 text-[11px] font-semibold flex items-center gap-1 transition-all"
                              title="Load into queue"
                            >
                              <Play className="w-3 h-3 fill-current" />
                              <span>Load</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSavedTrack(record.id)}
                              className="p-1.5 rounded-lg hover:bg-red-950/60 text-slate-600 hover:text-red-400 transition-all"
                              title="Delete from library"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Import hint */}
                  {savedLibrary.length > 0 && (
                    <p className="text-[11px] text-slate-600 text-center">
                      Tracks auto-save after conversion •{" "}
                      <button
                        type="button"
                        onClick={() => packFileInputRef.current?.click()}
                        className="text-purple-400 hover:text-purple-300 underline underline-offset-2"
                      >
                        Import .8dpack
                      </button>
                    </p>
                  )}
                </div>
              )}

              {/* Instant Demo Song Callout */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-950/30 via-slate-950/50 to-cyan-950/30 border border-slate-800 flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <h4 className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    <span>No audio file handy?</span>
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Instantly synthesize a chill ambient 8D track directly in your browser.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleLoadDemoTrack}
                  className="px-3.5 py-2 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white text-xs font-semibold rounded-xl shadow-md shadow-cyan-500/10 transition-all flex-shrink-0"
                >
                  Try Demo Song
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: 8D TUNING STUDIO */}
          {activeStudioTab === "settings" && (
            <div className="space-y-4">
              <AudioSettings
                options={options}
                onChange={setOptions}
                disabled={isConvertingAny}
              />

              {activeTrack && (
                <button
                  type="button"
                  onClick={() => handleReconvert(currentTrackIndex)}
                  disabled={isConvertingAny}
                  className="w-full py-3 px-4 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 disabled:opacity-40 text-white text-xs font-semibold rounded-2xl shadow-lg shadow-cyan-500/20 transition-all flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Re-render Current Track with These Settings</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Floating Context / 3-Dots Menu ── */}
      {activeMenu && (
        <div
          ref={menuRef}
          style={{
            top: `${activeMenu.y}px`,
            left: `${activeMenu.x}px`,
          }}
          className="fixed z-50 w-64 rounded-2xl bg-slate-900/95 border border-slate-700/80 shadow-2xl backdrop-blur-xl p-1.5 text-xs text-slate-200 animate-in fade-in zoom-in-95 duration-150 select-none divide-y divide-slate-800/80"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Track Summary Header */}
          <div className="px-3 py-2">
            <p className="font-semibold text-slate-100 truncate text-xs">
              {activeMenu.item.name}
            </p>
            <p className="text-[11px] text-slate-400 truncate mt-0.5">
              {activeMenu.item.artist || "8D Audio"}
            </p>
          </div>

          {/* YouTube Actions */}
          {(() => {
            const ytUrl = getYouTubeUrl(activeMenu.item);
            if (!ytUrl) return null;
            return (
              <div className="py-1">
                <button
                  type="button"
                  onClick={() => {
                    copyToClipboard(ytUrl, "YouTube link");
                    setActiveMenu(null);
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-red-500/15 hover:text-red-300 text-slate-200 text-left transition-colors font-medium group"
                >
                  <div className="w-6 h-6 rounded-lg bg-red-500/15 flex items-center justify-center text-red-500 flex-shrink-0 group-hover:scale-105 transition-transform">
                    <Youtube className="w-3.5 h-3.5 fill-current" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-red-400">Copy YouTube Link</span>
                      <Copy className="w-3 h-3 text-slate-400 group-hover:text-red-300" />
                    </div>
                    <p className="text-[10px] text-slate-400/80 truncate font-mono mt-0.5">
                      {ytUrl.replace(/^https?:\/\/(www\.)?/, "")}
                    </p>
                  </div>
                </button>

                <a
                  href={ytUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setActiveMenu(null)}
                  className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-slate-800 text-slate-300 text-left transition-colors font-medium group"
                >
                  <div className="w-6 h-6 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 flex-shrink-0 group-hover:text-cyan-400">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </div>
                  <span>Open on YouTube</span>
                </a>
              </div>
            );
          })()}

          {/* General Actions */}
          <div className="py-1">
            <button
              type="button"
              onClick={() => {
                copyToClipboard(
                  `${activeMenu.item.name} - ${activeMenu.item.artist || "8D Audio"}`,
                  "song title"
                );
                setActiveMenu(null);
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-slate-800 text-slate-300 text-left transition-colors font-medium"
            >
              <div className="w-6 h-6 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 flex-shrink-0">
                <Copy className="w-3.5 h-3.5" />
              </div>
              <span>Copy Track Title</span>
            </button>

            {activeMenu.item.status === "complete" && activeMenu.item.convertedUrl && (
              <button
                type="button"
                onClick={() => {
                  handleDownload(activeMenu.item.convertedUrl!, activeMenu.item.name);
                  setActiveMenu(null);
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-cyan-500/15 text-cyan-300 text-left transition-colors font-medium"
              >
                <div className="w-6 h-6 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400 flex-shrink-0">
                  <Download className="w-3.5 h-3.5" />
                </div>
                <span>Download 8D Master (MP3)</span>
              </button>
            )}

            {activeMenu.item.status === "complete" && (
              <button
                type="button"
                onClick={() => {
                  handleReconvert(activeMenu.index);
                  setActiveMenu(null);
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-slate-800 text-slate-300 text-left transition-colors font-medium"
              >
                <div className="w-6 h-6 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 flex-shrink-0">
                  <RefreshCw className="w-3.5 h-3.5" />
                </div>
                <span>Re-convert with 8D Deck</span>
              </button>
            )}

            {activeMenu.item.status === "error" && (
              <button
                type="button"
                onClick={() => {
                  handleRetryTrack(activeMenu.item.id);
                  setActiveMenu(null);
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-amber-500/15 text-amber-300 text-left transition-colors font-medium"
              >
                <div className="w-6 h-6 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-400 flex-shrink-0">
                  <RotateCw className="w-3.5 h-3.5" />
                </div>
                <span>Retry Conversion</span>
              </button>
            )}
          </div>

          {/* Destructive Actions */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => {
                removeTrack(activeMenu.index);
                setActiveMenu(null);
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-red-500/20 text-red-400 text-left transition-colors font-medium"
            >
              <div className="w-6 h-6 rounded-lg bg-red-950/40 flex items-center justify-center text-red-400 flex-shrink-0">
                <Trash2 className="w-3.5 h-3.5" />
              </div>
              <span>Remove from Queue</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Sleek Bottom Toast Notification ── */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 border border-cyan-500/40 px-4 py-2.5 rounded-2xl shadow-2xl backdrop-blur-xl flex items-center gap-2.5 text-xs font-semibold text-slate-100 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <Check className="w-3 h-3 stroke-[2.5]" />
          </div>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
