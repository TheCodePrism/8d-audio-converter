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

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load YouTube data.");
      }

      setInfo(data);
      // Select all tracks by default for playlists
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
    <div className="space-y-6">
      {/* Search Input Bar */}
      <form onSubmit={handleFetchInfo} className="space-y-2">
        <div className="relative flex items-center">
          <div className="absolute left-4 text-red-600 pointer-events-none">
            <Youtube className="w-5 h-5" />
          </div>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste YouTube Video or Playlist link (e.g., https://youtube.com/watch?v=...)"
            disabled={isLoading || isConverting}
            className="w-full pl-12 pr-28 py-3.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white transition-all text-slate-800 placeholder-slate-400"
          />
          <button
            type="submit"
            disabled={isLoading || !url.trim() || isConverting}
            className="absolute right-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            <span>{isLoading ? "Fetching..." : "Fetch"}</span>
          </button>
        </div>
        <p className="text-[11px] text-slate-500 pl-1">
          Supports single videos, official music tracks, and full playlists via yt-dlp.
        </p>
      </form>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Results Preview */}
      {info && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2">
              {info.isPlaylist ? (
                <ListMusic className="w-5 h-5 text-red-600" />
              ) : (
                <Youtube className="w-5 h-5 text-red-600" />
              )}
              <h3 className="font-bold text-slate-800 text-sm sm:text-base line-clamp-1">
                {info.title}
              </h3>
            </div>
            {info.isPlaylist && (
              <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-red-100 text-red-700">
                {info.tracks.length} Tracks
              </span>
            )}
          </div>

          {/* Single Video Card */}
          {!info.isPlaylist && info.tracks.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              {info.tracks[0].thumbnail && (
                <img
                  src={info.tracks[0].thumbnail}
                  alt={info.tracks[0].title}
                  className="w-full sm:w-36 h-24 object-cover rounded-lg shadow-sm"
                />
              )}
              <div className="flex-1 min-w-0 space-y-1">
                <h4 className="font-semibold text-slate-800 text-sm line-clamp-2">
                  {info.tracks[0].title}
                </h4>
                {info.tracks[0].author && (
                  <p className="text-xs text-slate-500">{info.tracks[0].author}</p>
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
                className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition-all shrink-0"
              >
                {isConverting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                <span>Convert to 8D Audio</span>
              </button>
            </div>
          )}

          {/* Playlist Track Selection List */}
          {info.isPlaylist && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-medium text-slate-600 px-1">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="flex items-center gap-1.5 hover:text-slate-900"
                >
                  {selectedTrackIds.size === info.tracks.length ? (
                    <CheckSquare className="w-4 h-4 text-red-600" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400" />
                  )}
                  <span>
                    Select All ({selectedTrackIds.size}/{info.tracks.length})
                  </span>
                </button>

                <button
                  type="button"
                  disabled={selectedTrackIds.size === 0 || isConverting}
                  onClick={handleConvertSelected}
                  className="px-4 py-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 disabled:opacity-40 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1.5 transition-all"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>
                    Convert {selectedTrackIds.size} Selected Track
                    {selectedTrackIds.size > 1 ? "s" : ""}
                  </span>
                </button>
              </div>

              <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                {info.tracks.map((track, idx) => {
                  const isSelected = selectedTrackIds.has(track.id);
                  return (
                    <div
                      key={track.id}
                      onClick={() => toggleSelectTrack(track.id)}
                      className={`flex items-center gap-3 p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                        isSelected
                          ? "bg-white border-red-300 shadow-sm"
                          : "bg-slate-100/60 border-transparent hover:bg-white"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelectTrack(track.id);
                        }}
                        className="text-red-600"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400" />
                        )}
                      </button>

                      <span className="text-xs font-mono text-slate-400 w-5">
                        {idx + 1}.
                      </span>

                      {track.thumbnail && (
                        <img
                          src={track.thumbnail}
                          alt=""
                          className="w-12 h-8 object-cover rounded shrink-0"
                        />
                      )}

                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-800 truncate">
                          {track.title}
                        </p>
                        {track.author && (
                          <p className="text-[11px] text-slate-400 truncate">
                            {track.author}
                          </p>
                        )}
                      </div>

                      {track.duration && (
                        <span className="text-[11px] font-mono text-slate-400 shrink-0">
                          {formatDuration(track.duration)}
                        </span>
                      )}
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
