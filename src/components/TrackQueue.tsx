/* eslint-disable @next/next/no-img-element */
"use client";

import React from "react";
import {
  RotateCw,
  Package,
  Sparkles,
  Music,
  Headphones,
  Play,
  Pause,
  Youtube,
  CheckCircle2,
  Clock,
  AlertCircle,
  Download,
  RefreshCw,
  MoreVertical,
  Trash2,
  Zap,
} from "lucide-react";
import { AudioFileItem } from "@/types";
import { getYouTubeUrl } from "./AudioConverter";


interface TrackQueueProps {
  audioFiles: AudioFileItem[];
  currentTrackIndex: number;
  isPlaying: boolean;
  isWakeLocked: boolean;
  isExportingPack: boolean;
  activeMenuTrackId?: string;
  onSelectTrack: (index: number) => void;
  onRetryAllFailed: () => void;
  onExportPack: () => void;
  onLoadDemoTrack: () => void;
  onClearAll: () => void;
  onGoToAddMusic: () => void;
  onRetryTrack: (id: string) => void;
  onDownload: (url: string, name: string) => void;
  onReconvert: (index: number) => void;
  onRemoveTrack: (index: number) => void;
  onOpenMenu: (e: React.MouseEvent, item: AudioFileItem, index: number, isFromButton: boolean) => void;
  onCopyUrl: (url: string, label: string) => void;
}

export default function TrackQueue({
  audioFiles,
  currentTrackIndex,
  isPlaying,
  isWakeLocked,
  isExportingPack,
  activeMenuTrackId,
  onSelectTrack,
  onRetryAllFailed,
  onExportPack,
  onLoadDemoTrack,
  onClearAll,
  onGoToAddMusic,
  onRetryTrack,
  onDownload,
  onReconvert,
  onRemoveTrack,
  onOpenMenu,
  onCopyUrl,
}: TrackQueueProps) {
  const pendingTracks = audioFiles.filter(
    (f) => f.status === "pending" || f.status === "converting"
  );
  const failedTracks = audioFiles.filter((f) => f.status === "error");

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-3 sm:p-5 shadow-xl backdrop-blur-xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-100">
            Track Queue ({audioFiles.length})
          </h3>
          {pendingTracks.length > 0 && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
              {pendingTracks.length} Queued
            </span>
          )}
          {isWakeLocked && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 flex items-center gap-1">
              <Zap className="w-2.5 h-2.5 fill-current text-amber-400" />
              Screen Awake
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {failedTracks.length > 0 && (
            <button
              type="button"
              onClick={onRetryAllFailed}
              className="text-xs text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1 font-semibold px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/30 shadow-sm"
              title="Retry all failed tracks"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Retry Failed ({failedTracks.length})</span>
            </button>
          )}

          {audioFiles.some((f) => f.status === "complete") && (
            <button
              type="button"
              onClick={onExportPack}
              disabled={isExportingPack}
              className="text-xs text-purple-400 hover:text-purple-300 disabled:opacity-50 transition-colors flex items-center gap-1 font-semibold px-2.5 py-1 rounded-xl bg-purple-500/10 border border-purple-500/30 shadow-sm"
              title="Export all converted tracks as a portable .8dpack file"
            >
              <Package className="w-3.5 h-3.5" />
              <span>{isExportingPack ? "Exporting…" : "Export .8dpack"}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onLoadDemoTrack}
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
                onClick={onClearAll}
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
            onClick={onGoToAddMusic}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-all"
          >
            + Add Tracks Now
          </button>
        </div>
      ) : (
        <div className="space-y-3 max-h-[50vh] sm:max-h-[460px] overflow-y-auto pr-1 custom-scrollbar">
          {audioFiles.map((item, index) => {
            const isCurrent = currentTrackIndex === index;
            const ytLink = getYouTubeUrl(item);
            return (
              <div
                key={item.id}
                onContextMenu={(e) => onOpenMenu(e, item, index, false)}
                className={`p-3.5 rounded-2xl border transition-all ${
                  isCurrent
                    ? "bg-slate-950 border-cyan-500/60 shadow-lg shadow-cyan-500/5 ring-1 ring-cyan-500/30"
                    : "bg-slate-950/50 border-slate-800/80 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Track Thumbnail with Play/Pause Overlay */}
                  <button
                    type="button"
                    onClick={() => onSelectTrack(index)}
                    className="relative w-11 h-11 sm:w-12 sm:h-12 rounded-xl overflow-hidden bg-slate-900 border border-slate-800 shrink-0 flex items-center justify-center group/cover shadow-md transition-transform active:scale-95"
                    title="Load in deck"
                  >
                    {item.thumbnail ? (
                      <img
                        src={item.thumbnail}
                        alt={item.name}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover/cover:scale-110"
                      />
                    ) : (
                      <Headphones className="w-5 h-5 text-slate-500" />
                    )}
                    <div
                      className={`absolute inset-0 flex items-center justify-center transition-all ${
                        isCurrent && isPlaying
                          ? "bg-cyan-950/70 text-cyan-300 backdrop-blur-[1px]"
                          : "bg-slate-950/40 text-white opacity-0 group-hover/cover:opacity-100 backdrop-blur-[1px]"
                      }`}
                    >
                      {isCurrent && isPlaying ? (
                        <Pause className="w-5 h-5 fill-current" />
                      ) : (
                        <Play className="w-5 h-5 fill-current ml-0.5" />
                      )}
                    </div>
                  </button>

                  {/* Track Info */}
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => onSelectTrack(index)}
                  >
                    <div className="flex items-center gap-1.5">
                      <h4
                        className={`text-xs md:text-sm font-semibold truncate transition-colors ${
                          isCurrent ? "text-cyan-300 font-bold" : "text-slate-100"
                        }`}
                      >
                        {item.name}
                      </h4>
                      {isCurrent && isPlaying && (
                        <span className="flex items-end gap-0.5 h-3 shrink-0 ml-1" title="Now playing">
                          <span className="w-0.5 h-3 bg-cyan-400 animate-pulse rounded-full" />
                          <span className="w-0.5 h-2 bg-purple-400 animate-pulse rounded-full" style={{ animationDelay: "150ms" }} />
                          <span className="w-0.5 h-3.5 bg-cyan-300 animate-pulse rounded-full" style={{ animationDelay: "300ms" }} />
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                      <span className="truncate">{item.artist || "Audio"}</span>
                      {ytLink && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onCopyUrl(ytLink, "YouTube link");
                          }}
                          className="inline-flex items-center gap-1 text-[10px] text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 px-1.5 py-0.2 rounded transition-colors"
                          title="Click to copy YouTube audio link (or right-click / 3-dots)"
                        >
                          <Youtube className="w-2.5 h-2.5 fill-current text-red-500" />
                          <span className="font-mono">YouTube</span>
                        </button>
                      )}
                      <span className="text-slate-600">•</span>
                      {item.status === "complete" && (
                        <span className="text-emerald-400 font-mono font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          8D Ready
                        </span>
                      )}
                      {item.status === "converting" && (
                        <span className="text-cyan-400 font-mono flex items-center gap-1.5 flex-wrap">
                          <span className="animate-spin inline-block w-2.5 h-2.5 border border-cyan-400 border-t-transparent rounded-full" />
                          <span>{item.progress || 10}%</span>
                          {item.stage && (
                            <span className="text-cyan-300/80 font-sans text-[10px] truncate max-w-[130px] sm:max-w-[200px]">
                              • {item.stage}
                            </span>
                          )}
                        </span>
                      )}
                      {item.status === "pending" && (
                        <span className="text-amber-400 font-mono flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Pending in Queue
                        </span>
                      )}
                      {item.status === "error" && (
                        <span className="text-red-400 font-mono flex items-center gap-1.5 flex-wrap">
                          <AlertCircle className="w-3 h-3 shrink-0" />
                          <span>Failed</span>
                          {item.retryCount && item.retryCount > 0 ? (
                            <span className="text-slate-400 font-sans text-[10px]">
                              (Retried {item.retryCount}×)
                            </span>
                          ) : null}
                        </span>
                      )}
                    </div>

                    {/* Error Message Snippet */}
                    {item.status === "error" && item.error && (
                      <p className="text-[11px] text-red-300/80 truncate mt-1">
                        {item.error}
                      </p>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {/* Individual Retry Button for Failed Tracks */}
                    {item.status === "error" && (
                      <button
                        type="button"
                        onClick={() => onRetryTrack(item.id)}
                        className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-semibold flex items-center gap-1 transition-all shadow-sm"
                        title="Retry conversion"
                      >
                        <RotateCw className="w-3 h-3" />
                        <span>Retry</span>
                      </button>
                    )}

                    {item.status === "complete" && item.convertedUrl && (
                      <button
                        type="button"
                        onClick={() => onDownload(item.convertedUrl!, item.name)}
                        className="hidden sm:flex p-2 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 transition-all"
                        title="Download 8D Master (MP3)"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {item.status === "complete" && (
                      <button
                        type="button"
                        onClick={() => onReconvert(index)}
                        className="hidden sm:flex p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-all"
                        title="Re-convert with current 8D settings"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* 3-Dots More Options Menu Button */}
                    <button
                      type="button"
                      onClick={(e) => onOpenMenu(e, item, index, true)}
                      className={`p-2 rounded-lg transition-all border ${
                        activeMenuTrackId === item.id
                          ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-300"
                          : "bg-slate-900 border-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                      }`}
                      title="More options (Copy YouTube link, etc.)"
                    >
                      <MoreVertical className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onRemoveTrack(index)}
                      className="p-2 rounded-lg bg-slate-900 hover:bg-red-950/60 text-slate-500 hover:text-red-400 transition-all border border-slate-800/80"
                      title="Remove track"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Progress Bar for Converting Tracks */}
                {item.status === "converting" && (
                  <div className="mt-2.5 pt-2 border-t border-slate-900 space-y-1">
                    <div className="flex justify-between items-center text-[10px] font-mono">
                      <span className="text-cyan-300 font-medium truncate max-w-[240px] sm:max-w-xs">
                        {item.stage || "Processing audio..."}
                      </span>
                      <span className="text-cyan-400 font-bold">{item.progress || 10}%</span>
                    </div>
                    <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 h-1.5 transition-all duration-300"
                        style={{ width: `${Math.max(8, item.progress || 10)}%` }}
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
  );
}
