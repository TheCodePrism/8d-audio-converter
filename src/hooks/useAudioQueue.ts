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
const MAX_AUTO_RETRIES = 2;

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
  const activeConvertingIdsRef = useRef<Set<string>>(new Set());
  const hasNewSuccessRef = useRef<boolean>(false);

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
    [setAudioFiles]
  );

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
            } catch {
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
      } finally {
        if (timeoutTimer) clearTimeout(timeoutTimer);
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
  }, [audioFiles, options.concurrency, processQueueItem, setAudioFiles]);

  return {
    isWakeLocked,
    processQueueItem,
  };
}
