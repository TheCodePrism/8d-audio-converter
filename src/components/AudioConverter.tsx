"use client";

import { useState, useEffect, useRef } from "react";
import { Download, AlertCircle, X, Sparkles, RefreshCw } from "lucide-react";
import AudioPlayer from "./AudioPlayer";
import UploadForm from "./UploadForm";
import AudioSettings from "./AudioSettings";
import OrbitVisualizer from "./OrbitVisualizer";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AudioProcessingOptions } from "@/types";
import {
  DEFAULT_OPTIONS,
  process8DAudio,
  float32ToWav,
} from "@/lib/audioProcessing";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const SUPPORTED_FORMATS = [
  "audio/mp3",
  "audio/wav",
  "audio/mpeg",
  "audio/ogg",
  "audio/m4a",
  "audio/x-m4a",
];

interface ConversionProgress {
  status: "idle" | "reading" | "decoding" | "processing" | "encoding" | "complete";
  percent: number;
}

interface AudioFile {
  file: File;
  originalUrl: string;
  convertedUrl?: string;
  status: "pending" | "converting" | "complete" | "error";
  error?: string;
}

export default function AudioConverter() {
  const [audioFiles, setAudioFiles] = useState<AudioFile[]>([]);
  const [options, setOptions] = useState<AudioProcessingOptions>(DEFAULT_OPTIONS);
  const [progress, setProgress] = useState<ConversionProgress>({
    status: "idle",
    percent: 0,
  });
  const [error, setError] = useState<string | null>(null);

  // Playback state tracking for orbit radar visualizer
  const [playingFileIndex, setPlayingFileIndex] = useState<number | null>(null);
  const [activePlaybackTime, setActivePlaybackTime] = useState<number>(0);

  // Keep ref to all created object URLs to prevent memory leaks on unmount
  const createdUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    const urls = createdUrlsRef.current;
    return () => {
      // Cleanup all object URLs when component unmounts
      urls.forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch {}
      });
    };
  }, []);

  const registerUrl = (url: string) => {
    createdUrlsRef.current.push(url);
    return url;
  };

  const validateFile = (file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) {
      return `File size exceeds the ${MAX_FILE_SIZE / 1024 / 1024}MB limit`;
    }
    const isSupported =
      SUPPORTED_FORMATS.includes(file.type) ||
      file.name.match(/\.(mp3|wav|ogg|m4a)$/i);
    if (!isSupported) {
      return "Unsupported file format. Please upload MP3, WAV, or OGG files.";
    }
    return null;
  };

  const handleFileUpload = async (files: File[]) => {
    setError(null);
    const newFiles: AudioFile[] = files.map((file) => ({
      file,
      originalUrl: registerUrl(URL.createObjectURL(file)),
      status: "pending",
    }));

    setAudioFiles((prev) => [...prev, ...newFiles]);

    for (let i = 0; i < newFiles.length; i++) {
      const current = newFiles[i];
      const validationError = validateFile(current.file);

      if (validationError) {
        setAudioFiles((prev) =>
          prev.map((f) =>
            f.file === current.file
              ? { ...f, status: "error", error: validationError }
              : f
          )
        );
        continue;
      }

      await runConversion(current.file, i);
    }
  };

  const runConversion = async (file: File, index: number) => {
    setAudioFiles((prev) =>
      prev.map((f, i) => (i === index ? { ...f, status: "converting", error: undefined } : f))
    );

    let audioContext: AudioContext | null = null;

    try {
      setProgress({ status: "reading", percent: 15 });
      const arrayBuffer = await file.arrayBuffer();

      setProgress({ status: "decoding", percent: 35 });
      const AudioCtx =
        window.AudioContext || (window as any).webkitAudioContext;
      audioContext = new AudioCtx();
      const decodedBuffer = await audioContext.decodeAudioData(arrayBuffer);

      setProgress({ status: "processing", percent: 65 });
      const processedBuffer = await process8DAudio(decodedBuffer, options);

      setProgress({ status: "encoding", percent: 88 });
      const wavBlob = float32ToWav(processedBuffer);
      const convertedUrl = registerUrl(URL.createObjectURL(wavBlob));

      setAudioFiles((prev) =>
        prev.map((f, i) =>
          i === index ? { ...f, convertedUrl, status: "complete" } : f
        )
      );
      setProgress({ status: "complete", percent: 100 });
    } catch (err: any) {
      console.error("Audio conversion failed:", err);
      const msg =
        err?.message ||
        "Could not convert audio. Please ensure the file is a valid audio track.";
      setAudioFiles((prev) =>
        prev.map((f, i) =>
          i === index ? { ...f, status: "error", error: msg } : f
        )
      );
      setError(msg);
    } finally {
      if (audioContext && audioContext.state !== "closed") {
        try {
          await audioContext.close();
        } catch {}
      }
    }
  };

  const handleReconvert = async (index: number) => {
    const target = audioFiles[index];
    if (!target) return;
    if (target.convertedUrl) {
      try {
        URL.revokeObjectURL(target.convertedUrl);
      } catch {}
    }
    await runConversion(target.file, index);
  };

  const handleDownload = (convertedUrl: string, originalFileName: string) => {
    try {
      const link = document.createElement("a");
      link.href = convertedUrl;
      const baseName = originalFileName.replace(/\.[^/.]+$/, "");
      link.download = `${baseName}_8D.wav`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Download error:", err);
      setError("Failed to download file. Please try again.");
    }
  };

  const removeFile = (index: number) => {
    setAudioFiles((prev) => {
      const target = prev[index];
      if (target) {
        if (target.originalUrl) URL.revokeObjectURL(target.originalUrl);
        if (target.convertedUrl) URL.revokeObjectURL(target.convertedUrl);
      }
      return prev.filter((_, i) => i !== index);
    });
    if (playingFileIndex === index) {
      setPlayingFileIndex(null);
    }
  };

  const isConvertingAny = audioFiles.some((f) => f.status === "converting");

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-6 sm:p-8 max-w-4xl mx-auto">
      {/* Settings & Presets Drawer */}
      <AudioSettings
        options={options}
        onChange={setOptions}
        disabled={isConvertingAny}
      />

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-5 w-5" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Upload Dropzone */}
      {audioFiles.length === 0 && (
        <UploadForm
          onUpload={handleFileUpload}
          isConverting={isConvertingAny}
          maxFileSize={MAX_FILE_SIZE}
          supportedFormats={SUPPORTED_FORMATS}
        />
      )}

      {/* File Processing & Results List */}
      {audioFiles.length > 0 && (
        <div className="space-y-8">
          {audioFiles.map((audioFile, index) => {
            const isThisPlaying = playingFileIndex === index;

            return (
              <div
                key={index}
                className="bg-slate-50 border border-slate-200 rounded-2xl p-5 sm:p-6 relative transition-all shadow-sm"
              >
                {/* Remove File Button */}
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  className="absolute top-4 right-4 p-1.5 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-700 transition-colors"
                  title="Remove file"
                  aria-label="Remove audio file"
                >
                  <X className="h-4 w-4" />
                </button>

                {/* File Title & Size */}
                <div className="mb-5 pr-8">
                  <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                    {audioFile.file.name}
                    {audioFile.status === "complete" && (
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        8D Ready
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    {(audioFile.file.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>

                {/* Progress Bar */}
                {audioFile.status === "converting" && (
                  <div className="mb-6 p-4 bg-white rounded-xl border border-blue-100 shadow-sm space-y-2">
                    <div className="flex justify-between text-xs font-medium text-slate-600">
                      <span className="capitalize">
                        {progress.status === "reading" && "Reading audio data..."}
                        {progress.status === "decoding" && "Decoding waveform..."}
                        {progress.status === "processing" && "Applying 3D HRTF rotation & spatial reverb..."}
                        {progress.status === "encoding" && "Encoding 16-bit PCM stereo WAV..."}
                        {progress.status === "complete" && "Completed!"}
                      </span>
                      <span className="font-mono text-blue-600 font-bold">
                        {progress.percent}%
                      </span>
                    </div>
                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-300 rounded-full"
                        style={{ width: `${progress.percent}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Error Banner */}
                {audioFile.status === "error" && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{audioFile.error}</AlertDescription>
                  </Alert>
                )}

                {/* Interactive 3D Visualizer & 8D Audio Player */}
                {audioFile.status === "complete" && audioFile.convertedUrl && (
                  <div className="space-y-6">
                    {/* 3D Orbit Radar */}
                    <div className="flex justify-center">
                      <OrbitVisualizer
                        isPlaying={isThisPlaying}
                        options={options}
                        currentTime={activePlaybackTime}
                      />
                    </div>

                    {/* 8D Converted Player & Download */}
                    <div className="space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-800">
                            🎧 8D Spatial Audio
                          </span>
                          <span className="text-xs text-blue-600 font-medium">
                            (Wear headphones for 360° effect)
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleReconvert(index)}
                            title="Re-apply updated settings"
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition-colors"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                            <span>Re-apply Settings</span>
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              handleDownload(
                                audioFile.convertedUrl!,
                                audioFile.file.name
                              )
                            }
                            className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm hover:shadow transition-all"
                          >
                            <Download className="h-4 w-4" />
                            <span>Download 8D WAV</span>
                          </button>
                        </div>
                      </div>

                      <AudioPlayer
                        src={audioFile.convertedUrl}
                        title="Converted 8D Track"
                        onPlayStateChange={(playing) => {
                          if (playing) {
                            setPlayingFileIndex(index);
                          } else if (playingFileIndex === index) {
                            setPlayingFileIndex(null);
                          }
                        }}
                        onTimeUpdate={(t) => {
                          if (playingFileIndex === index) {
                            setActivePlaybackTime(t);
                          }
                        }}
                      />
                    </div>

                    {/* Original Track Preview (A/B Comparison) */}
                    <div className="pt-2 border-t border-slate-200/80">
                      <span className="text-xs font-medium text-slate-500 mb-2 block">
                        Original Flat Audio (A/B Comparison)
                      </span>
                      <AudioPlayer
                        src={audioFile.originalUrl}
                        title="Original Audio"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Action Row */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={() => setAudioFiles([])}
              className="flex-1 py-3 px-4 border border-slate-300 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-colors text-sm"
            >
              Clear & Convert More Files
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
