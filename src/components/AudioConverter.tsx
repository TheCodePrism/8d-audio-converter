/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  AlertCircle,
  X,
  Sparkles,
  RefreshCw,
  Upload,
  Youtube,
  Headphones,
  Sliders,
  ListMusic,
  Plus,
  Play,
  Pause,
  SkipForward,
  HardDrive,
  Check,
} from "lucide-react";
import AudioPlayer from "./AudioPlayer";
import UploadForm from "./UploadForm";
import AudioSettings from "./AudioSettings";
import YouTubeInput from "./YouTubeInput";
import TrackQueue from "./TrackQueue";
import SavedLibrary from "./SavedLibrary";
import TrackContextMenu, { ContextMenuState } from "./TrackContextMenu";
import { useAudioQueue, MAX_FILE_SIZE, SUPPORTED_FORMATS } from "@/hooks/useAudioQueue";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AudioProcessingOptions, AudioFileItem, YouTubeTrack } from "@/types";
import {
  DEFAULT_OPTIONS,
  PRESETS,
  process8DAudio,
  audioBufferToMp3,
  float32ToWav,
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

type MobileTab = "player" | "queue" | "add" | "settings";

export default function AudioConverter() {
  const [activeStudioTab, setActiveStudioTab] = useState<"queue" | "add" | "settings">("add");
  const [addMode, setAddMode] = useState<"upload" | "youtube" | "library">("upload");
  const [mobileTab, setMobileTab] = useState<MobileTab>("player");

  const [audioFiles, setAudioFiles] = useState<AudioFileItem[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(0);
  const [options, setOptions] = useState<AudioProcessingOptions>(DEFAULT_OPTIONS);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isShuffle, setIsShuffle] = useState<boolean>(false);
  const [isLooping, setIsLooping] = useState<boolean>(false);
  const [activePlaybackTime, setActivePlaybackTime] = useState<number>(0);
  const [activeTrackDuration, setActiveTrackDuration] = useState<number>(0);
  const playerRef = useRef<{ togglePlay: () => Promise<void> } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Context Menu & Quick Toast State
  const [activeMenu, setActiveMenu] = useState<ContextMenuState | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // YouTube Background Fetch & Ready State (persists across tab switches)
  const [ytState, setYtState] = useState<{
    isFetching: boolean;
    fetchedCount: number;
    title?: string;
  }>({ isFetching: false, fetchedCount: 0 });
  const prevYtFetchingRef = useRef(false);

  const showToast = useCallback((msg: string, duration = 3000) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, duration);
  }, []);

  const handleYouTubeStateChange = useCallback(
    (state: { isFetching: boolean; fetchedCount: number; title?: string }) => {
      if (
        prevYtFetchingRef.current &&
        !state.isFetching &&
        state.fetchedCount > 0 &&
        (activeStudioTab !== "add" || addMode !== "youtube")
      ) {
        showToast(
          `✓ YouTube ready: ${state.title ? `"${state.title.slice(0, 32)}..."` : `${state.fetchedCount} tracks`}. Click "Add Music" to queue!`
        );
      }
      prevYtFetchingRef.current = state.isFetching;
      setYtState(state);
    },
    [activeStudioTab, addMode, showToast]
  );

  // Export / Import & Offline Persistence State
  const [savedLibrary, setSavedLibrary] = useState<SavedTrackRecord[]>([]);
  const [storageQuota, setStorageQuota] = useState<StorageQuotaInfo | null>(null);
  const [isExportingPack, setIsExportingPack] = useState<boolean>(false);
  const [isImportingPack, setIsImportingPack] = useState<boolean>(false);

  const createdUrlsRef = useRef<string[]>([]);
  const wavBlobsRef = useRef<Map<string, Blob>>(new Map());
  const originalBlobsRef = useRef<Map<string, Blob>>(new Map());
  const packFileInputRef = useRef<HTMLInputElement>(null);
  const isHydratedRef = useRef<boolean>(false);

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

                let originalUrl = "";
                if (saved.originalBlob) {
                  originalUrl = registerUrl(URL.createObjectURL(saved.originalBlob));
                  originalBlobsRef.current.set(item.id, saved.originalBlob);
                } else if (item.sourceUrl && (item.sourceUrl.includes("youtube.com") || item.sourceUrl.includes("youtu.be"))) {
                  originalUrl = `/api/youtube/stream?url=${encodeURIComponent(item.sourceUrl)}`;
                }

                restored.push({
                  id: item.id,
                  name: item.name,
                  artist: item.artist || "8D Audio Master",
                  thumbnail: item.thumbnail,
                  size: saved.size,
                  originalUrl: originalUrl || audioUrl,
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

              let originalUrl = "";
              if (record.originalBlob) {
                originalUrl = registerUrl(URL.createObjectURL(record.originalBlob));
                originalBlobsRef.current.set(record.id, record.originalBlob);
              } else if (record.sourceUrl && (record.sourceUrl.includes("youtube.com") || record.sourceUrl.includes("youtu.be"))) {
                originalUrl = `/api/youtube/stream?url=${encodeURIComponent(record.sourceUrl)}`;
              }

              return {
                id: record.id,
                name: record.name,
                artist: record.artist || "8D Audio Master",
                thumbnail: record.thumbnail,
                size: record.size,
                originalUrl: originalUrl || audioUrl,
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

  // Core background queue runner hook: concurrency, WakeLock, audio decoding, 8D DSP & export
  const {
    isWakeLocked,
    isQueuePaused,
    circuitBreakerNotice,
    togglePauseQueue,
    resumeQueue,
    retryTrack,
    retryAllFailed,
  } = useAudioQueue({
    audioFiles,
    setAudioFiles,
    options,
    registerUrl,
    refreshSavedLibrary,
    wavBlobsRef,
    originalBlobsRef,
  });

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
    retryTrack(id);
  };

  const handleRetryAllFailed = () => {
    setError(null);
    retryAllFailed();
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
    wavBlobsRef.current.set(record.id, record.blob);

    let originalUrl = "";
    if (record.originalBlob) {
      originalUrl = registerUrl(URL.createObjectURL(record.originalBlob));
      originalBlobsRef.current.set(record.id, record.originalBlob);
    } else if (record.sourceUrl && (record.sourceUrl.includes("youtube.com") || record.sourceUrl.includes("youtu.be"))) {
      originalUrl = `/api/youtube/stream?url=${encodeURIComponent(record.sourceUrl)}`;
    }

    const newItem: AudioFileItem = {
      id: `saved-${record.id}-${Date.now()}`,
      name: record.name,
      artist: record.artist || "Saved 8D Master",
      thumbnail: record.thumbnail,
      size: record.size,
      originalUrl: originalUrl || audioUrl,
      convertedUrl: audioUrl,
      status: "complete",
      progress: 100,
      sourceType: record.sourceType || "upload",
      sourceUrl: record.sourceUrl,
      addedAt: record.savedAt,
    };

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
      const ext = options.exportQuality === "wav" ? "wav" : "mp3";
      link.download = `${cleanTitle}_8D_Spatial.${ext}`;
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
                originalSrc={
                  activeTrack.originalUrl && activeTrack.originalUrl !== activeTrack.convertedUrl
                    ? activeTrack.originalUrl
                    : originalBlobsRef.current.get(activeTrack.id)
                    ? registerUrl(URL.createObjectURL(originalBlobsRef.current.get(activeTrack.id)!))
                    : activeTrack.sourceUrl && (activeTrack.sourceUrl.includes("youtube.com") || activeTrack.sourceUrl.includes("youtu.be"))
                    ? `/api/youtube/stream?url=${encodeURIComponent(activeTrack.sourceUrl)}`
                    : activeTrack.rawBuffer
                    ? registerUrl(URL.createObjectURL(float32ToWav(activeTrack.rawBuffer)))
                    : undefined
                }
                title={activeTrack.name}
                artist={activeTrack.artist || "8D Audio Master"}
                thumbnail={activeTrack.thumbnail}
                sourceUrl={getYouTubeUrl(activeTrack) || activeTrack.sourceUrl}
                onCopySourceUrl={(url) => copyToClipboard(url, "YouTube link")}
                is8DReady={!!activeTrack.convertedUrl}
                options={options}
                playerRef={playerRef}
                onDurationChange={setActiveTrackDuration}
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
                      setMobileTab("add");
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
        <div className={`space-y-4 lg:col-span-6 ${mobileTab !== "player" ? "block" : "hidden lg:block"}`}>
          <div className="flex items-center justify-between p-1.5 bg-slate-900/90 border border-slate-800 rounded-2xl">
            <button
              type="button"
              onClick={() => {
                setActiveStudioTab("queue");
                setMobileTab("queue");
              }}
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
              onClick={() => {
                setActiveStudioTab("add");
                setMobileTab("add");
              }}
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
              onClick={() => {
                setActiveStudioTab("settings");
                setMobileTab("settings");
              }}
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
          <div className={activeStudioTab === "queue" ? "block" : "hidden"}>
            <TrackQueue
              audioFiles={audioFiles}
              currentTrackIndex={currentTrackIndex}
              isPlaying={isPlaying}
              isWakeLocked={isWakeLocked}
              isExportingPack={isExportingPack}
              isQueuePaused={isQueuePaused}
              circuitBreakerNotice={circuitBreakerNotice}
              onTogglePauseQueue={togglePauseQueue}
              onResumeQueue={resumeQueue}
              activeMenuTrackId={activeMenu?.item.id}
              onSelectTrack={(index) => {
                setCurrentTrackIndex(index);
                setMobileTab("player");
              }}
              onRetryAllFailed={handleRetryAllFailed}
              onExportPack={handleExportPack}
              onLoadDemoTrack={handleLoadDemoTrack}
              onClearAll={async () => {
                setAudioFiles([]);
                setCurrentTrackIndex(0);
                clearQueueManifest();
                await clearAllSavedTracks();
                await refreshSavedLibrary();
              }}
              onGoToAddMusic={() => setActiveStudioTab("add")}
              onRetryTrack={handleRetryTrack}
              onDownload={handleDownload}
              onReconvert={handleReconvert}
              onRemoveTrack={removeTrack}
              onOpenMenu={handleOpenMenu}
              onCopyUrl={(url, label) => copyToClipboard(url, label)}
            />
          </div>

          {/* TAB 2: ADD MUSIC */}
          <div className={activeStudioTab === "add" ? "block" : "hidden"}>
            <div className="bg-slate-950/80 border border-slate-800/80 rounded-3xl shadow-2xl backdrop-blur-xl overflow-hidden">
              {/* Hidden file input for .8dpack import */}
              <input
                ref={packFileInputRef}
                type="file"
                accept=".8dpack"
                className="hidden"
                onChange={handleImportPackFile}
              />

              {/* ── Sub-mode tab strip ── */}
              <div className="flex border-b border-slate-800/80">
                {[
                  { key: "upload", icon: <Upload className="w-3.5 h-3.5" />, label: "Upload Files", shortLabel: "Upload", accent: "cyan" },
                  { key: "youtube", icon: <Youtube className="w-3.5 h-3.5" />, label: "YouTube / Playlist", shortLabel: "YouTube", accent: "red" },
                  { key: "library", icon: <HardDrive className="w-3.5 h-3.5" />, label: "Saved Library", shortLabel: "Library", accent: "purple" },
                ].map(({ key, icon, label, shortLabel, accent }) => {
                  const isActive = addMode === key;
                  const accentMap: Record<string, string> = {
                    cyan: "text-cyan-300 border-b-2 border-cyan-400 bg-cyan-500/5",
                    red:  "text-red-300 border-b-2 border-red-400 bg-red-500/5",
                    purple: "text-purple-300 border-b-2 border-purple-400 bg-purple-500/5",
                  };
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setAddMode(key as "upload" | "youtube" | "library")}
                      className={`flex-1 py-3.5 px-3 flex items-center justify-center gap-2 text-xs font-semibold transition-all ${
                        isActive
                          ? accentMap[accent]
                          : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/40"
                      }`}
                    >
                      <span className={isActive ? "" : "opacity-60"}>{icon}</span>
                      <span className="hidden sm:inline">{label}</span>
                      <span className="sm:hidden">{shortLabel}</span>
                      {key === "library" && savedLibrary.length > 0 && (
                        <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-purple-500/25 text-purple-200 text-[10px] font-mono leading-none">
                          {savedLibrary.length}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* ── Tab content ── */}
              <div className="p-4 sm:p-5 space-y-4">
                {/* ── Submode 1: Upload Files ── */}
                <div className={addMode === "upload" ? "block" : "hidden"}>
                  <UploadForm
                    onUpload={handleFileUpload}
                    isConverting={isConvertingAny}
                    maxFileSize={MAX_FILE_SIZE}
                    supportedFormats={SUPPORTED_FORMATS}
                  />
                </div>

                {/* ── Submode 2: YouTube / Playlist (Persists while fetching and after fetching) ── */}
                <div className={addMode === "youtube" ? "block" : "hidden"}>
                  <YouTubeInput
                    onConvertTrack={handleConvertYouTubeTrack}
                    onConvertBatch={handleConvertYouTubeBatch}
                    isConverting={isConvertingAny}
                    onStateChange={handleYouTubeStateChange}
                  />
                </div>

                {/* ── Submode 3: Offline Saved Library ── */}
                <div className={addMode === "library" ? "block space-y-3" : "hidden"}>
                  <SavedLibrary
                    savedLibrary={savedLibrary}
                    storageQuota={storageQuota}
                    isImportingPack={isImportingPack}
                    onImportClick={() => packFileInputRef.current?.click()}
                    onLoadAll={handleLoadAllSavedTracks}
                    onClearAll={async () => {
                      await clearAllSavedTracks();
                      await refreshSavedLibrary();
                    }}
                    onLoadTrack={handleLoadSavedTrack}
                    onDeleteTrack={handleDeleteSavedTrack}
                    onCopyUrl={(url, label) => copyToClipboard(url, label)}
                  />
                </div>

                {/* ── Demo Song callout ── */}
                <div className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-gradient-to-r from-cyan-950/40 via-slate-900/50 to-purple-950/40 border border-slate-800/60">
                  <div className="space-y-0.5 min-w-0">
                    <h4 className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                      No audio file handy?
                    </h4>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Instantly synthesize a chill ambient 8D track in your browser.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleLoadDemoTrack}
                    className="flex-shrink-0 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30 transition-all"
                  >
                    Try Demo Song
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* TAB 3: 8D TUNING STUDIO */}
          <div className={activeStudioTab === "settings" ? "block" : "hidden"}>
            <div className="space-y-3">
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
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 hover:from-cyan-400 hover:via-blue-400 hover:to-purple-500 disabled:opacity-40 text-white text-sm font-bold rounded-2xl shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30 transition-all flex items-center justify-center gap-2.5"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Re-render Current Track with These Settings</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Floating Context / 3-Dots Menu ── */}
      <TrackContextMenu
        activeMenu={activeMenu}
        menuRef={menuRef}
        onClose={() => setActiveMenu(null)}
        onCopy={(text, label) => copyToClipboard(text, label)}
        onDownload={handleDownload}
        onReconvert={handleReconvert}
        onRetry={handleRetryTrack}
        onRemove={removeTrack}
      />

      {/* ── Persistent Floating Mini-Player on Mobile ── */}
      {activeTrack && mobileTab !== "player" && (
        <div className="lg:hidden fixed bottom-[68px] inset-x-2 z-40 bg-slate-950/95 border border-slate-800/90 rounded-2xl shadow-2xl backdrop-blur-xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
          {/* Top Thin Audio Scrub/Progress Line */}
          <div className="w-full h-1 bg-slate-800">
            <div
              className="h-full bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 transition-all duration-150"
              style={{
                width: `${
                  activeTrackDuration > 0
                    ? Math.min(100, Math.max(0, (activePlaybackTime / activeTrackDuration) * 100))
                    : 0
                }%`,
              }}
            />
          </div>

          <div className="p-2 flex items-center justify-between gap-3">
            {/* Clickable Track Info (Tapping returns to 360° Player) */}
            <div
              onClick={() => setMobileTab("player")}
              className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
            >
              <div className="relative w-10 h-10 rounded-xl overflow-hidden bg-slate-800 border border-slate-700/60 shrink-0 flex items-center justify-center">
                {activeTrack.thumbnail ? (
                  <img
                    src={activeTrack.thumbnail}
                    alt={activeTrack.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Headphones className="w-5 h-5 text-cyan-400" />
                )}
                {isPlaying && (
                  <div className="absolute inset-0 bg-cyan-950/40 flex items-center justify-center">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <span className="text-xs font-semibold text-white truncate block">
                  {activeTrack.name}
                </span>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
                  <span className="text-cyan-400 font-bold">
                    {activeTrack.status === "complete" ? "8D ACTIVE" : "ORIGINAL"}
                  </span>
                  <span>•</span>
                  <span>Tap for 360° Deck</span>
                </div>
              </div>
            </div>

            {/* Quick Transport Controls */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => playerRef.current?.togglePlay()}
                className="w-10 h-10 rounded-xl bg-cyan-500 hover:bg-cyan-400 active:scale-95 text-slate-950 flex items-center justify-center transition-all shadow-md shadow-cyan-500/20 touch-manipulation"
                title={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5 fill-current" />
                ) : (
                  <Play className="w-5 h-5 fill-current ml-0.5" />
                )}
              </button>

              <button
                type="button"
                onClick={() => handleNextTrack(true)}
                className="w-10 h-10 rounded-xl hover:bg-slate-800 active:scale-95 text-slate-300 hover:text-white flex items-center justify-center transition-all touch-manipulation"
                title="Next Track"
              >
                <SkipForward className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Fixed Bottom Navigation Bar on Mobile ── */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-slate-950/95 backdrop-blur-xl border-t border-slate-800/80 px-2 py-1.5 flex items-center justify-around shadow-2xl safe-area-pb">
        {/* Tab 1: 360° Player */}
        <button
          type="button"
          onClick={() => setMobileTab("player")}
          className={`flex-1 py-1.5 flex flex-col items-center justify-center rounded-xl transition-all touch-manipulation ${
            mobileTab === "player"
              ? "text-cyan-400 font-bold"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <div className="relative">
            <Headphones className="w-5 h-5" />
            {isPlaying && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            )}
          </div>
          <span className="text-[10px] mt-0.5 tracking-tight">Player</span>
        </button>

        {/* Tab 2: Queue */}
        <button
          type="button"
          onClick={() => {
            setMobileTab("queue");
            setActiveStudioTab("queue");
          }}
          className={`flex-1 py-1.5 flex flex-col items-center justify-center rounded-xl transition-all touch-manipulation ${
            mobileTab === "queue"
              ? "text-cyan-400 font-bold"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <div className="relative">
            <ListMusic className="w-5 h-5" />
            {audioFiles.length > 0 && (
              <span className="absolute -top-1 -right-2 px-1 py-0.2 min-w-[14px] text-center rounded-full bg-cyan-500 text-slate-950 text-[9px] font-mono font-bold leading-tight">
                {audioFiles.length}
              </span>
            )}
          </div>
          <span className="text-[10px] mt-0.5 tracking-tight">Queue</span>
        </button>

        {/* Tab 3: Add Music */}
        <button
          type="button"
          onClick={() => {
            setMobileTab("add");
            setActiveStudioTab("add");
          }}
          className={`flex-1 py-1.5 flex flex-col items-center justify-center rounded-xl transition-all touch-manipulation ${
            mobileTab === "add"
              ? "text-cyan-400 font-bold"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <div className="relative">
            <Plus className="w-5 h-5" />
            {ytState.isFetching && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            )}
          </div>
          <span className="text-[10px] mt-0.5 tracking-tight">Add Music</span>
        </button>

        {/* Tab 4: 8D Tuning */}
        <button
          type="button"
          onClick={() => {
            setMobileTab("settings");
            setActiveStudioTab("settings");
          }}
          className={`flex-1 py-1.5 flex flex-col items-center justify-center rounded-xl transition-all touch-manipulation ${
            mobileTab === "settings"
              ? "text-cyan-400 font-bold"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Sliders className="w-5 h-5" />
          <span className="text-[10px] mt-0.5 tracking-tight">8D Tuning</span>
        </button>
      </nav>

      {/* ── Sleek Bottom Toast Notification ── */}
      {toastMessage && (
        <div className="fixed bottom-24 lg:bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 border border-cyan-500/40 px-4 py-2.5 rounded-2xl shadow-2xl backdrop-blur-xl flex items-center gap-2.5 text-xs font-semibold text-slate-100 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <Check className="w-3 h-3 stroke-[2.5]" />
          </div>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
