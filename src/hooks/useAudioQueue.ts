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

const STALL_TIMEOUT_MS = 60000; // Trigger timeout ONLY if stalled for 60s with zero progress
const MAX_CONVERSION_DURATION_MS = 360000; // 6 minutes max safety cap for extra-long tracks

interface UseAudioQueueParams {
  audioFiles: AudioFileItem[];
  setAudioFiles: React.Dispatch<React.SetStateAction<AudioFileItem[]>>;
  options: AudioProcessingOptions;
  registerUrl: (url: string) => string;
  refreshSavedLibrary: () => Promise<SavedTrackRecord[]>;
  wavBlobsRef: React.MutableRefObject<Map<string, Blob>>;
  originalBlobsRef?: React.MutableRefObject<Map<string, Blob>>;
}

export function useAudioQueue({
  audioFiles,
  setAudioFiles,
  options,
  registerUrl,
  refreshSavedLibrary,
  wavBlobsRef,
  originalBlobsRef,
}: UseAudioQueueParams) {
  const [isWakeLocked, setIsWakeLocked] = useState<boolean>(false);
  const wakeLockRef = useRef<any>(null);

  // Queue Circuit-Breaker & Pause Controls
  const [isQueuePaused, setIsQueuePaused] = useState<boolean>(false);
  const [circuitBreakerNotice, setCircuitBreakerNotice] = useState<string | null>(null);
  const consecutiveFailuresRef = useRef<number>(0);

  // Concurrency & Cancellation tracking
  const activeConvertingIdsRef = useRef<Set<string>>(new Set());
  const activeRunIdsRef = useRef<Map<string, number>>(new Map());
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const lastActivityPerTrackRef = useRef<Map<string, number>>(new Map());

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
      // Touch activity timestamp for watchdog
      lastActivityPerTrackRef.current.set(id, Date.now());

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
      let watchdogTimer: NodeJS.Timeout | null = null;

      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          const startTime = Date.now();
          lastActivityPerTrackRef.current.set(item.id, startTime);

          watchdogTimer = setInterval(() => {
            const now = Date.now();
            const lastActivity = lastActivityPerTrackRef.current.get(item.id) || startTime;
            const stallDuration = now - lastActivity;
            const totalElapsed = now - startTime;

            // Trigger ONLY if conversion has completely stalled (no progress for >45s)
            if (stallDuration > STALL_TIMEOUT_MS) {
              if (watchdogTimer) clearInterval(watchdogTimer);
              abortController.abort();
              reject(
                new Error("Conversion stalled (no activity for >45s). Please retry.")
              );
            } else if (totalElapsed > MAX_CONVERSION_DURATION_MS) {
              if (watchdogTimer) clearInterval(watchdogTimer);
              abortController.abort();
              reject(
                new Error("Conversion exceeded maximum allowed duration (6 minutes).")
              );
            }
          }, 2000);
        });

        const doConversion = async () => {
          let decodedBuffer: AudioBuffer;
          let originalUrl = item.originalUrl;
          let originalBlob: Blob | undefined;

          if (item.sourceType === "upload" && item.file) {
            updateItemProgress(item.id, 20, "Reading local audio file...", runId);
            const validationError = validateFile(item.file);
            if (validationError) throw new Error(validationError);

            originalBlob = item.file;
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

            updateItemProgress(item.id, 35, "Connecting & streaming audio...", runId);
            const contentType = streamRes.headers.get("content-type") || "";
            const contentLengthHeader = streamRes.headers.get("content-length");
            const totalBytes = contentLengthHeader ? parseInt(contentLengthHeader, 10) : 0;

            let audioBlob: Blob;
            if (streamRes.body && typeof streamRes.body.getReader === "function") {
              const reader = streamRes.body.getReader();
              const chunks: Uint8Array[] = [];
              let receivedBytes = 0;
              let lastReportTime = Date.now();

              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                if (activeRunIdsRef.current.get(item.id) !== runId) {
                  try {
                    reader.cancel();
                  } catch {}
                  return;
                }
                if (value) {
                  chunks.push(value);
                  receivedBytes += value.length;
                  // Heartbeat: update watchdog timestamp on every chunk so active streaming never times out
                  lastActivityPerTrackRef.current.set(item.id, Date.now());

                  const now = Date.now();
                  if (now - lastReportTime > 600) {
                    lastReportTime = now;
                    let pct = 35;
                    let msg = `Streaming audio (${(receivedBytes / (1024 * 1024)).toFixed(1)} MB)...`;
                    if (totalBytes > 0) {
                      const fraction = Math.min(1, receivedBytes / totalBytes);
                      pct = Math.round(35 + fraction * 20); // 35% -> 55%
                      msg = `Streaming audio (${Math.round(fraction * 100)}% • ${(receivedBytes / (1024 * 1024)).toFixed(1)} MB)...`;
                    }
                    updateItemProgress(item.id, pct, msg, runId);
                  }
                }
              }

              audioBlob = new Blob(chunks, { type: contentType || "audio/mp4" });
            } else {
              audioBlob = await streamRes.blob();
            }
            originalBlob = audioBlob;

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
            originalBlob = rawWavBlob;
            originalUrl = registerUrl(URL.createObjectURL(rawWavBlob));
          } else {
            throw new Error("Unknown source type for conversion.");
          }

          if (activeRunIdsRef.current.get(item.id) !== runId) return;

          // P0-4: DSP error boundary — catch OfflineAudioContext OOM / crash
          let processedBuffer: AudioBuffer;
          let wavBlob: Blob;
          let dspFallbackToWav = false;
          try {
            updateItemProgress(item.id, 75, "Rendering 360° HRTF & spatial reverb...", runId);
            processedBuffer = await process8DAudio(decodedBuffer, options);

            if (activeRunIdsRef.current.get(item.id) !== runId) return;

            if (options.exportQuality === "wav") {
              updateItemProgress(item.id, 85, "Mastering Studio Lossless WAV (16-bit PCM)...", runId);
              wavBlob = float32ToWav(processedBuffer);
            } else {
              const bitrate = options.exportQuality === "320" ? 320 : 192;
              updateItemProgress(item.id, 85, `Mastering studio MP3 (${bitrate} kbps)...`, runId);

              wavBlob = await audioBufferToMp3(processedBuffer, bitrate, (pct) =>
                updateItemProgress(
                  item.id,
                  pct,
                  `Mastering studio MP3 (${pct}%)...`,
                  runId
                )
              );
            }
          } catch (dspErr) {
            const errMsg = dspErr instanceof Error ? dspErr.message : String(dspErr);
            console.error("[8D DSP] Processing failed:", errMsg, dspErr);

            if (decodedBuffer.duration > 300) {
              // Track > 5 min — likely OOM in OfflineAudioContext; fall back to stereo WAV
              dspFallbackToWav = true;
              updateItemProgress(item.id, 85, "Track too large — exporting original WAV...", runId);
              wavBlob = float32ToWav(decodedBuffer);
              processedBuffer = decodedBuffer; // satisfy TS; unused after fallback
            } else {
              throw new Error(
                `8D audio processing failed: ${errMsg}. Please try a shorter or lower-quality track.`
              );
            }
          }

          if (activeRunIdsRef.current.get(item.id) !== runId) return;

          const convertedUrl = registerUrl(URL.createObjectURL(wavBlob));
          wavBlobsRef.current.set(item.id, wavBlob);
          if (originalBlob && originalBlobsRef) {
            originalBlobsRef.current.set(item.id, originalBlob);
          }

          // Auto-save to persistent browser storage
          saveTrackToStorage(item, wavBlob, originalBlob)
            .then(() => refreshSavedLibrary())
            .catch((e) => console.warn("Auto-save to storage failed:", e));

          // Reset circuit-breaker counter on successful track completion
          consecutiveFailuresRef.current = 0;

          setAudioFiles((prev) =>
            prev.map((f) =>
              f.id === item.id
                ? {
                    ...f,
                    originalUrl,
                    convertedUrl,
                    status: "complete",
                    progress: 100,
                    stage: dspFallbackToWav
                      ? "⚠️ WAV fallback — track too large for 8D"
                      : "8D Spatial Master Ready",
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

        // Circuit breaker: track consecutive errors to prevent domino failures across huge queues
        consecutiveFailuresRef.current += 1;
        if (consecutiveFailuresRef.current >= 3) {
          setIsQueuePaused(true);
          setCircuitBreakerNotice(
            "Queue auto-paused: 3 tracks failed consecutively. The cloud streaming proxy may be busy. Click Resume Queue when ready, or try converting tracks individually."
          );
        }

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
        if (watchdogTimer) clearInterval(watchdogTimer);
        lastActivityPerTrackRef.current.delete(item.id);
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
  // Dynamically launches conversions in parallel with queue pacing & cloud instance safeguards
  useEffect(() => {
    if (isQueuePaused) return;

    // Safeguard: Cap concurrency to 1 if any YouTube track is active to protect free-tier cloud instances
    const hasActiveYoutube = audioFiles.some(
      (f) => f.status === "converting" && f.sourceType === "youtube"
    );
    const configuredConcurrency = options.concurrency || 2;
    const maxConcurrency = hasActiveYoutube ? 1 : configuredConcurrency;

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

      // Polite 750ms pacing delay between launching queue items to avoid connection bursts
      const timer = setTimeout(() => {
        if (isQueuePaused) return;
        for (const track of batchToStart) {
          if (activeConvertingIdsRef.current.has(track.id)) continue;
          activeConvertingIdsRef.current.add(track.id);
          processQueueItem(track).finally(() => {
            activeConvertingIdsRef.current.delete(track.id);
          });
        }
      }, 750);

      return () => clearTimeout(timer);
    }
  }, [audioFiles, isQueuePaused, options.concurrency, processQueueItem]);

  // Pause / Resume Queue Controls
  const togglePauseQueue = useCallback(() => {
    setIsQueuePaused((prev) => !prev);
  }, []);

  const resumeQueue = useCallback(() => {
    setIsQueuePaused(false);
    setCircuitBreakerNotice(null);
    consecutiveFailuresRef.current = 0;
  }, []);

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
    setIsQueuePaused(false);
    setCircuitBreakerNotice(null);
    consecutiveFailuresRef.current = 0;

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
    isQueuePaused,
    circuitBreakerNotice,
    togglePauseQueue,
    resumeQueue,
    processQueueItem,
    retryTrack,
    retryAllFailed,
  };
}
