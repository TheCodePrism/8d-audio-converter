/* eslint-disable @next/next/no-img-element, react-hooks/exhaustive-deps */
"use client";

import { useState, useRef, useEffect } from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  RotateCcw,
  RotateCw,
  SkipBack,
  SkipForward,
  Repeat,
  Shuffle,
  Sparkles,
  Youtube,
  Copy,
  Check,
  Download,
  Disc3,
} from "lucide-react";
import OrbitVisualizer from "./OrbitVisualizer";
import { AudioProcessingOptions } from "@/types";
import { PRESETS } from "@/lib/audioProcessing";

interface AudioPlayerProps {
  src: string;
  originalSrc?: string;
  title?: string;
  artist?: string;
  thumbnail?: string;
  sourceUrl?: string;
  onCopySourceUrl?: (url: string) => void;
  is8DReady?: boolean;
  options: AudioProcessingOptions;
  onTimeUpdate?: (currentTime: number) => void;
  onPlayStateChange?: (isPlaying: boolean) => void;
  onNext?: (autoPlay?: boolean) => void;
  onPrev?: (autoPlay?: boolean) => void;
  isShuffle?: boolean;
  onToggleShuffle?: () => void;
  isLooping?: boolean;
  onToggleLoop?: () => void;
  onDownload?: () => void;
  onSelectPreset?: (presetOptions: AudioProcessingOptions) => void;
}

export default function AudioPlayer({
  src,
  originalSrc,
  title = "Untitled Track",
  artist = "8D Audio Studio",
  thumbnail,
  sourceUrl,
  onCopySourceUrl,
  is8DReady = false,
  options,
  onTimeUpdate,
  onPlayStateChange,
  onNext,
  onPrev,
  isShuffle: propIsShuffle,
  onToggleShuffle,
  isLooping: propIsLooping,
  onToggleLoop,
  onDownload,
  onSelectPreset,
}: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [internalLooping, setInternalLooping] = useState(false);
  const [internalShuffle, setInternalShuffle] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // A/B mode toggle: "8d" or "original"
  const [playbackMode, setPlaybackMode] = useState<"8d" | "original">("8d");

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastTitleRef = useRef(title);
  const shouldAutoPlayRef = useRef(false);

  const handleCopyLink = async (url: string) => {
    try {
      if (onCopySourceUrl) {
        onCopySourceUrl(url);
      } else {
        await navigator.clipboard.writeText(url);
      }
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // ignore
    }
  };

  const isShuffle = propIsShuffle !== undefined ? propIsShuffle : internalShuffle;
  const isLooping = propIsLooping !== undefined ? propIsLooping : internalLooping;

  const toggleShuffle = () => {
    if (onToggleShuffle) {
      onToggleShuffle();
    } else {
      setInternalShuffle((prev) => !prev);
    }
  };

  const toggleLoop = () => {
    if (onToggleLoop) {
      onToggleLoop();
    } else {
      setInternalLooping((prev) => !prev);
    }
  };

  const skipTime = (delta: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const dur = duration || 100;
    const newTime = Math.max(0, Math.min(dur, audio.currentTime + delta));
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  // Ref to avoid stale closure when reading isPlaying inside effects
  const isPlayingRef = useRef(isPlaying);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Ref to track currentTime & duration without adding them to effect deps
  const currentTimeRef = useRef(currentTime);
  const durationRef = useRef(duration);
  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);
  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  // Determine active source based on A/B mode
  const activeSource =
    playbackMode === "original" && originalSrc ? originalSrc : src;

  // Sync state whenever active source changes or song changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const isSameTrack = lastTitleRef.current === title;
    lastTitleRef.current = title;

    audio.src = activeSource;
    audio.load();

    if (isSameTrack) {
      // A/B switch on the same track: preserve current playback position
      const ct = currentTimeRef.current;
      const dur = durationRef.current;
      if (ct > 0 && ct < dur) {
        audio.currentTime = ct;
      }
    } else {
      // Different track: restart at 0:00
      audio.currentTime = 0;
      setCurrentTime(0);
    }

    if (shouldAutoPlayRef.current || isPlayingRef.current) {
      shouldAutoPlayRef.current = false;
      audio.play().catch((err) => {
        console.warn("Playback or autoplay restriction:", err);
      });
    }
  }, [activeSource, title]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if (onTimeUpdate) onTimeUpdate(audio.currentTime);
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration || 0);
    };

    const handlePlay = () => {
      setIsPlaying(true);
      if (onPlayStateChange) onPlayStateChange(true);
    };

    const handlePause = () => {
      setIsPlaying(false);
      if (onPlayStateChange) onPlayStateChange(false);
    };

    const handleEnded = () => {
      if (isLooping) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      } else {
        setIsPlaying(false);
        if (onPlayStateChange) onPlayStateChange(false);
        if (onNext) {
          shouldAutoPlayRef.current = true;
          onNext(true);
        }
      }
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [isLooping, onNext, onTimeUpdate, onPlayStateChange]);

  // Volume sync
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = isMuted ? 0 : volume;
  }, [volume, isMuted]);

  // MediaSession API integration
  useEffect(() => {
    if (typeof window === "undefined" || !("mediaSession" in navigator)) return;

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: title || "8D Audio Master",
        artist: artist || "8D Audio Studio",
        album: "8D Spatial Experience",
        artwork: thumbnail
          ? [
              { src: thumbnail, sizes: "96x96", type: "image/jpeg" },
              { src: thumbnail, sizes: "128x128", type: "image/jpeg" },
              { src: thumbnail, sizes: "256x256", type: "image/jpeg" },
              { src: thumbnail, sizes: "512x512", type: "image/jpeg" },
            ]
          : [
              {
                src: "/icon-192x192.png",
                sizes: "192x192",
                type: "image/png",
              },
            ],
      });

      navigator.mediaSession.setActionHandler("play", () => {
        audioRef.current?.play().catch(() => {});
      });

      navigator.mediaSession.setActionHandler("pause", () => {
        audioRef.current?.pause();
      });

      if (onPrev) {
        navigator.mediaSession.setActionHandler("previoustrack", () => {
          shouldAutoPlayRef.current = true;
          onPrev(true);
        });
      } else {
        navigator.mediaSession.setActionHandler("previoustrack", null);
      }

      if (onNext) {
        navigator.mediaSession.setActionHandler("nexttrack", () => {
          shouldAutoPlayRef.current = true;
          onNext(true);
        });
      } else {
        navigator.mediaSession.setActionHandler("nexttrack", null);
      }

      navigator.mediaSession.setActionHandler("seekto", (details) => {
        if (details.seekTime !== undefined && audioRef.current) {
          audioRef.current.currentTime = details.seekTime;
          setCurrentTime(details.seekTime);
        }
      });
    } catch (err) {
      console.warn("MediaSession registration error:", err);
    }
  }, [title, artist, thumbnail, onNext, onPrev]);

  // Update lock screen timeline position
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("mediaSession" in navigator) ||
      !navigator.mediaSession.setPositionState
    )
      return;

    try {
      if (duration > 0) {
        navigator.mediaSession.setPositionState({
          duration: Math.max(0, duration),
          playbackRate: 1,
          position: Math.min(Math.max(0, currentTime), duration),
        });
      }
    } catch {}
  }, [currentTime, duration]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    try {
      if (audio.paused) {
        await audio.play();
      } else {
        audio.pause();
      }
    } catch (err) {
      console.warn("Playback error or autoplay restriction:", err);
      setIsPlaying(false);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    if (newVol > 0 && isMuted) {
      setIsMuted(false);
    }
  };

  const toggleMute = () => {
    setIsMuted((prev) => !prev);
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex flex-col space-y-4">
      <audio ref={audioRef} preload="metadata" />

      {/* ── 1. The Cover Image with Transparent 360°/16D Orbit Radar Overlay ── */}
      <div className="w-full flex justify-center pt-1 pb-1">
        <OrbitVisualizer
          isPlaying={isPlaying}
          options={options}
          currentTime={currentTime}
          coverImage={thumbnail}
          title={title}
          artist={artist}
          is8DReady={is8DReady}
        />
      </div>

      {/* ── 2. Now Playing Track Metadata & Spatial Badges ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1 pt-1">
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-white text-base sm:text-lg md:text-xl truncate leading-tight tracking-tight">
            {title}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs sm:text-sm text-slate-400 truncate max-w-[200px] sm:max-w-xs font-medium">
              {artist}
            </span>
            {is8DReady && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 uppercase font-semibold">
                8D Spatial
              </span>
            )}
          </div>
        </div>

        {/* Action Pills: Copy YouTube Link & A/B Bypass */}
        <div className="flex items-center gap-2 shrink-0">
          {sourceUrl && (
            <button
              type="button"
              onClick={() => handleCopyLink(sourceUrl)}
              className={`px-2.5 py-1.5 rounded-xl text-[11px] font-semibold transition-all flex items-center gap-1.5 border shrink-0 ${
                copiedLink
                  ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
                  : "bg-slate-900 border-slate-700 hover:border-red-500/50 text-slate-300 hover:text-red-400"
              }`}
              title={copiedLink ? "Copied to clipboard!" : "Copy YouTube link"}
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="font-mono">Copied!</span>
                </>
              ) : (
                <>
                  <Youtube className="w-3.5 h-3.5 text-red-500 fill-current" />
                  <span className="hidden sm:inline">YouTube</span>
                  <Copy className="w-3 h-3 opacity-60" />
                </>
              )}
            </button>
          )}

          {/* Live A/B Comparison Pill */}
          {originalSrc && is8DReady && (
            <button
              type="button"
              onClick={() =>
                setPlaybackMode((prev) => (prev === "8d" ? "original" : "8d"))
              }
              className={`px-3 py-1.5 rounded-xl text-[11px] font-mono font-semibold transition-all flex items-center gap-1.5 border shrink-0 shadow-sm ${
                playbackMode === "8d"
                  ? "bg-cyan-500/20 border-cyan-400/80 text-cyan-200 shadow-cyan-500/15"
                  : "bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200"
              }`}
              title="Toggle between 8D Spatial Audio and Original Stereo Audio"
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>{playbackMode === "8d" ? "8D SPATIAL" : "BYPASS STEREO"}</span>
            </button>
          )}

          {onDownload && is8DReady && (
            <button
              type="button"
              onClick={onDownload}
              className="p-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 transition-all shrink-0"
              title="Download 8D MP3 Master"
            >
              <Download className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* ── 3. High-Precision Scrub Timeline ── */}
      <div className="space-y-1.5 pt-1">
        <div className="relative group w-full flex items-center">
          <input
            type="range"
            min="0"
            max={duration || 100}
            step="0.05"
            value={currentTime}
            onChange={handleSeek}
            disabled={!src}
            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer focus:outline-none disabled:opacity-40 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(56,189,248,0.8)] [&::-webkit-slider-thumb]:hover:scale-125 [&::-webkit-slider-thumb]:transition-transform"
            style={{
              background: `linear-gradient(to right, #38bdf8 ${progressPercent}%, #a855f7 ${progressPercent}%, #1e293b ${progressPercent}%)`,
            }}
          />
        </div>
        <div className="flex justify-between text-[11px] font-mono text-slate-400 px-0.5">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* ── 4. Audiophile Transport Deck ── */}
      <div className="flex items-center justify-between gap-2 pt-1 pb-1">
        {/* Left Side: Shuffle & Repeat */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          <button
            type="button"
            onClick={toggleShuffle}
            className={`p-2 rounded-xl transition-all ${
              isShuffle
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                : "text-slate-500 hover:text-slate-300"
            }`}
            title={isShuffle ? "Shuffle On" : "Shuffle Off"}
          >
            <Shuffle className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={toggleLoop}
            className={`p-2 rounded-xl transition-all ${
              isLooping
                ? "bg-purple-500/20 text-purple-300 border border-purple-500/40"
                : "text-slate-500 hover:text-slate-300"
            }`}
            title={isLooping ? "Repeat Track On" : "Repeat Track Off"}
          >
            <Repeat className="w-4 h-4" />
          </button>
        </div>

        {/* Center: Skip -10s, Previous, HERO Play/Pause, Next, Skip +10s */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => skipTime(-10)}
            disabled={!src}
            className="p-2 text-slate-400 hover:text-slate-200 disabled:opacity-40 transition-colors"
            title="Rewind 10 seconds"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              shouldAutoPlayRef.current = true;
              onPrev?.(true);
            }}
            disabled={!onPrev}
            className="p-2 text-slate-400 hover:text-slate-200 disabled:opacity-40 transition-colors"
            title="Previous track"
          >
            <SkipBack className="w-5 h-5 fill-current" />
          </button>

          {/* 🌟 HERO PLAY / PAUSE BUTTON WITH NEON PULSE 🌟 */}
          <button
            type="button"
            onClick={togglePlay}
            disabled={!src}
            className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
              isPlaying
                ? "bg-gradient-to-tr from-cyan-400 via-cyan-500 to-purple-600 text-slate-950 font-black shadow-xl shadow-cyan-500/30 ring-4 ring-cyan-400/20 scale-105"
                : "bg-gradient-to-tr from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-black shadow-lg shadow-cyan-500/20 hover:scale-105"
            }`}
            title={isPlaying ? "Pause" : "Play 8D Audio"}
          >
            {isPlaying ? (
              <Pause className="w-6 h-6 sm:w-7 sm:h-7 fill-current" />
            ) : (
              <Play className="w-6 h-6 sm:w-7 sm:h-7 fill-current ml-0.5" />
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              shouldAutoPlayRef.current = true;
              onNext?.(true);
            }}
            disabled={!onNext}
            className="p-2 text-slate-400 hover:text-slate-200 disabled:opacity-40 transition-colors"
            title="Next track"
          >
            <SkipForward className="w-5 h-5 fill-current" />
          </button>

          <button
            type="button"
            onClick={() => skipTime(10)}
            disabled={!src}
            className="p-2 text-slate-400 hover:text-slate-200 disabled:opacity-40 transition-colors"
            title="Fast forward 10 seconds"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>

        {/* Right Side: Volume & Mute */}
        <div className="flex items-center gap-1.5 w-24 sm:w-32 justify-end">
          <button
            type="button"
            onClick={toggleMute}
            className="p-1.5 text-slate-400 hover:text-slate-200 transition-colors"
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-4 h-4 text-red-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-slate-400" />
            )}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            className="w-16 sm:w-20 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer focus:outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-400"
            style={{
              background: `linear-gradient(to right, #38bdf8 ${
                (isMuted ? 0 : volume) * 100
              }%, #334155 ${(isMuted ? 0 : volume) * 100}%)`,
            }}
          />
        </div>
      </div>

      {/* ── 5. Instant 8D Spatial Presets Bar ── */}
      {onSelectPreset && (
        <div className="pt-3 border-t border-slate-800/80">
          <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-2">
            <span>Spatial Audio Presets</span>
            <span className="text-cyan-400/80 font-sans normal-case text-[10px]">
              Tap to live-switch acoustics
            </span>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:flex-wrap no-scrollbar">
            {PRESETS.map((p) => {
              const isCurrent =
                options.rotationSpeed === p.options.rotationSpeed &&
                options.verticalOrbit === p.options.verticalOrbit;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onSelectPreset(p.options)}
                  className={`text-xs px-3 py-1.5 rounded-xl border whitespace-nowrap transition-all font-medium ${
                    isCurrent
                      ? "bg-cyan-500/20 border-cyan-400 text-cyan-200 ring-1 ring-cyan-500/30 shadow-sm"
                      : "bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
                  }`}
                >
                  {p.name}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}