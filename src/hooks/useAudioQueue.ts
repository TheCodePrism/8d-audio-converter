"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { AudioFileItem, AudioProcessingOptions } from "@/types";
import {
  process8DAudio,
  float32ToWav,
  audioBufferToMp3,
  generateDemoAudioBuffer,
} from "@/lib/audioProcessing";
import { saveTrackToStorage, SavedTrackRecord } from "@/lib/storage";

export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
export const SUPPORTED_FORMATS = [
  "audio/mp3",
  "audio/wav",
  "audio/mpeg",
  "audio/ogg",
  "audio/m4a",
  "audio/x-m4a",
  "audio/flac",
];

const CONVERSION_TIMEOUT_MS = 55000; // 55 seconds timeout to prevent stalled conversions

interface UseAudioQueueParams {
  audioFiles: AudioFileItem[];
  setAudioFiles: React.Dispatch<React.SetStateAction<AudioFileItem[]>>;
  options: AudioProcessingOptions;
  registerUrl: (url: string) => string;
  refreshSavedLibrary: () => Promise<SavedTrackRecord[]>;
  wavBlobsRef: React.MutableRefObject<Map<string, Blob>>;
}

export function useAudioQueue({
  audioFiles,
  setAudioFiles,
  options,
  registerUrl,
  refreshSavedLibrary,
  wavBlobsRef,
}: UseAudioQueueParams) {
  const [isWakeLocked, setIsWakeLocked] = useState<boolean>(false);
  const wakeLockRef = useRef<any>(null);

  // Concurrency & Cancellation tracking
  const activeConvertingIdsRef = useRef<Set<string>>(new Set());
  const activeRunIdsRef = useRef<Map<string, number>>(new Map());
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());

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

  // Monotonic progress update: progress percentage never jumps backward during conversion
  const updateItemProgress = useCallback(
    (id: string, percent: number, stage?: string, runId?: number) => {
      if (runId !== undefined && activeRunIdsRef.current.get(id) !== runId) {
        return; // Stale run update
      }
      setAudioFiles((prev) =>
        prev.map((f) =>
          f.id === id
            ? {
                ...f,
                progress: Math.max(f.progress || 0, Math.min(100, percent)),
                ...(stage ? { stage } : {}),
              }
            : f
        )
      );
    },
    [setAudioFiles]
  );

  // --- Queue Worker Core Processing ---
  const processQueueItem = useCallback(
    async (item: AudioFileItem) => {
      // 1. Establish new runId & abort controller for this specific attempt
      const runId = (activeRunIdsRef.current.get(item.id) || 0) + 1;
      activeRunIdsRef.current.set(item.id, runId);

      // Abort previous controller if any
      const oldCtrl = abortControllersRef.current.get(item.id);
      if (oldCtrl) {
        try {
          oldCtrl.abort();
        } catch {}
      }

      const abortController = new AbortController();
      abortControllersRef.current.set(item.id, abortController);

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

      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutTimer = setTimeout(() => {
            abortController.abort();
            reject(
              new Error("Conversion timed out (stalled for >55s).")
            );
          }, CONVERSION_TIMEOUT_MS);
        });

        const doConversion = async () => {
          let decodedBuffer: AudioBuffer;
          let originalUrl = item.originalUrl;

          if (item.sourceType === "upload" && item.file) {
            updateItemProgress(item.id, 20, "Reading local audio file...", runId);
            const validationError = validateFile(item.file);
            if (validationError) throw new Error(validationError);

            const arrayBuffer = await item.file.arrayBuffer();
            if (activeRunIdsRef.current.get(item.id) !== runId) return;

            updateItemProgress(item.id, 45, "Decoding audio waveform (PCM)...", runId);

            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            audioContext = new AudioCtx();
            decodedBuffer = await audioContext.decodeAudioData(arrayBuffer);
          } else if (item.sourceType === "youtube") {
            updateItemProgress(item.id, 20, "Connecting to audio stream...", runId);
            const ytUrl = item.sourceUrl || item.originalUrl;
            if (!ytUrl) throw new Error("Missing YouTube source URL.");

            const streamRes = await fetch(
              `/api/youtube/stream?url=${encodeURIComponent(ytUrl)}`,
              { signal: abortController.signal }
            );

            if (activeRunIdsRef.current.get(item.id) !== runId) return;

            if (!streamRes.ok) {
              let errMsg = "Failed to download YouTube audio stream.";
              if (
                streamRes.status === 502 ||
                streamRes.status === 503 ||
                streamRes.status === 504
              ) {
                errMsg = "YouTube service is waking up or temporarily unavailable. Please retry in a moment.";
              } else if (streamRes.status === 403) {
                errMsg = "YouTube blocked audio streaming for this track (datacenter checkpoint).";
              } else {
                try {
                  const text = await streamRes.text();
                  try {
                    const parsed = JSON.parse(text);
                    if (parsed.error) errMsg = parsed.error;
                  } catch {
                    if (text && text.length < 200) errMsg = text;
                  }
                } catch {}
              }
              throw new Error(errMsg);
            }

            updateItemProgress(item.id, 40, "Downloading audio stream chunks...", runId);
            const contentType = streamRes.headers.get("content-type") || "";
            const audioBlob = await streamRes.blob();

            if (activeRunIdsRef.current.get(item.id) !== runId) return;

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

            if (activeRunIdsRef.current.get(item.id) !== runId) return;

            updateItemProgress(item.id, 60, "Decoding audio waveform (PCM)...", runId);
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            audioContext = new AudioCtx();
            try {
              decodedBuffer = await audioContext.decodeAudioData(arrayBuffer);
            } catch {
              throw new Error(
                "Unable to decode audio data. The audio stream may be corrupt or encoded in an unsupported format."
              );
            }
          } else if (item.sourceType === "demo") {
            updateItemProgress(item.id, 40, "Synthesizing demo audio...", runId);
            decodedBuffer = generateDemoAudioBuffer(44100, 16);
            const rawWavBlob = float32ToWav(decodedBuffer);
            originalUrl = registerUrl(URL.createObjectURL(rawWavBlob));
          } else {
            throw new Error("Unknown source type for conversion.");
          }

          if (activeRunIdsRef.current.get(item.id) !== runId) return;

          updateItemProgress(item.id, 75, "Rendering 360° HRTF & spatial reverb...", runId);
          const processedBuffer = await process8DAudio(decodedBuffer, options);

          if (activeRunIdsRef.current.get(item.id) !== runId) return;

          const bitrate = options.exportQuality === "320" ? 320 : 192;
          updateItemProgress(item.id, 85, `Mastering studio MP3 (${bitrate} kbps)...`, runId);

          const wavBlob = await audioBufferToMp3(processedBuffer, bitrate, (pct) =>
            updateItemProgress(
              item.id,
              pct,
              `Mastering studio MP3 (${pct}%)...`,
              runId
            )
          );

          if (activeRunIdsRef.current.get(item.id) !== runId) return;

          const convertedUrl = registerUrl(URL.createObjectURL(wavBlob));
          wavBlobsRef.current.set(item.id, wavBlob);

          // Auto-save to persistent browser storage
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
        };

        await Promise.race([doConversion(), timeoutPromise]);
      } catch (err: any) {
        // If aborted or this run has been superseded by a newer run / retry, DO NOT overwrite state!
        if (activeRunIdsRef.current.get(item.id) !== runId) {
          return;
        }

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
      } finally {
        if (timeoutTimer) clearTimeout(timeoutTimer);
        abortControllersRef.current.delete(item.id);
        if (audioContext && audioContext.state !== "closed") {
          try {
            await audioContext.close();
          } catch {}
        }
      }
    },
    [options, registerUrl, updateItemProgress, refreshSavedLibrary, setAudioFiles, wavBlobsRef]
  );

  // Background Parallel Queue Runner:
  // Dynamically launches up to options.concurrency (default 2) conversions in parallel.
  // Processes pending tracks cleanly without disruptive auto-retry loops.
  useEffect(() => {
    const maxConcurrency = options.concurrency || 2;
    const convertingTracks = audioFiles.filter((f) => f.status === "converting");
    const activeCount = convertingTracks.length;
    const availableSlots = maxConcurrency - activeCount;

    if (availableSlots <= 0) return;

    // Launch up to availableSlots pending tracks in parallel
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
    }
  }, [audioFiles, options.concurrency, processQueueItem]);

  // Synchronized Manual Retry Handler for individual tracks
  const retryTrack = useCallback(
    (id: string) => {
      // 1. Abort existing run if active
      const existingController = abortControllersRef.current.get(id);
      if (existingController) {
        try {
          existingController.abort();
        } catch {}
        abortControllersRef.current.delete(id);
      }

      // 2. Invalidate previous runId so stale callbacks are discarded
      const nextRunId = (activeRunIdsRef.current.get(id) || 0) + 1;
      activeRunIdsRef.current.set(id, nextRunId);

      // 3. Clear from active set so worker immediately picks it up
      activeConvertingIdsRef.current.delete(id);

      // 4. Mark track as pending
      setAudioFiles((prev) =>
        prev.map((f) =>
          f.id === id
            ? {
                ...f,
                status: "pending",
                progress: 0,
                stage: "Queued for conversion...",
                error: undefined,
                errorDetails: undefined,
                retryCount: (f.retryCount || 0) + 1,
              }
            : f
        )
      );
    },
    [setAudioFiles]
  );

  // Synchronized Manual Retry Handler for all failed tracks
  const retryAllFailed = useCallback(() => {
    setAudioFiles((prev) =>
      prev.map((f) => {
        if (f.status === "error") {
          const existingController = abortControllersRef.current.get(f.id);
          if (existingController) {
            try {
              existingController.abort();
            } catch {}
            abortControllersRef.current.delete(f.id);
          }
          const nextRunId = (activeRunIdsRef.current.get(f.id) || 0) + 1;
          activeRunIdsRef.current.set(f.id, nextRunId);
          activeConvertingIdsRef.current.delete(f.id);

          return {
            ...f,
            status: "pending",
            progress: 0,
            stage: "Queued for conversion...",
            error: undefined,
            errorDetails: undefined,
            retryCount: (f.retryCount || 0) + 1,
          };
        }
        return f;
      })
    );
  }, [setAudioFiles]);

  return {
    isWakeLocked,
    processQueueItem,
    retryTrack,
    retryAllFailed,
  };
}
