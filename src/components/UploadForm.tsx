"use client";

import { useState, useRef } from "react";
import { Upload, Loader2, Music, Sparkles } from "lucide-react";

interface UploadFormProps {
  onUpload: (files: File[]) => void;
  isConverting: boolean;
  maxFileSize: number;
  supportedFormats: string[];
}

export default function UploadForm({
  onUpload,
  isConverting,
  maxFileSize,
  supportedFormats,
}: UploadFormProps) {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files).filter(
      (file) =>
        file.type.startsWith("audio/") ||
        file.name.match(/\.(mp3|wav|ogg|m4a|flac)$/i)
    );

    if (files.length > 0) {
      onUpload(files);
    } else {
      alert("Please upload valid audio files only (MP3, WAV, M4A, OGG, FLAC)");
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      onUpload(files);
    }
  };

  return (
    <div
      className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer relative overflow-hidden group ${
        dragActive
          ? "border-cyan-400 bg-cyan-950/20 shadow-xl shadow-cyan-500/10"
          : "border-slate-800 hover:border-slate-700 bg-slate-950/40 hover:bg-slate-900/40"
      }`}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac"
        onChange={handleChange}
        disabled={isConverting}
        multiple
      />

      <div className="space-y-4">
        <div className="flex justify-center">
          {isConverting ? (
            <div className="p-4 bg-cyan-500/10 rounded-2xl border border-cyan-500/30">
              <Loader2 className="h-10 w-10 text-cyan-400 animate-spin" />
            </div>
          ) : (
            <div className="p-4 bg-gradient-to-tr from-cyan-500/10 via-purple-500/10 to-indigo-500/10 rounded-2xl border border-slate-700/60 group-hover:scale-105 group-hover:border-cyan-500/50 transition-all shadow-lg">
              <Upload className="h-10 w-10 text-cyan-400" />
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <h3 className="text-base font-semibold text-slate-100 flex items-center justify-center gap-2">
            <span>{isConverting ? "Processing Audio Engine..." : "Drop audio files here or click to browse"}</span>
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Lossless in-browser conversion. Your audio never leaves your device.
          </p>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-2 text-[11px] text-slate-400 font-mono">
            <span className="px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800">
              MP3, WAV, M4A, OGG, FLAC
            </span>
            <span className="px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800">
              Up to {maxFileSize / 1024 / 1024}MB
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
