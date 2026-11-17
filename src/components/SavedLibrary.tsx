/* eslint-disable @next/next/no-img-element */
"use client";

import React from "react";
import {
  HardDrive,
  FolderUp,
  FolderDown,
  Trash2,
  Headphones,
  Youtube,
  Play,
} from "lucide-react";
import { SavedTrackRecord, StorageQuotaInfo } from "@/lib/storage";
import { getYouTubeUrl } from "./AudioConverter";

interface SavedLibraryProps {
  savedLibrary: SavedTrackRecord[];
  storageQuota: StorageQuotaInfo | null;
  isImportingPack: boolean;
  onImportClick: () => void;
  onLoadAll: () => void;
  onClearAll: () => void;
  onLoadTrack: (record: SavedTrackRecord) => void;
  onDeleteTrack: (id: string) => void;
  onCopyUrl: (url: string, label: string) => void;
}

export default function SavedLibrary({
  savedLibrary,
  storageQuota,
  isImportingPack,
  onImportClick,
  onLoadAll,
  onClearAll,
  onLoadTrack,
  onDeleteTrack,
  onCopyUrl,
}: SavedLibraryProps) {
  return (
    <div className="space-y-3">
      {/* Library Header Actions */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
          <HardDrive className="w-3.5 h-3.5 text-purple-400" />
          Offline 8D Library
          {savedLibrary.length > 0 && (
            <span className="text-[10px] font-mono text-slate-500">
              ({savedLibrary.length} track{savedLibrary.length !== 1 ? "s" : ""})
            </span>
          )}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onImportClick}
            disabled={isImportingPack}
            className="text-xs text-emerald-400 hover:text-emerald-300 disabled:opacity-50 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 font-semibold transition-all"
            title="Import a .8dpack file"
          >
            <FolderUp className="w-3.5 h-3.5" />
            <span>{isImportingPack ? "Importing…" : "Import"}</span>
          </button>
          {savedLibrary.length > 0 && (
            <>
              <button
                type="button"
                onClick={onLoadAll}
                className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/30 font-semibold transition-all"
                title="Load all saved tracks into queue"
              >
                <FolderDown className="w-3.5 h-3.5" />
                <span>Load All</span>
              </button>
              <button
                type="button"
                onClick={onClearAll}
                className="text-xs text-slate-500 hover:text-red-400 flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-red-500/10 transition-all"
                title="Clear all saved tracks from browser storage"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Storage Quota Usage Meter */}
      {storageQuota && (
        <div className="p-2.5 rounded-xl bg-slate-950/40 border border-slate-800/80 space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400 flex items-center gap-1 font-mono">
              <HardDrive className="w-3 h-3 text-purple-400" />
              Storage Quota
            </span>
            <span className="font-mono text-purple-300 font-semibold text-[10px]">
              {storageQuota.usageMB} MB /{" "}
              {storageQuota.quotaMB > 1024
                ? `${(storageQuota.quotaMB / 1024).toFixed(1)} GB`
                : `${storageQuota.quotaMB} MB`}{" "}
              ({storageQuota.percentage}%)
            </span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-purple-500 to-cyan-400 h-1.5 rounded-full transition-all duration-300"
              style={{
                width: `${Math.min(100, Math.max(1, storageQuota.percentage))}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Library Track List */}
      {savedLibrary.length === 0 ? (
        <div className="py-10 text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-full bg-slate-900 flex items-center justify-center border border-slate-800">
            <HardDrive className="w-6 h-6 text-slate-600" />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-400">No saved tracks yet</p>
            <p className="text-[11px] text-slate-500 max-w-[220px] mx-auto">
              Convert a song and it will auto-save here. You can also import a{" "}
              <span className="font-mono text-purple-400">.8dpack</span> file.
            </p>
          </div>
          <button
            type="button"
            onClick={onImportClick}
            disabled={isImportingPack}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-500/10 hover:bg-purple-500/20 disabled:opacity-50 border border-purple-500/30 text-purple-300 text-xs font-semibold rounded-xl transition-all"
          >
            <FolderUp className="w-3.5 h-3.5" />
            Import .8dpack File
          </button>
        </div>
      ) : (
        <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1 custom-scrollbar">
          {savedLibrary.map((record) => {
            const yt = getYouTubeUrl(record);
            return (
              <div
                key={record.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-purple-500/30 transition-all group"
              >
                {/* Thumbnail / Icon */}
                <div className="w-9 h-9 rounded-lg flex-shrink-0 overflow-hidden bg-slate-900 border border-slate-800 flex items-center justify-center">
                  {record.thumbnail ? (
                    <img
                      src={record.thumbnail}
                      alt={record.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Headphones className="w-4 h-4 text-purple-400" />
                  )}
                </div>

                {/* Track Meta */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-100 truncate">
                    {record.name}
                  </p>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                    <span className="truncate">{record.artist || "8D Master"}</span>
                    <span>•</span>
                    <span className="font-mono whitespace-nowrap">
                      {(record.size / 1024 / 1024).toFixed(1)} MB
                    </span>
                    <span>•</span>
                    <span className="whitespace-nowrap">
                      {new Date(record.savedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Load + Delete */}
                <div className="flex items-center gap-1.5 flex-shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
                  {yt && (
                    <button
                      type="button"
                      onClick={() => onCopyUrl(yt, "YouTube link")}
                      className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition-all"
                      title="Copy YouTube link"
                    >
                      <Youtube className="w-3.5 h-3.5 fill-current" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onLoadTrack(record)}
                    className="px-2.5 py-1.5 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 text-[11px] font-semibold flex items-center gap-1 transition-all"
                    title="Load into queue"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>Load</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteTrack(record.id)}
                    className="p-1.5 rounded-lg hover:bg-red-950/60 text-slate-600 hover:text-red-400 transition-all"
                    title="Delete from library"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Import hint */}
      {savedLibrary.length > 0 && (
        <p className="text-[11px] text-slate-600 text-center">
          Tracks auto-save after conversion •{" "}
          <button
            type="button"
            onClick={onImportClick}
            className="text-purple-400 hover:text-purple-300 underline underline-offset-2"
          >
            Import .8dpack
          </button>
        </p>
      )}
    </div>
  );
}
