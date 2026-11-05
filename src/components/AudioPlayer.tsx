"use client";

import { useState, useRef, useEffect } from "react";
import { Play, Pause, Volume2, VolumeX, RotateCcw } from "lucide-react";

interface AudioPlayerProps {
  src: string;
  title?: string;
  onTimeUpdate?: (currentTime: number) => void;
  onPlayStateChange?: (isPlaying: boolean) => void;
}

export default function AudioPlayer({
  src,
  title,
  onTimeUpdate,
  onPlayStateChange,
}: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Sync state whenever audio source changes
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    if (onPlayStateChange) onPlayStateChange(false);
  }, [src, onPlayStateChange]);

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
      setIsPlaying(false);
      setCurrentTime(0);
      if (onPlayStateChange) onPlayStateChange(false);
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
  }, [src, onTimeUpdate, onPlayStateChange]);

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

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = time;
      setCurrentTime(time);
    }
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (audio) {
      const nextMuted = !isMuted;
      audio.muted = nextMuted;
      setIsMuted(nextMuted);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    const audio = audioRef.current;
    if (audio) {
      audio.volume = val;
      setVolume(val);
      setIsMuted(val === 0);
    }
  };

  const handleRestart = () => {
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = 0;
      setCurrentTime(0);
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-4 transition-all border border-slate-200 dark:border-slate-700">
      <audio ref={audioRef} src={src} preload="metadata" />

      {title && (
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
          {title}
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-center gap-4">
        {/* Playback Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={togglePlay}
            className="p-3 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-blue-400"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 fill-current" />
            ) : (
              <Play className="w-5 h-5 fill-current ml-0.5" />
            )}
          </button>

          <button
            type="button"
            onClick={handleRestart}
            className="p-2 rounded-full text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            title="Restart"
            aria-label="Restart audio"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Timeline Slider */}
        <div className="flex-1 w-full space-y-1">
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={handleTimeChange}
            className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-slate-300 dark:bg-slate-600 accent-blue-600"
          />
          <div className="flex justify-between text-xs font-mono text-slate-500 dark:text-slate-400">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Volume Controls */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={toggleMute}
            className="p-2 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            aria-label={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-5 h-5 text-red-500" />
            ) : (
              <Volume2 className="w-5 h-5" />
            )}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            className="w-20 h-1.5 rounded-lg appearance-none cursor-pointer bg-slate-300 dark:bg-slate-600 accent-blue-600"
            aria-label="Volume slider"
          />
        </div>
      </div>
    </div>
  );
}
