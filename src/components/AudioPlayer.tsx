/* eslint-disable @next/next/no-img-element, react-hooks/exhaustive-deps */
"use client";

import { useState, useRef, useEffect } from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  RotateCcw,
  SkipBack,
  SkipForward,
  Repeat,
  Shuffle,
  Headphones,
  Sparkles,
  Youtube,
  Copy,
  Check,
} from "lucide-react";

interface AudioPlayerProps {
  src: string;
  originalSrc?: string;
  title?: string;
  artist?: string;
  thumbnail?: string;
  sourceUrl?: string;
  onCopySourceUrl?: (url: string) => void;
  is8DReady?: boolean;
  onTimeUpdate?: (currentTime: number) => void;
  onPlayStateChange?: (isPlaying: boolean) => void;
  onNext?: (autoPlay?: boolean) => void;
  onPrev?: (autoPlay?: boolean) => void;
  isShuffle?: boolean;
  onToggleShuffle?: () => void;
  isLooping?: boolean;
  onToggleLoop?: () => void;
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
  onTimeUpdate,
  onPlayStateChange,
  onNext,
  onPrev,
  isShuffle: propIsShuffle,
  onToggleShuffle,
  isLooping: propIsLooping,
  onToggleLoop,
}: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [internalLooping, setInternalLooping] = useState(false);
  const [internalShuffle, setInternalShuffle] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

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

  // A/B mode toggle: "8d" or "original"
  const [playbackMode, setPlaybackMode] = useState<"8d" | "original">("8d");

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastTitleRef = useRef(title);
  const shouldAutoPlayRef = useRef(false);

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
        setCurrentTime(0);
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
  }, [onTimeUpdate, onPlayStateChange, isLooping, onNext]);

  // MediaSession API: Mobile Lock Screen & Smartwatch / Bluetooth Controls
  useEffect(() => {
    if (typeof window === "undefined" || !("mediaSession" in navigator)) return;

    try {
      const artwork = thumbnail
        ? [
            { src: thumbnail, sizes: "96x96", type: "image/jpeg" },
            { src: thumbnail, sizes: "128x128", type: "image/jpeg" },
            { src: thumbnail, sizes: "192x192", type: "image/jpeg" },
            { src: thumbnail, sizes: "512x512", type: "image/jpeg" },
          ]
        : [];

      navigator.mediaSession.metadata = new MediaMetadata({
        title,
        artist: artist || "8D Audio Converter",
        album: "8D Spatial Studio",
        artwork,
      });

      navigator.mediaSession.setActionHandler("play", () => {
        audioRef.current?.play().catch(() => {});
      });

      navigator.mediaSession.setActionHandler("pause", () => {
        audioRef.current?.pause();
      });

      if (onPrev) {
        navigator.mediaSession.setActionHandler("previoustrack", () => {
          onPrev(true);
        });
      } else {
        navigator.mediaSession.setActionHandler("previoustrack", null);
      }

      if (onNext) {
        navigator.mediaSession.setActionHandler("nexttrack", () => {
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

  const handleSkip = (seconds: number) => {
    const audio = audioRef.current;
    if (audio) {
      const nextTime = Math.max(0, Math.min(duration, audio.currentTime + seconds));
      audio.currentTime = nextTime;
      setCurrentTime(nextTime);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    setVolume(vol);
    if (audioRef.current) {
      audioRef.current.volume = vol;
      setIsMuted(vol === 0);
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      const nextMuted = !isMuted;
      setIsMuted(nextMuted);
      audioRef.current.muted = nextMuted;
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-inner backdrop-blur-md">
      <audio ref={audioRef} preload="metadata" />

      {/* Song Header & A/B Comparison Toggle */}
      <div className="flex items-center justify-between gap-3 mb-3 sm:mb-4">
        {/* Track Thumbnail & Title */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative w-11 h-11 sm:w-13 sm:h-13 md:w-14 md:h-14 rounded-xl overflow-hidden bg-slate-900 border border-slate-800 flex-shrink-0 flex items-center justify-center shadow-md">
            {thumbnail ? (
              <img
                src={thumbnail}
                alt={title}
                className="w-full h-full object-cover"
              />
            ) : (
              <Headphones className="w-6 h-6 text-cyan-400" />
            )}
            {isPlaying && (
              <div className="absolute inset-0 bg-cyan-950/40 backdrop-blur-[1px] flex items-center justify-center">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
              </div>
            )}
          </div>

          <div className="min-w-0">
            <h3 className="font-bold text-white text-xs sm:text-sm md:text-base truncate leading-tight">
              {title}
            </h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[11px] sm:text-xs text-slate-400 truncate max-w-[140px] sm:max-w-[200px]">
                {artist}
              </span>
              {is8DReady && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 uppercase">
                  8D SPATIAL
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Copy YouTube Link Pill */}
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
                  <Youtube className="w-3.5 h-3.5 text-red-500" />
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
              className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] font-mono font-semibold transition-all flex items-center gap-1.5 border shrink-0 ${
                playbackMode === "8d"
                  ? "bg-cyan-500/15 border-cyan-400/60 text-cyan-300 shadow-sm shadow-cyan-500/20"
                  : "bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200"
              }`}
              title="Toggle between 8D Spatial Audio and Original Stereo Audio"
            >
              <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-cyan-400" />
              <span>{playbackMode === "8d" ? "8D ON" : "BYPASS"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Progress Waveform Bar */}
      <div className="space-y-1 mb-3 sm:mb-4">
        <div className="relative group w-full flex items-center">
          <input
            type="range"
            min="0"
            max={duration || 100}
            step="0.05"
            value={currentTime}
            onChange={handleSeek}
            disabled={!src}
            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400 relative z-10"
            style={{
              background: `linear-gradient(to right, #06b6d4 0%, #a855f7 ${progressPercent}%, #1e293b ${progressPercent}%, #1e293b 100%)`,
            }}
          />
        </div>
        <div className="flex justify-between text-[10px] sm:text-[11px] font-mono text-slate-400">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Main Transport Controls */}
      <div className="flex items-center justify-between">
        {/* Left Side Aux Buttons (Shuffle/Loop) */}
        <div className="flex items-center gap-1 sm:gap-2 text-slate-400">
          <button
            type="button"
            onClick={toggleShuffle}
            className={`p-1.5 sm:p-2 rounded-lg transition-colors ${
              isShuffle ? "text-cyan-400 bg-cyan-500/10" : "hover:text-white"
            }`}
            title={isShuffle ? "Shuffle On" : "Shuffle Off"}
          >
            <Shuffle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
          <button
            type="button"
            onClick={toggleLoop}
            className={`p-1.5 sm:p-2 rounded-lg transition-colors ${
              isLooping ? "text-cyan-400 bg-cyan-500/10" : "hover:text-white"
            }`}
            title={isLooping ? "Loop On" : "Loop Off"}
          >
            <Repeat className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>

        {/* Center Primary Player Controls */}
        <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
          <button
            type="button"
            onClick={() => {
              if (isPlayingRef.current) shouldAutoPlayRef.current = true;
              if (onPrev) onPrev(isPlayingRef.current);
            }}
            disabled={!onPrev}
            className="p-1.5 sm:p-2 text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Previous Track"
          >
            <SkipBack className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          <button
            type="button"
            onClick={() => handleSkip(-10)}
            className="p-1.5 sm:p-2 text-slate-400 hover:text-white transition-colors"
            title="Rewind 10s"
          >
            <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          {/* Large Glowing Play/Pause Button */}
          <button
            type="button"
            onClick={togglePlay}
            disabled={!src}
            className="w-11 h-11 sm:w-13 sm:h-13 md:w-14 md:h-14 flex items-center justify-center rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 text-white shadow-lg shadow-cyan-500/30 hover:scale-105 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 sm:w-6 sm:h-6 fill-current" />
            ) : (
              <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-current ml-0.5" />
            )}
          </button>

          <button
            type="button"
            onClick={() => handleSkip(10)}
            className="p-1.5 sm:p-2 text-slate-400 hover:text-white transition-colors"
            title="Forward 10s"
          >
            <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4 scale-x-[-1]" />
          </button>

          <button
            type="button"
            onClick={() => {
              if (isPlayingRef.current) shouldAutoPlayRef.current = true;
              if (onNext) onNext(isPlayingRef.current);
            }}
            disabled={!onNext}
            className="p-1.5 sm:p-2 text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Next Track"
          >
            <SkipForward className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Right Side: Mute toggle on mobile, full volume slider on desktop */}
        <div className="flex items-center gap-1.5 sm:gap-2 text-slate-400">
          <button
            type="button"
            onClick={toggleMute}
            className="p-1.5 hover:text-white transition-colors"
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-4 h-4 text-red-400" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            className="hidden sm:block w-16 md:w-20 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
        </div>
      </div>
    </div>
  );
}
