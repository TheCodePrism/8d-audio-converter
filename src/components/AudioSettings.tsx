"use client";

import React, { useState } from "react";
import {
  Sliders,
  RotateCw,
  RotateCcw,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Volume2,
  Compass,
  Radio,
  Headphones,
  Zap,
  Award,
  Maximize2,
  ScanLine,
  Infinity,
  Activity,
  Building2,
  Church,
  Disc3,
} from "lucide-react";
import { AudioProcessingOptions } from "@/types";
import { PRESETS } from "@/lib/audioProcessing";

interface AudioSettingsProps {
  options: AudioProcessingOptions;
  onChange: (options: AudioProcessingOptions) => void;
  disabled?: boolean;
}

export default function AudioSettings({
  options,
  onChange,
  disabled = false,
}: AudioSettingsProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [selectedPresetId, setSelectedPresetId] = useState<string>("classic-8d");

  const handlePresetSelect = (presetId: string) => {
    setSelectedPresetId(presetId);
    const preset = PRESETS.find((p) => p.id === presetId);
    if (preset) {
      onChange({
        ...preset.options,
        exportQuality: options.exportQuality || "192",
        concurrency: options.concurrency || 2,
      });
    }
  };

  const handleOptionChange = (key: keyof AudioProcessingOptions, value: any) => {
    setSelectedPresetId("custom");
    onChange({
      ...options,
      [key]: value,
    });
  };

  return (
    <div className="rounded-2xl overflow-hidden border border-slate-800/80 shadow-2xl bg-slate-950/80 backdrop-blur-md">
      {/* ── Header Toggle ── */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-5 py-4 flex items-center justify-between bg-gradient-to-r from-slate-950/80 via-slate-900/60 to-slate-950/80 hover:from-slate-900/90 hover:to-slate-900/90 transition-all text-left border-b border-slate-800/60"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/10 text-cyan-400 border border-cyan-500/30 shadow-sm shadow-cyan-500/10">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-slate-100 text-sm tracking-tight block">
              8D Spatial Studio Console
            </span>
            <span className="text-[11px] text-slate-500">
              Fine-tune 360° orbit rotation, acoustic room reverb, &amp; bass boost
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="text-[10px] px-2.5 py-1 rounded-full bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-cyan-300 font-mono font-bold uppercase border border-cyan-500/30 tracking-wide">
            {selectedPresetId}
          </span>
          <div className="p-1.5 rounded-lg bg-slate-800/60 text-slate-400">
            {isOpen ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </div>
        </div>
      </button>

      {isOpen && (
        <div className="p-4 sm:p-5 space-y-5">

          {/* ── Preset Grid ── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-px flex-1 bg-slate-800/80" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500 px-2">
                Instant 8D Presets
              </span>
              <div className="h-px flex-1 bg-slate-800/80" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {PRESETS.map((preset) => {
                const isActive = selectedPresetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => handlePresetSelect(preset.id)}
                    className={`p-3 rounded-xl border text-left transition-all group/p relative overflow-hidden ${
                      isActive
                        ? "border-cyan-500/70 bg-gradient-to-br from-cyan-500/15 to-purple-500/10 text-cyan-200 shadow-lg shadow-cyan-500/10"
                        : "border-slate-800/80 hover:border-slate-700 bg-slate-900/40 hover:bg-slate-900/70 text-slate-300"
                    }`}
                  >
                    {isActive && (
                      <div className="absolute top-0 right-0 w-16 h-16 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />
                    )}
                    <div className="flex items-center gap-1.5 font-semibold text-[11px] mb-1">
                      <Sparkles
                        className={`w-3 h-3 flex-shrink-0 ${
                          isActive ? "text-cyan-400" : "text-slate-600 group-hover/p:text-slate-400"
                        }`}
                      />
                      <span className="truncate">{preset.name}</span>
                    </div>
                    <p className="text-[10px] text-slate-500 line-clamp-2 leading-relaxed">
                      {preset.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Granular Controls ── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-px flex-1 bg-slate-800/80" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500 px-2">
                Fine Controls
              </span>
              <div className="h-px flex-1 bg-slate-800/80" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Orbit Speed */}
              <div className="space-y-2.5 bg-slate-900/50 p-4 rounded-2xl border border-slate-800/60 hover:border-slate-700/60 transition-colors">
                <div className="flex justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-semibold text-slate-200">
                    <Compass className="w-3.5 h-3.5 text-cyan-400" />
                    Orbit Speed
                  </span>
                  <span className="text-cyan-400 font-mono font-bold bg-cyan-500/10 px-2 py-0.5 rounded-lg border border-cyan-500/20">
                    {options.rotationSpeed}s / loop
                  </span>
                </div>
                <input
                  type="range" min="2" max="30" step="1"
                  disabled={disabled}
                  value={options.rotationSpeed}
                  onChange={(e) => handleOptionChange("rotationSpeed", parseInt(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
                <div className="flex justify-between text-[10px] text-slate-600 font-mono">
                  <span>Fast (2s)</span><span>Normal (12s)</span><span>Cosmic (30s)</span>
                </div>
              </div>

              {/* Orbit Direction */}
              <div className="space-y-2.5 bg-slate-900/50 p-4 rounded-2xl border border-slate-800/60 hover:border-slate-700/60 transition-colors">
                <span className="block text-xs font-semibold text-slate-200">
                  Orbit Direction
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { val: "clockwise", label: "Clockwise ↻", icon: <RotateCw className="w-3.5 h-3.5" /> },
                    { val: "counter-clockwise", label: "Counter-CW ↺", icon: <RotateCcw className="w-3.5 h-3.5" /> },
                  ].map(({ val, label, icon }) => (
                    <button
                      key={val}
                      type="button"
                      disabled={disabled}
                      onClick={() => handleOptionChange("direction", val)}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                        options.direction === val
                          ? "border-cyan-500/70 bg-cyan-500/15 text-cyan-300 shadow-sm"
                          : "border-slate-800 hover:border-slate-700 text-slate-400"
                      }`}
                    >
                      {icon} {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Orbit Path Trajectory */}
              <div className="space-y-2.5 bg-slate-900/50 p-4 rounded-2xl border border-slate-800/60 hover:border-slate-700/60 transition-colors">
                <div className="flex justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-semibold text-slate-200">
                    <Compass className="w-3.5 h-3.5 text-cyan-400" />
                    Orbit Trajectory Path
                  </span>
                  <span className="text-cyan-400 font-mono font-bold bg-cyan-500/10 px-2 py-0.5 rounded-lg border border-cyan-500/20 capitalize">
                    {options.orbitPattern || "circle"}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { val: "circle", label: "Circle", sub: "360° Round", icon: <RotateCw className="w-3 h-3" /> },
                    { val: "figure8", label: "Figure-8", sub: "Infinity ∞", icon: <Infinity className="w-3 h-3" /> },
                    { val: "spiral", label: "Spiral", sub: "In-and-Out", icon: <Disc3 className="w-3 h-3" /> },
                    { val: "pendulum", label: "Pendulum", sub: "Left ↔ Right", icon: <Activity className="w-3 h-3" /> },
                  ].map(({ val, label, sub, icon }) => (
                    <button
                      key={val}
                      type="button"
                      disabled={disabled}
                      onClick={() => handleOptionChange("orbitPattern", val)}
                      className={`p-2 rounded-xl text-center border transition-all ${
                        (options.orbitPattern || "circle") === val
                          ? "border-cyan-500/70 bg-cyan-500/15 text-cyan-200 shadow-sm shadow-cyan-500/10"
                          : "border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 bg-slate-900/40"
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1 text-xs font-bold">
                        {icon}
                        {label}
                      </div>
                      <span className="text-[10px] text-slate-500 block mt-0.5">{sub}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Room Reverb */}
              <div className="space-y-2.5 bg-slate-900/50 p-4 rounded-2xl border border-slate-800/60 hover:border-slate-700/60 transition-colors">
                <div className="flex justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-semibold text-slate-200">
                    <Radio className="w-3.5 h-3.5 text-purple-400" />
                    Room Reverb &amp; Acoustic Space
                  </span>
                  <span className="text-purple-400 font-mono font-bold bg-purple-500/10 px-2 py-0.5 rounded-lg border border-purple-500/20">
                    {Math.round(options.reverbLevel * 100)}% Wet
                  </span>
                </div>
                <input
                  type="range" min="0" max="0.5" step="0.02"
                  disabled={disabled}
                  value={options.reverbLevel}
                  onChange={(e) => handleOptionChange("reverbLevel", parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-400"
                />
                <div className="flex justify-between text-[10px] text-slate-600 font-mono">
                  <span>0% (Studio Dry)</span><span>15% (Natural)</span><span>50% (Cathedral)</span>
                </div>
                <div className="grid grid-cols-4 gap-1.5 pt-1">
                  {[
                    { val: "studio", label: "Booth", icon: <Radio className="w-2.5 h-2.5" /> },
                    { val: "club", label: "Club", icon: <Building2 className="w-2.5 h-2.5" /> },
                    { val: "hall", label: "Hall", icon: <Sparkles className="w-2.5 h-2.5" /> },
                    { val: "cathedral", label: "Cathedral", icon: <Church className="w-2.5 h-2.5" /> },
                  ].map(({ val, label, icon }) => (
                    <button
                      key={val}
                      type="button"
                      disabled={disabled}
                      onClick={() => handleOptionChange("reverbRoom", val)}
                      className={`py-1.5 px-1 rounded-lg text-center border transition-all text-[11px] font-semibold flex items-center justify-center gap-1 ${
                        (options.reverbRoom || "club") === val
                          ? "border-purple-500/70 bg-purple-500/20 text-purple-200 shadow-sm"
                          : "border-slate-800/80 hover:border-slate-700 text-slate-400 hover:text-slate-300 bg-slate-900/60"
                      }`}
                    >
                      {icon}
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sub-Bass Boost */}
              <div className="space-y-2.5 bg-slate-900/50 p-4 rounded-2xl border border-slate-800/60 hover:border-slate-700/60 transition-colors">
                <div className="flex justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-semibold text-slate-200">
                    <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                    Sub-Bass Boost
                  </span>
                  <span className="text-emerald-400 font-mono font-bold bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                    +{options.bassBoost} dB
                  </span>
                </div>
                <input
                  type="range" min="0" max="12" step="1"
                  disabled={disabled}
                  value={options.bassBoost}
                  onChange={(e) => handleOptionChange("bassBoost", parseInt(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                />
                <div className="flex justify-between text-[10px] text-slate-600 font-mono">
                  <span>Flat (0 dB)</span><span>Club (+4 dB)</span><span>Max (+12 dB)</span>
                </div>
              </div>

              {/* 16D Vertical Elevation */}
              <div className="space-y-2.5 bg-slate-900/50 p-4 rounded-2xl border border-slate-800/60 hover:border-slate-700/60 transition-colors">
                <div className="flex justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-semibold text-slate-200">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    16D Vertical Elevation
                  </span>
                  <span className="text-cyan-400 font-mono font-bold bg-cyan-500/10 px-2 py-0.5 rounded-lg border border-cyan-500/20">
                    {options.verticalOrbit !== false ? "16D Sphere" : "Flat 8D"}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { val: true, label: "3D Helical ↕" },
                    { val: false, label: "Flat Ring ↔" },
                  ].map(({ val, label }) => (
                    <button
                      key={String(val)}
                      type="button"
                      disabled={disabled}
                      onClick={() => handleOptionChange("verticalOrbit", val)}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                        (val === true ? options.verticalOrbit !== false : options.verticalOrbit === false)
                          ? "border-cyan-500/70 bg-cyan-500/15 text-cyan-300 shadow-sm"
                          : "border-slate-800 hover:border-slate-700 text-slate-400"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-600 leading-relaxed">
                  Sweeps sound vertically over your head and below ear level in true 3D space.
                </p>
              </div>

              {/* Center Vocal Anchor */}
              <div className="space-y-2.5 bg-slate-900/50 p-4 rounded-2xl border border-slate-800/60 hover:border-slate-700/60 transition-colors">
                <div className="flex justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-semibold text-slate-200">
                    <Headphones className="w-3.5 h-3.5 text-amber-400" />
                    Center Vocal Anchor
                  </span>
                  <span className="text-amber-400 font-mono font-bold bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20">
                    {Math.round((options.centerAnchor ?? 0.18) * 100)}%
                  </span>
                </div>
                <input
                  type="range" min="0" max="0.45" step="0.05"
                  disabled={disabled}
                  value={options.centerAnchor ?? 0.18}
                  onChange={(e) => handleOptionChange("centerAnchor", parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                />
                <div className="flex justify-between text-[10px] text-slate-600 font-mono">
                  <span>0% (Full 360)</span><span>18% (Anchored)</span><span>45% (Arena)</span>
                </div>
                <p className="text-[10px] text-slate-600 leading-relaxed">
                  Keeps vocals and kick drum grounded in front while spatial instruments orbit in 3D.
                </p>
              </div>

              {/* Spatial Radius */}
              <div className="space-y-2.5 bg-slate-900/50 p-4 rounded-2xl border border-slate-800/60 hover:border-slate-700/60 transition-colors">
                <div className="flex justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-semibold text-slate-200">
                    <Maximize2 className="w-3.5 h-3.5 text-sky-400" />
                    Spatial Radius
                  </span>
                  <span className="text-sky-400 font-mono font-bold bg-sky-500/10 px-2 py-0.5 rounded-lg border border-sky-500/20">
                    {options.spatialRadius.toFixed(1)} m
                  </span>
                </div>
                <input
                  type="range" min="1" max="4" step="0.1"
                  disabled={disabled}
                  value={options.spatialRadius}
                  onChange={(e) => handleOptionChange("spatialRadius", parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-400"
                />
                <div className="flex justify-between text-[10px] text-slate-600 font-mono">
                  <span>1.0 m (In-ear)</span><span>2.5 m (Studio)</span><span>4.0 m (Arena)</span>
                </div>
                <p className="text-[10px] text-slate-600 leading-relaxed">
                  Virtual distance from the listener to the orbiting sound source.
                </p>
              </div>

              {/* Stereo Width */}
              <div className="space-y-2.5 bg-slate-900/50 p-4 rounded-2xl border border-slate-800/60 hover:border-slate-700/60 transition-colors">
                <div className="flex justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-semibold text-slate-200">
                    <ScanLine className="w-3.5 h-3.5 text-pink-400" />
                    Stereo Width
                  </span>
                  <span className="text-pink-400 font-mono font-bold bg-pink-500/10 px-2 py-0.5 rounded-lg border border-pink-500/20">
                    {Math.round(((options.stereoWidth ?? 0.28) / 0.6) * 100)}%
                  </span>
                </div>
                <input
                  type="range" min="0" max="0.6" step="0.02"
                  disabled={disabled}
                  value={options.stereoWidth ?? 0.28}
                  onChange={(e) => handleOptionChange("stereoWidth", parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-pink-400"
                />
                <div className="flex justify-between text-[10px] text-slate-600 font-mono">
                  <span>Mono-width</span><span>Default</span><span>Hyper-wide</span>
                </div>
                <p className="text-[10px] text-slate-600 leading-relaxed">
                  Angular spread between L/R stereo panners. Wider = broader soundstage.
                </p>
              </div>
            </div>
          </div>

          {/* ── Export Quality ── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-px flex-1 bg-slate-800/80" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500 px-2 flex items-center gap-1.5">
                <Zap className="w-3 h-3 text-purple-400" />
                Export Quality
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20">
                {options.exportQuality === "wav"
                  ? "Lossless WAV (Studio Master)"
                  : options.exportQuality === "320"
                  ? "320 kbps (Hi-Fi MP3)"
                  : "192 kbps (Compact MP3)"}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button" disabled={disabled}
                onClick={() => handleOptionChange("exportQuality", "192")}
                className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden group/q ${
                  (options.exportQuality || "192") === "192"
                    ? "border-cyan-500/60 bg-gradient-to-br from-cyan-500/10 to-slate-900/50 shadow-lg shadow-cyan-500/10"
                    : "border-slate-800/80 hover:border-slate-700 bg-slate-900/40"
                }`}
              >
                {(options.exportQuality || "192") === "192" && (
                  <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
                )}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-100">
                    <Zap className="w-3.5 h-3.5 text-cyan-400" />
                    MP3 – Compact
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    192k
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 font-medium">Default • ~5 MB</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Fastest export, ultra-smooth streaming, solid 8D fidelity.</p>
              </button>

              <button
                type="button" disabled={disabled}
                onClick={() => handleOptionChange("exportQuality", "320")}
                className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden group/q ${
                  options.exportQuality === "320"
                    ? "border-purple-500/60 bg-gradient-to-br from-purple-500/10 to-slate-900/50 shadow-lg shadow-purple-500/10"
                    : "border-slate-800/80 hover:border-slate-700 bg-slate-900/40"
                }`}
              >
                {options.exportQuality === "320" && (
                  <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
                )}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-100">
                    <Award className="w-3.5 h-3.5 text-purple-400" />
                    MP3 – Hi-Fi
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    320k
                  </span>
                </div>
                <p className="text-[11px] text-purple-200 font-medium">Audiophile • ~9 MB</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Maximum MP3 bitrate, pristine acoustic details &amp; reverb tails.</p>
              </button>

              <button
                type="button" disabled={disabled}
                onClick={() => handleOptionChange("exportQuality", "wav")}
                className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden group/q ${
                  options.exportQuality === "wav"
                    ? "border-amber-500/60 bg-gradient-to-br from-amber-500/10 to-slate-900/50 shadow-lg shadow-amber-500/10"
                    : "border-slate-800/80 hover:border-slate-700 bg-slate-900/40"
                }`}
              >
                {options.exportQuality === "wav" && (
                  <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
                )}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-100">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    Studio WAV
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Lossless
                  </span>
                </div>
                <p className="text-[11px] text-amber-200 font-medium">16-bit PCM • ~40 MB</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Zero compression loss, instant rendering, production-ready.</p>
              </button>
            </div>
          </div>

          {/* ── Parallel Conversions ── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-px flex-1 bg-slate-800/80" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500 px-2 flex items-center gap-1.5">
                <Zap className="w-3 h-3 text-cyan-400" />
                Parallel Conversions
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                {options.concurrency === 1 ? "1 Track at a time" : options.concurrency === 3 ? "3 Tracks in parallel" : "2 Tracks in parallel"}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { n: 1, label: "1× Single", sub: "YouTube Safe", highlight: true },
                { n: 2, label: "2× Parallel", sub: "Fast Desktop" },
                { n: 3, label: "3× Turbo", sub: "Local Files" },
              ].map(({ n, label, sub, highlight }) => {
                const active = (n === 1 ? options.concurrency === 1 : (n === 2 ? (options.concurrency || 2) === 2 : options.concurrency === n));
                return (
                  <button
                    key={n}
                    type="button" disabled={disabled}
                    onClick={() => handleOptionChange("concurrency", n)}
                    className={`py-3 px-2 rounded-2xl border text-center transition-all relative overflow-hidden ${
                      active
                        ? "border-cyan-500/60 bg-gradient-to-b from-cyan-500/15 to-slate-900/60 shadow-md shadow-cyan-500/10"
                        : "border-slate-800/80 hover:border-slate-700 bg-slate-900/40"
                    }`}
                  >
                    <span className={`block text-xs font-bold ${active ? "text-cyan-200" : "text-slate-300"}`}>{label}</span>
                    <span className={`text-[10px] block mt-0.5 ${active && highlight ? "text-cyan-400" : "text-slate-500"}`}>{sub}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-slate-600 mt-2 leading-relaxed">
              1× Single is recommended for cloud YouTube playlists to prevent rate limits. 2× and 3× Turbo process multiple local files simultaneously.
            </p>
          </div>

        </div>
      )}
    </div>
  );
}
