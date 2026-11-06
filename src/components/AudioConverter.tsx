"use client";

import { useState, useEffect, useRef } from "react";
import {
  Download,
  AlertCircle,
  X,
  Sparkles,
  RefreshCw,
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
} from "lucide-react";
import AudioPlayer from "./AudioPlayer";
import UploadForm from "./UploadForm";
import AudioSettings from "./AudioSettings";
import OrbitVisualizer from "./OrbitVisualizer";
import YouTubeInput from "./YouTubeInput";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AudioProcessingOptions, YouTubeTrack } from "@/types";
import {
  DEFAULT_OPTIONS,
  PRESETS,
  process8DAudio,
  float32ToWav,
  generateDemoAudioBuffer,
} from "@/lib/audioProcessing";

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

interface AudioFileItem {
  id: string;
  name: string;
  artist?: string;
  thumbnail?: string;
  size?: number;
  file?: File;
  originalUrl: string;
  convertedUrl?: string;
  status: "pending" | "converting" | "complete" | "error";
  progress?: number;
  error?: string;
  sourceType: "upload" | "youtube" | "demo";
  rawBuffer?: AudioBuffer;
}

export default function AudioConverter() {
  const [activeStudioTab, setActiveStudioTab] = useState<"queue" | "add" | "settings">("add");
  const [addMode, setAddMode] = useState<"upload" | "youtube">("upload");

  const [audioFiles, setAudioFiles] = useState<AudioFileItem[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(0);
  const [options, setOptions] = useState<AudioProcessingOptions>(DEFAULT_OPTIONS);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [activePlaybackTime, setActivePlaybackTime] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  const createdUrlsRef = useRef<string[]>([]);

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

  const registerUrl = (url: string) => {
    createdUrlsRef.current.push(url);
    return url;
  };

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

  // --- 1. Local File Upload Handler ---
  const handleFileUpload = async (files: File[]) => {
    setError(null);
    const newItems: AudioFileItem[] = files.map((file) => ({
      id: `${file.name}-${Date.now()}-${Math.random()}`,
      name: file.name.replace(/\.[^/.]+$/, ""),
      artist: "Local Audio File",
      size: file.size,
      file,
      originalUrl: registerUrl(URL.createObjectURL(file)),
      status: "pending",
      progress: 0,
      sourceType: "upload",
    }));

    setAudioFiles((prev) => {
      const updated = [...prev, ...newItems];
      if (prev.length === 0) {
        setCurrentTrackIndex(0);
      }
      return updated;
    });

    setActiveStudioTab("queue");

    // Automatically convert first uploaded track
    for (const item of newItems) {
      const validationError = validateFile(item.file!);
      if (validationError) {
        setAudioFiles((prev) =>
          prev.map((f) =>
            f.id === item.id ? { ...f, status: "error", error: validationError } : f
          )
        );
        continue;
      }
      await runConversion(item);
    }
  };

  // --- 2. YouTube Track Conversion Handler ---
  const handleConvertYouTubeTrack = async (track: YouTubeTrack) => {
    setError(null);
    const item: AudioFileItem = {
      id: `yt-${track.id}-${Date.now()}`,
      name: track.title,
      artist: track.author || "YouTube Music",
      thumbnail: track.thumbnail,
      originalUrl: "",
      status: "converting",
      progress: 10,
      sourceType: "youtube",
    };

    setAudioFiles((prev) => {
      const updated = [...prev, item];
      // Only set active track if queue was previously empty
      if (prev.length === 0) {
        setCurrentTrackIndex(0);
      }
      return updated;
    });

    setActiveStudioTab("queue");

    let audioContext: AudioContext | null = null;
    try {
      updateItemProgress(item.id, 25);
      const streamRes = await fetch(
        `/api/youtube/stream?url=${encodeURIComponent(track.url)}`
      );

      if (!streamRes.ok) {
        const errJson = await streamRes.json().catch(() => null);
        throw new Error(errJson?.error || "Failed to download YouTube audio stream.");
      }

      updateItemProgress(item.id, 45);
      const audioBlob = await streamRes.blob();
      const originalUrl = registerUrl(URL.createObjectURL(audioBlob));
      const arrayBuffer = await audioBlob.arrayBuffer();

      updateItemProgress(item.id, 65);
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      audioContext = new AudioCtx();
      const decodedBuffer = await audioContext.decodeAudioData(arrayBuffer);

      updateItemProgress(item.id, 85);
      const processedBuffer = await process8DAudio(decodedBuffer, options);

      const wavBlob = float32ToWav(processedBuffer);
      const convertedUrl = registerUrl(URL.createObjectURL(wavBlob));

      setAudioFiles((prev) =>
        prev.map((f) =>
          f.id === item.id
            ? {
                ...f,
                originalUrl,
                convertedUrl,
                status: "complete",
                progress: 100,
                size: wavBlob.size,
                rawBuffer: decodedBuffer,
              }
            : f
        )
      );
    } catch (err: any) {
      console.error("YouTube conversion error:", err);
      const msg = err?.message || "YouTube conversion failed.";
      setAudioFiles((prev) =>
        prev.map((f) =>
          f.id === item.id ? { ...f, status: "error", error: msg } : f
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

  const handleConvertYouTubeBatch = async (tracks: YouTubeTrack[]) => {
    for (const track of tracks) {
      await handleConvertYouTubeTrack(track);
    }
  };

  // --- 3. Instant Demo Track Synthesizer ---
  const handleLoadDemoTrack = async () => {
    setError(null);
    const demoId = `demo-${Date.now()}`;
    const item: AudioFileItem = {
      id: demoId,
      name: "Starlight Neon Dreams (8D Demo)",
      artist: "8D Spatial Synthesizer",
      originalUrl: "",
      status: "converting",
      progress: 20,
      sourceType: "demo",
    };

    setAudioFiles((prev) => {
      const updated = [...prev, item];
      // Only set active track if queue was previously empty
      if (prev.length === 0) {
        setCurrentTrackIndex(0);
      }
      return updated;
    });

    setActiveStudioTab("queue");

    try {
      updateItemProgress(demoId, 40);
      const rawBuffer = generateDemoAudioBuffer(44100, 16);
      const rawWavBlob = float32ToWav(rawBuffer);
      const originalUrl = registerUrl(URL.createObjectURL(rawWavBlob));

      updateItemProgress(demoId, 75);
      const processedBuffer = await process8DAudio(rawBuffer, options);
      const convertedWavBlob = float32ToWav(processedBuffer);
      const convertedUrl = registerUrl(URL.createObjectURL(convertedWavBlob));

      setAudioFiles((prev) =>
        prev.map((f) =>
          f.id === demoId
            ? {
                ...f,
                originalUrl,
                convertedUrl,
                status: "complete",
                progress: 100,
                size: convertedWavBlob.size,
                rawBuffer,
              }
            : f
        )
      );
    } catch (err: any) {
      console.error("Demo synthesis error:", err);
      setError("Could not synthesize demo audio.");
    }
  };

  // Helper to run local file conversion
  const runConversion = async (item: AudioFileItem) => {
    setAudioFiles((prev) =>
      prev.map((f) =>
        f.id === item.id ? { ...f, status: "converting", progress: 20 } : f
      )
    );

    let audioContext: AudioContext | null = null;
    try {
      const arrayBuffer = await item.file!.arrayBuffer();
      updateItemProgress(item.id, 45);

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      audioContext = new AudioCtx();
      const decodedBuffer = await audioContext.decodeAudioData(arrayBuffer);

      updateItemProgress(item.id, 70);
      const processedBuffer = await process8DAudio(decodedBuffer, options);

      updateItemProgress(item.id, 90);
      const wavBlob = float32ToWav(processedBuffer);
      const convertedUrl = registerUrl(URL.createObjectURL(wavBlob));

      setAudioFiles((prev) =>
        prev.map((f) =>
          f.id === item.id
            ? {
                ...f,
                convertedUrl,
                status: "complete",
                progress: 100,
                rawBuffer: decodedBuffer,
              }
            : f
        )
      );
    } catch (err: any) {
      console.error("Conversion error:", err);
      const msg = err?.message || "Audio conversion failed.";
      setAudioFiles((prev) =>
        prev.map((f) =>
          f.id === item.id ? { ...f, status: "error", error: msg } : f
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

  const updateItemProgress = (id: string, percent: number) => {
    setAudioFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, progress: percent } : f))
    );
  };

  // Re-convert a specific track (e.g. after changing 8D parameters)
  const handleReconvert = async (index: number) => {
    const target = audioFiles[index];
    if (!target) return;

    if (target.rawBuffer) {
      setAudioFiles((prev) =>
        prev.map((f, i) =>
          i === index ? { ...f, status: "converting", progress: 30 } : f
        )
      );

      try {
        const processedBuffer = await process8DAudio(target.rawBuffer, options);
        const wavBlob = float32ToWav(processedBuffer);
        const convertedUrl = registerUrl(URL.createObjectURL(wavBlob));

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
    } else if (target.file) {
      await runConversion(target);
    }
  };

  const handleDownload = (convertedUrl: string, title: string) => {
    try {
      const link = document.createElement("a");
      link.href = convertedUrl;
      const cleanTitle = title.replace(/[^a-zA-Z0-9_-]/g, "_");
      link.download = `${cleanTitle}_8D_Spatial.wav`;
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
      }
      return prev.filter((_, i) => i !== index);
    });

    if (currentTrackIndex >= index && currentTrackIndex > 0) {
      setCurrentTrackIndex((prev) => prev - 1);
    }
  };

  const activeTrack = audioFiles[currentTrackIndex] || null;
  const isConvertingAny = audioFiles.some((f) => f.status === "converting");

  return (
    <div className="space-y-6">
      {/* Global Error Banner */}
      {error && (
        <Alert variant="destructive" className="bg-red-950/80 border-red-800 text-red-200">
          <AlertCircle className="w-4 h-4 text-red-400" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Main Music Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ========================================================= */}
        {/* LEFT COLUMN: THE 8D SPATIAL PLAYER & RADAR DECK (6 COLS)  */}
        {/* ========================================================= */}
        <div className="lg:col-span-6 space-y-5">
          {/* Deck Container */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 md:p-6 shadow-2xl backdrop-blur-xl relative overflow-hidden">
            {/* Top Tag & Spatial Status */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-4">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-xs font-mono font-bold tracking-wider text-slate-300 uppercase">
                  360° HRTF Binaural Deck
                </span>
              </div>
              <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                {activeTrack?.status === "complete" ? "8D ACTIVE" : "STUDIO ENGINE"}
              </span>
            </div>

            {/* Orbit Radar HUD & Visualizer */}
            <div className="mb-5 flex justify-center">
              <OrbitVisualizer
                isPlaying={isPlaying}
                options={options}
                currentTime={activePlaybackTime}
              />
            </div>

            {/* Audio Player Transport & Controls */}
            {activeTrack ? (
              <AudioPlayer
                src={activeTrack.convertedUrl || activeTrack.originalUrl}
                originalSrc={activeTrack.originalUrl}
                title={activeTrack.name}
                artist={activeTrack.artist || "8D Audio Converter"}
                thumbnail={activeTrack.thumbnail}
                is8DReady={!!activeTrack.convertedUrl}
                onTimeUpdate={setActivePlaybackTime}
                onPlayStateChange={setIsPlaying}
                onNext={() => {
                  // Skip over pending/converting/error tracks — only jump to next complete
                  const nextIdx = audioFiles.findIndex(
                    (f, i) => i > currentTrackIndex && f.status === "complete"
                  );
                  if (nextIdx !== -1) setCurrentTrackIndex(nextIdx);
                }}
                onPrev={() => {
                  // Walk backwards to previous complete track
                  for (let i = currentTrackIndex - 1; i >= 0; i--) {
                    if (audioFiles[i].status === "complete") {
                      setCurrentTrackIndex(i);
                      break;
                    }
                  }
                }}
              />
            ) : (
              /* Idle Deck State */
              <div className="p-8 text-center bg-slate-950/60 border border-slate-800 rounded-2xl space-y-3">
                <div className="w-14 h-14 mx-auto rounded-full bg-slate-900 flex items-center justify-center text-slate-500 border border-slate-800">
                  <Disc3 className="w-8 h-8 animate-spin" style={{ animationDuration: "12s" }} />
                </div>
                <h4 className="text-sm font-semibold text-slate-200">
                  No Track Loaded in Deck
                </h4>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  Add music from the studio tabs on the right, or try the instant demo track.
                </p>
                <button
                  type="button"
                  onClick={handleLoadDemoTrack}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-cyan-500/20 transition-all"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Load Demo Track Now</span>
                </button>
              </div>
            )}

            {/* Quick 8D Preset Pills */}
            <div className="mt-4 pt-3 border-t border-slate-800/80">
              <span className="block text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-2">
                Quick 8D Presets:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((p) => {
                  const isCurrent = options.rotationSpeed === p.options.rotationSpeed;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setOptions(p.options)}
                      className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                        isCurrent
                          ? "bg-cyan-500/20 border-cyan-400 text-cyan-200"
                          : "bg-slate-950/40 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
                      }`}
                    >
                      {p.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* RIGHT COLUMN: QUEUE, ADD MUSIC & 8D STUDIO TABS (6 COLS)  */}
        {/* ========================================================= */}
        <div className="lg:col-span-6 space-y-4">
          {/* Studio Tab Switcher */}
          <div className="flex items-center justify-between p-1.5 bg-slate-900/90 border border-slate-800 rounded-2xl">
            <button
              type="button"
              onClick={() => setActiveStudioTab("queue")}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                activeStudioTab === "queue"
                  ? "bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <ListMusic className="w-4 h-4" />
              <span>Playlist Queue</span>
              {audioFiles.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-mono">
                  {audioFiles.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveStudioTab("add")}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                activeStudioTab === "add"
                  ? "bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>Add Music</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveStudioTab("settings")}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                activeStudioTab === "settings"
                  ? "bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Sliders className="w-4 h-4" />
              <span>8D Tuning</span>
            </button>
          </div>

          {/* TAB 1: PLAYLIST / QUEUE */}
          {activeStudioTab === "queue" && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl backdrop-blur-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-100">
                    Track Queue ({audioFiles.length})
                  </h3>
                </div>
                <div className="flex items-center gap-2">
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
                        onClick={() => {
                          setAudioFiles([]);
                          setCurrentTrackIndex(0);
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
                <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1 custom-scrollbar">
                  {audioFiles.map((item, index) => {
                    const isCurrent = currentTrackIndex === index;
                    return (
                      <div
                        key={item.id}
                        className={`p-3.5 rounded-2xl border transition-all ${
                          isCurrent
                            ? "bg-slate-950 border-cyan-500/60 shadow-lg shadow-cyan-500/5 ring-1 ring-cyan-500/30"
                            : "bg-slate-950/50 border-slate-800/80 hover:border-slate-700"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {/* Play / Select in Deck */}
                          <button
                            type="button"
                            onClick={() => setCurrentTrackIndex(index)}
                            className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${
                              isCurrent && isPlaying
                                ? "bg-cyan-500 text-slate-950 font-bold"
                                : "bg-slate-800 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-400"
                            }`}
                            title="Load in deck"
                          >
                            {isCurrent && isPlaying ? (
                              <Pause className="w-4 h-4 fill-current" />
                            ) : (
                              <Play className="w-4 h-4 fill-current ml-0.5" />
                            )}
                          </button>

                          {/* Track Info */}
                          <div
                            className="flex-1 min-w-0 cursor-pointer"
                            onClick={() => setCurrentTrackIndex(index)}
                          >
                            <h4 className="text-xs md:text-sm font-semibold text-slate-100 truncate">
                              {item.name}
                            </h4>
                            <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                              <span className="truncate">{item.artist || "Audio"}</span>
                              <span className="text-slate-600">•</span>
                              {item.status === "complete" && (
                                <span className="text-emerald-400 font-mono font-semibold flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" />
                                  8D Ready
                                </span>
                              )}
                              {item.status === "converting" && (
                                <span className="text-cyan-400 font-mono animate-pulse">
                                  Converting {item.progress || 0}%
                                </span>
                              )}
                              {item.status === "pending" && (
                                <span className="text-amber-400 font-mono">
                                  Pending
                                </span>
                              )}
                              {item.status === "error" && (
                                <span className="text-red-400 font-mono">
                                  Error
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {item.status === "complete" && item.convertedUrl && (
                              <button
                                type="button"
                                onClick={() => handleDownload(item.convertedUrl!, item.name)}
                                className="p-2 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 transition-all"
                                title="Download 8D Master (WAV)"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {item.status === "complete" && (
                              <button
                                type="button"
                                onClick={() => handleReconvert(index)}
                                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-all"
                                title="Re-convert with current 8D settings"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {item.status === "pending" && (
                              <button
                                type="button"
                                onClick={() => handleReconvert(index)}
                                className="px-2.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-semibold transition-all flex items-center gap-1"
                              >
                                <Sparkles className="w-3 h-3" />
                                <span>Convert</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => removeTrack(index)}
                              className="p-2 rounded-lg bg-slate-900 hover:bg-red-950/60 text-slate-500 hover:text-red-400 transition-all"
                              title="Remove track"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Progress Bar for Converting Tracks */}
                        {item.status === "converting" && (
                          <div className="mt-2.5 pt-2 border-t border-slate-900">
                            <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 h-1.5 transition-all duration-300"
                                style={{ width: `${item.progress || 20}%` }}
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
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl backdrop-blur-xl space-y-4">
              {/* Sub Mode Toggle: File Upload vs YouTube */}
              <div className="flex gap-2 p-1 bg-slate-950/70 border border-slate-800 rounded-xl">
                <button
                  type="button"
                  onClick={() => setAddMode("upload")}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                    addMode === "upload"
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Files</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAddMode("youtube")}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                    addMode === "youtube"
                      ? "bg-red-500/20 text-red-300 border border-red-500/30"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Youtube className="w-3.5 h-3.5 text-red-400" />
                  <span>YouTube URL / Playlist</span>
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
              ) : (
                <YouTubeInput
                  onConvertTrack={handleConvertYouTubeTrack}
                  onConvertBatch={handleConvertYouTubeBatch}
                  isConverting={isConvertingAny}
                />
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
                  disabled={isConvertingAny}
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
    </div>
  );
}
