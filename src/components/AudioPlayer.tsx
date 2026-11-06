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
} from "lucide-react";

interface AudioPlayerProps {
  src: string;
  originalSrc?: string;
  title?: string;
  artist?: string;
  thumbnail?: string;
  is8DReady?: boolean;
  onTimeUpdate?: (currentTime: number) => void;
  onPlayStateChange?: (isPlaying: boolean) => void;
  onNext?: () => void;
  onPrev?: () => void;
}

export default function AudioPlayer({
  src,
  originalSrc,
  title = "Untitled Track",
  artist = "8D Audio Studio",
  thumbnail,
  is8DReady = false,
  onTimeUpdate,
  onPlayStateChange,
  onNext,
  onPrev,
}: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isLooping, setIsLooping] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);

  // A/B mode toggle: "8d" or "original"
  const [playbackMode, setPlaybackMode] = useState<"8d" | "original">("8d");

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastTitleRef = useRef(title);
  // Ref to avoid stale closure when reading isPlaying inside effects
  const isPlayingRef = useRef(isPlaying);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);
  // Ref to track currentTime & duration without adding them to effect deps
  const currentTimeRef = useRef(currentTime);
  const durationRef = useRef(duration);
  useEffect(() => { currentTimeRef.current = currentTime; }, [currentTime]);
  useEffect(() => { durationRef.current = duration; }, [duration]);

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

    if (isPlayingRef.current) {
      audio.play().catch(() => {});
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
        if (onNext) onNext();
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

  const toggleABMode = () => {
    if (!originalSrc) return;
    setPlaybackMode((prev) => (prev === "8d" ? "original" : "8d"));
  };

  const formatTime = (time: number) => {
    if (isNaN(time) || time === Infinity) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-2xl backdrop-blur-xl relative overflow-hidden">
      {/* Hidden native audio tag */}
      <audio ref={audioRef} preload="metadata" />

      {/* Top Bar: Now Playing + A/B Spatial Switch */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-3 min-w-0">
          {/* Vinyl / Cover Art */}
          <div className="relative w-12 h-12 flex-shrink-0 rounded-xl overflow-hidden bg-slate-800 border border-slate-700/60 shadow-md">
            {thumbnail ? (
              <img
                src={thumbnail}
                alt={title}
                className={`w-full h-full object-cover transition-transform duration-700 ${
                  isPlaying ? "scale-105" : "scale-100"
                }`}
              />
            ) : (
              <div
                className={`w-full h-full flex items-center justify-center bg-gradient-to-tr from-cyan-600 via-indigo-600 to-purple-600 text-white ${
                  isPlaying ? "animate-spin" : ""
                }`}
                style={{ animationDuration: "8s" }}
              >
                <Headphones className="w-6 h-6" />
              </div>
            )}
            {/* Center vinyl spindle */}
            <div className="absolute inset-0 m-auto w-2 h-2 rounded-full bg-slate-950 border border-slate-700/80 pointer-events-none" />
          </div>

          <div className="min-w-0">
            <h4 className="text-white font-semibold text-sm md:text-base truncate">
              {title}
            </h4>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="truncate">{artist}</span>
              <span className="text-slate-600">•</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase ${
                  playbackMode === "8d"
                    ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30"
                    : "bg-slate-800 text-slate-300 border border-slate-700"
                }`}
              >
                {playbackMode === "8d" ? "8D Spatial" : "Original Stereo"}
              </span>
            </div>
          </div>
        </div>

        {/* A/B Switch Button */}
        {originalSrc && (
          <button
            type="button"
            onClick={toggleABMode}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shadow-sm ${
              playbackMode === "8d"
                ? "bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-400/40 text-cyan-300 hover:from-cyan-500/30 hover:to-purple-500/30"
                : "bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700"
            }`}
            title="Compare 8D Spatial Audio vs Original Track"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>A/B: {playbackMode === "8d" ? "8D ON" : "BYPASSED"}</span>
          </button>
        )}
      </div>

      {/* Progress Waveform Bar */}
      <div className="space-y-1.5 mb-4">
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
        <div className="flex justify-between text-[11px] font-mono text-slate-400">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Main Transport Controls */}
      <div className="flex items-center justify-between">
        {/* Left Side Aux Buttons */}
        <div className="flex items-center gap-2 text-slate-400">
          <button
            type="button"
            onClick={() => setIsShuffle(!isShuffle)}
            className={`p-2 rounded-lg transition-colors ${
              isShuffle ? "text-cyan-400 bg-cyan-500/10" : "hover:text-white"
            }`}
            title="Shuffle"
          >
            <Shuffle className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setIsLooping(!isLooping)}
            className={`p-2 rounded-lg transition-colors ${
              isLooping ? "text-cyan-400 bg-cyan-500/10" : "hover:text-white"
            }`}
            title="Loop Track"
          >
            <Repeat className="w-4 h-4" />
          </button>
        </div>

        {/* Center Primary Player Controls */}
        <div className="flex items-center gap-3 md:gap-4">
          <button
            type="button"
            onClick={onPrev}
            disabled={!onPrev}
            className="p-2 text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Previous Track"
          >
            <SkipBack className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => handleSkip(-10)}
            className="p-2 text-slate-400 hover:text-white transition-colors"
            title="Rewind 10s"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Large Glowing Play/Pause Button */}
          <button
            type="button"
            onClick={togglePlay}
            disabled={!src}
            className="w-12 h-12 md:w-14 md:h-14 flex items-center justify-center rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 text-white shadow-lg shadow-cyan-500/30 hover:scale-105 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause className="w-6 h-6 fill-current" />
            ) : (
              <Play className="w-6 h-6 fill-current ml-0.5" />
            )}
          </button>

          <button
            type="button"
            onClick={() => handleSkip(10)}
            className="p-2 text-slate-400 hover:text-white transition-colors"
            title="Forward 10s"
          >
            <RotateCcw className="w-4 h-4 scale-x-[-1]" />
          </button>

          <button
            type="button"
            onClick={onNext}
            disabled={!onNext}
            className="p-2 text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Next Track"
          >
            <SkipForward className="w-5 h-5" />
          </button>
        </div>

        {/* Right Side Volume Slider */}
        <div className="flex items-center gap-2 text-slate-400">
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
            className="w-16 md:w-20 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
        </div>
      </div>
    </div>
  );
}
