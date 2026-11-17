"use client";

import React from "react";
import {
  Youtube,
  Copy,
  ExternalLink,
  Download,
  RefreshCw,
  RotateCw,
  Trash2,
} from "lucide-react";
import { AudioFileItem } from "@/types";
import { getYouTubeUrl } from "./AudioConverter";

export interface ContextMenuState {
  item: AudioFileItem;
  index: number;
  x: number;
  y: number;
}

interface TrackContextMenuProps {
  activeMenu: ContextMenuState | null;
  menuRef: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
  onCopy: (text: string, label: string) => void;
  onDownload?: (url: string, name: string) => void;
  onReconvert: (index: number) => void;
  onRetry: (id: string) => void;
  onRemove: (index: number) => void;
}

export default function TrackContextMenu({
  activeMenu,
  menuRef,
  onClose,
  onCopy,
  onDownload,
  onReconvert,
  onRetry,
  onRemove,
}: TrackContextMenuProps) {
  if (!activeMenu) return null;

  const ytUrl = getYouTubeUrl(activeMenu.item);

  return (
    <div
      ref={menuRef}
      style={{
        top: `${activeMenu.y}px`,
        left: `${activeMenu.x}px`,
      }}
      className="fixed z-50 w-64 rounded-2xl bg-slate-900/95 border border-slate-700/80 shadow-2xl backdrop-blur-xl p-1.5 text-xs text-slate-200 animate-in fade-in zoom-in-95 duration-150 select-none divide-y divide-slate-800/80"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Track Summary Header */}
      <div className="px-3 py-2">
        <p className="font-semibold text-slate-100 truncate text-xs">
          {activeMenu.item.name}
        </p>
        <p className="text-[11px] text-slate-400 truncate mt-0.5">
          {activeMenu.item.artist || "8D Audio"}
        </p>
      </div>

      {/* YouTube Actions */}
      {ytUrl && (
        <div className="py-1">
          <button
            type="button"
            onClick={() => {
              onCopy(ytUrl, "YouTube link");
              onClose();
            }}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-red-500/15 hover:text-red-300 text-slate-200 text-left transition-colors font-medium group"
          >
            <div className="w-6 h-6 rounded-lg bg-red-500/15 flex items-center justify-center text-red-500 flex-shrink-0 group-hover:scale-105 transition-transform">
              <Youtube className="w-3.5 h-3.5 fill-current" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-red-400">Copy YouTube Link</span>
                <Copy className="w-3 h-3 text-slate-400 group-hover:text-red-300" />
              </div>
              <p className="text-[10px] text-slate-400/80 truncate font-mono mt-0.5">
                {ytUrl.replace(/^https?:\/\/(www\.)?/, "")}
              </p>
            </div>
          </button>

          <a
            href={ytUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-slate-800 text-slate-300 text-left transition-colors font-medium group"
          >
            <div className="w-6 h-6 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 flex-shrink-0 group-hover:text-cyan-400">
              <ExternalLink className="w-3.5 h-3.5" />
            </div>
            <span>Open on YouTube</span>
          </a>
        </div>
      )}

      {/* General Actions */}
      <div className="py-1">
        <button
          type="button"
          onClick={() => {
            onCopy(
              `${activeMenu.item.name} - ${activeMenu.item.artist || "8D Audio"}`,
              "song title"
            );
            onClose();
          }}
          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-slate-800 text-slate-300 text-left transition-colors font-medium"
        >
          <div className="w-6 h-6 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 flex-shrink-0">
            <Copy className="w-3.5 h-3.5" />
          </div>
          <span>Copy Track Title</span>
        </button>

        {activeMenu.item.status === "complete" && activeMenu.item.convertedUrl && onDownload && (
          <button
            type="button"
            onClick={() => {
              onDownload(activeMenu.item.convertedUrl!, activeMenu.item.name);
              onClose();
            }}
            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-cyan-500/15 text-cyan-300 text-left transition-colors font-medium"
          >
            <div className="w-6 h-6 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400 flex-shrink-0">
              <Download className="w-3.5 h-3.5" />
            </div>
            <span>Download 8D Master (MP3)</span>
          </button>
        )}

        {activeMenu.item.status === "complete" && (
          <button
            type="button"
            onClick={() => {
              onReconvert(activeMenu.index);
              onClose();
            }}
            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-slate-800 text-slate-300 text-left transition-colors font-medium"
          >
            <div className="w-6 h-6 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 flex-shrink-0">
              <RefreshCw className="w-3.5 h-3.5" />
            </div>
            <span>Re-convert with 8D Deck</span>
          </button>
        )}

        {activeMenu.item.status === "error" && (
          <button
            type="button"
            onClick={() => {
              onRetry(activeMenu.item.id);
              onClose();
            }}
            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-amber-500/15 text-amber-300 text-left transition-colors font-medium"
          >
            <div className="w-6 h-6 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-400 flex-shrink-0">
              <RotateCw className="w-3.5 h-3.5" />
            </div>
            <span>Retry Conversion</span>
          </button>
        )}
      </div>

      {/* Destructive Actions */}
      <div className="pt-1">
        <button
          type="button"
          onClick={() => {
            onRemove(activeMenu.index);
            onClose();
          }}
          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-red-500/20 text-red-400 text-left transition-colors font-medium"
        >
          <div className="w-6 h-6 rounded-lg bg-red-950/40 flex items-center justify-center text-red-400 flex-shrink-0">
            <Trash2 className="w-3.5 h-3.5" />
          </div>
          <span>Remove from Queue</span>
        </button>
      </div>
    </div>
  );
}
