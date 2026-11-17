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
      // Reset input value so re-selecting the same file works
      e.target.value = "";
    }
  };

  return (
    <div
      className={`relative rounded-2xl transition-all cursor-pointer group overflow-hidden ${
        dragActive
          ? "shadow-2xl shadow-cyan-500/20"
          : ""
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
        multiple
      />

      {/* Animated border glow on drag */}
      <div className={`absolute inset-0 rounded-2xl border-2 border-dashed transition-all duration-300 pointer-events-none ${
        dragActive
          ? "border-cyan-400 opacity-100"
          : "border-slate-700/80 group-hover:border-slate-600 opacity-100"
      }`} />

      {/* Background */}
      <div className={`absolute inset-0 rounded-2xl transition-all duration-300 ${
        dragActive
          ? "bg-cyan-950/25"
          : "bg-slate-950/50 group-hover:bg-slate-900/60"
      }`} />

      <div className="relative z-10 flex flex-col items-center gap-5 py-10 px-6 sm:px-8">
        {/* Icon */}
        <div className={`p-5 rounded-2xl border transition-all duration-300 shadow-xl ${
          dragActive
            ? "bg-cyan-500/20 border-cyan-500/60 scale-110 shadow-cyan-500/30"
            : "bg-gradient-to-br from-cyan-500/10 via-purple-500/10 to-indigo-500/5 border-slate-700/60 group-hover:border-cyan-500/40 group-hover:scale-105"
        }`}>
          {dragActive ? (
            <Music className="h-9 w-9 text-cyan-300" />
          ) : (
            <Upload className="h-9 w-9 text-cyan-400 group-hover:text-cyan-300 transition-colors" />
          )}
        </div>

        {/* Text */}
        <div className="text-center space-y-1.5">
          <h3 className="text-sm sm:text-base font-semibold text-slate-100">
            {dragActive ? "Release to add to queue" : "Drop audio files here or click to browse"}
          </h3>
          <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
            {isConverting
              ? "Queue is processing — you can still add more tracks anytime."
              : "Lossless in-browser conversion. All processing stays on your device."}
          </p>
          {isConverting && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 px-2.5 py-1 rounded-full mt-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              Queue Processing
            </span>
          )}
        </div>

        {/* Format Pills */}
        <div className="flex flex-wrap items-center justify-center gap-1.5 text-[10px] sm:text-[11px] font-mono text-slate-500">
          {["MP3", "WAV", "M4A", "FLAC", "OGG"].map((fmt) => (
            <span key={fmt} className="px-2 py-0.5 bg-slate-900/80 rounded-md border border-slate-800/80 text-slate-400">
              {fmt}
            </span>
          ))}
          <span className="px-2 py-0.5 bg-slate-900/80 rounded-md border border-slate-800/80 text-slate-500">
            Max {maxFileSize / 1024 / 1024} MB
          </span>
          <span className="px-2 py-0.5 bg-slate-900/80 rounded-md border border-slate-800/80 text-slate-500">
            Batch ✓
          </span>
        </div>
      </div>
    </div>
  );
}
