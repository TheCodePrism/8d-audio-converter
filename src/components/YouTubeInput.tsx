/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useState } from "react";
import {
  Youtube,
  Search,
  Loader2,
  ListMusic,
  CheckSquare,
  Square,
  Play,
  Clock,
  Sparkles,
  AlertCircle,
  Plus,
} from "lucide-react";
import { YouTubeInfoResponse, YouTubeTrack } from "@/types";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface YouTubeInputProps {
  onConvertTrack: (track: YouTubeTrack) => Promise<void>;
  onConvertBatch: (tracks: YouTubeTrack[]) => Promise<void>;
  isConverting: boolean;
}

export default function YouTubeInput({
  onConvertTrack,
  onConvertBatch,
  isConverting,
}: YouTubeInputProps) {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<YouTubeInfoResponse | null>(null);
  const [selectedTrackIds, setSelectedTrackIds] = useState<Set<string>>(
    new Set()
  );

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const handleFetchInfo = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!url.trim()) return;

    setError(null);
    setIsLoading(true);
    setInfo(null);
    setSelectedTrackIds(new Set());

    try {
      const res = await fetch("/api/youtube/info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      const rawText = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(rawText);
      } catch {
        throw new Error(
          res.ok
            ? "Invalid response from server."
            : "The YouTube service is currently waking up or unavailable. Please retry in a few seconds."
        );
      }

      if (!res.ok) {
        throw new Error(data?.error || "Failed to load YouTube data.");
      }

      setInfo(data);
      if (data.tracks && data.tracks.length > 0) {
        setSelectedTrackIds(new Set(data.tracks.map((t: YouTubeTrack) => t.id)));
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Could not retrieve YouTube video info.");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSelectTrack = (trackId: string) => {
    setSelectedTrackIds((prev) => {
      const next = new Set(prev);
      if (next.has(trackId)) {
        next.delete(trackId);
      } else {
        next.add(trackId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!info) return;
    if (selectedTrackIds.size === info.tracks.length) {
      setSelectedTrackIds(new Set());
    } else {
      setSelectedTrackIds(new Set(info.tracks.map((t) => t.id)));
    }
  };

  const handleConvertSingle = (track: YouTubeTrack) => {
    onConvertTrack(track);
  };

  const handleConvertSelected = () => {
    if (!info) return;
    const selectedTracks = info.tracks.filter((t) =>
      selectedTrackIds.has(t.id)
    );
    if (selectedTracks.length === 1) {
      onConvertTrack(selectedTracks[0]);
    } else if (selectedTracks.length > 1) {
      onConvertBatch(selectedTracks);
    }
  };

  return (
    <div className="space-y-5">
      {/* Search Input Bar */}
      <form onSubmit={handleFetchInfo} className="space-y-2">
        <div className="relative flex items-center">
          <div className="absolute left-4 text-red-500 pointer-events-none">
            <Youtube className="w-5 h-5" />
          </div>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste YouTube Video or Playlist URL (e.g., https://youtube.com/watch?v=...)"
            disabled={isLoading || isConverting}
            className="w-full pl-12 pr-28 py-3.5 bg-slate-950/60 border border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all text-slate-100 placeholder-slate-500"
          />
          <button
            type="submit"
            disabled={isLoading || !url.trim() || isConverting}
            className="absolute right-2 px-4 py-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 shadow-md shadow-red-500/20"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            <span>{isLoading ? "Fetching..." : "Fetch"}</span>
          </button>
        </div>
        <p className="text-[11px] text-slate-400 pl-1">
          Paste any YouTube song or playlist. The audio stream is securely proxied and converted into 8D spatial sound.
        </p>
      </form>

      {error && (
        <Alert variant="destructive" className="bg-red-950/50 border-red-800/80 text-red-200">
          <AlertCircle className="w-4 h-4 text-red-400" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Results Preview */}
      {info && (
        <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
            <div className="flex items-center gap-2 min-w-0">
              {info.isPlaylist ? (
                <ListMusic className="w-5 h-5 text-red-500 flex-shrink-0" />
              ) : (
                <Youtube className="w-5 h-5 text-red-500 flex-shrink-0" />
              )}
              <h3 className="font-semibold text-slate-100 text-sm sm:text-base truncate">
                {info.title}
              </h3>
            </div>
            {info.isPlaylist && (
              <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/30">
                {info.tracks.length} Tracks
              </span>
            )}
          </div>

          {/* Single Video Card */}
          {!info.isPlaylist && info.tracks.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-900/80 p-4 rounded-xl border border-slate-800 shadow-md">
              {info.tracks[0].thumbnail && (
                <img
                  src={info.tracks[0].thumbnail}
                  alt={info.tracks[0].title}
                  className="w-full sm:w-36 h-24 object-cover rounded-lg shadow-inner"
                />
              )}
              <div className="flex-1 min-w-0 space-y-1">
                <h4 className="font-semibold text-slate-100 text-sm line-clamp-2">
                  {info.tracks[0].title}
                </h4>
                {info.tracks[0].author && (
                  <p className="text-xs text-slate-400">{info.tracks[0].author}</p>
                )}
                {info.tracks[0].duration && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-400">
                    <Clock className="w-3 h-3" />
                    {formatDuration(info.tracks[0].duration)}
                  </span>
                )}
              </div>
              <button
                type="button"
                disabled={isConverting}
                onClick={() => handleConvertSingle(info.tracks[0])}
                className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-red-600 via-rose-600 to-purple-600 hover:from-red-500 hover:to-purple-500 disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-lg shadow-red-500/20 flex items-center justify-center gap-2 transition-all shrink-0"
              >
                {isConverting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                <span>Import & Convert 8D</span>
              </button>
            </div>
          )}

          {/* Playlist Track Selection List */}
          {info.isPlaylist && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-medium text-slate-400 px-1">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="flex items-center gap-1.5 hover:text-white transition-colors"
                >
                  {selectedTrackIds.size === info.tracks.length ? (
                    <CheckSquare className="w-4 h-4 text-red-500" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-600" />
                  )}
                  <span>
                    Select All ({selectedTrackIds.size}/{info.tracks.length})
                  </span>
                </button>

                <button
                  type="button"
                  disabled={selectedTrackIds.size === 0 || isConverting}
                  onClick={handleConvertSelected}
                  className="px-4 py-2 bg-gradient-to-r from-red-600 to-purple-600 hover:from-red-500 hover:to-purple-500 disabled:opacity-40 text-white text-xs font-semibold rounded-xl shadow-md flex items-center gap-1.5 transition-all"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>
                    Import & Convert ({selectedTrackIds.size})
                  </span>
                </button>
              </div>

              <div className="max-h-72 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {info.tracks.map((track, idx) => {
                  const isSelected = selectedTrackIds.has(track.id);
                  return (
                    <div
                      key={track.id}
                      onClick={() => toggleSelectTrack(track.id)}
                      className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? "bg-slate-900 border-red-500/50 shadow-sm"
                          : "bg-slate-950/40 border-slate-800/80 hover:border-slate-700"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelectTrack(track.id);
                        }}
                        className="text-slate-400 hover:text-white"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-red-500" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-600" />
                        )}
                      </button>

                      <span className="text-xs font-mono text-slate-500 w-5 text-right">
                        {idx + 1}
                      </span>

                      {track.thumbnail && (
                        <img
                          src={track.thumbnail}
                          alt={track.title}
                          className="w-12 h-9 object-cover rounded shadow-sm flex-shrink-0"
                        />
                      )}

                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-200 truncate">
                          {track.title}
                        </p>
                        {track.author && (
                          <p className="text-[11px] text-slate-400 truncate">
                            {track.author}
                          </p>
                        )}
                      </div>

                      {track.duration && (
                        <span className="text-[11px] font-mono text-slate-400 flex-shrink-0">
                          {formatDuration(track.duration)}
                        </span>
                      )}

                      <button
                        type="button"
                        disabled={isConverting}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleConvertSingle(track);
                        }}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-600/20 hover:text-red-400 text-slate-400 transition-colors"
                        title="Convert this single track"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
