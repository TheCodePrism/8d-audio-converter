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
      onChange(preset.options);
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
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl backdrop-blur-md overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-5 py-4 flex items-center justify-between bg-slate-950/60 hover:bg-slate-950/80 transition-colors text-left border-b border-slate-800/80"
      >
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <span className="font-semibold text-slate-100 text-sm block">
              8D Spatial Studio Console
            </span>
            <span className="text-[11px] text-slate-400">
              Fine-tune 360° orbit rotation, acoustic room reverb, & bass boost
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono font-bold uppercase border border-cyan-500/30">
            {selectedPresetId}
          </span>
          {isOpen ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </button>

      {isOpen && (
        <div className="p-5 space-y-6">
          {/* Preset Chips */}
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-2.5">
              Instant 8D Presets
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {PRESETS.map((preset) => {
                const isActive = selectedPresetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => handlePresetSelect(preset.id)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      isActive
                        ? "border-cyan-500 bg-cyan-500/10 text-cyan-200 ring-1 ring-cyan-500 shadow-md shadow-cyan-500/10"
                        : "border-slate-800 hover:border-slate-700 bg-slate-950/40 text-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-semibold text-xs">
                      <Sparkles
                        className={`w-3.5 h-3.5 ${
                          isActive ? "text-cyan-400" : "text-slate-500"
                        }`}
                      />
                      <span>{preset.name}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                      {preset.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Granular Sliders in 2-Columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4 border-t border-slate-800/80">
            {/* Orbit Speed */}
            <div className="space-y-2 bg-slate-950/40 p-3.5 rounded-xl border border-slate-800/60">
              <div className="flex justify-between text-xs font-medium text-slate-300">
                <span className="flex items-center gap-1.5 text-slate-200">
                  <Compass className="w-3.5 h-3.5 text-cyan-400" />
                  Orbit Speed
                </span>
                <span className="text-cyan-400 font-mono font-bold">
                  {options.rotationSpeed}s / loop
                </span>
              </div>
              <input
                type="range"
                min="2"
                max="30"
                step="1"
                disabled={disabled}
                value={options.rotationSpeed}
                onChange={(e) =>
                  handleOptionChange("rotationSpeed", parseInt(e.target.value))
                }
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>Fast (2s)</span>
                <span>Normal (12s)</span>
                <span>Cosmic (30s)</span>
              </div>
            </div>

            {/* Orbit Direction */}
            <div className="space-y-2 bg-slate-950/40 p-3.5 rounded-xl border border-slate-800/60">
              <span className="block text-xs font-medium text-slate-300 mb-1">
                Orbit Direction
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => handleOptionChange("direction", "clockwise")}
                  className={`py-2 px-3 rounded-lg border text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                    options.direction === "clockwise"
                      ? "border-cyan-500 bg-cyan-500/20 text-cyan-300 shadow-sm"
                      : "border-slate-800 hover:border-slate-700 text-slate-400"
                  }`}
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  Clockwise ↻
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() =>
                    handleOptionChange("direction", "counter-clockwise")
                  }
                  className={`py-2 px-3 rounded-lg border text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                    options.direction === "counter-clockwise"
                      ? "border-cyan-500 bg-cyan-500/20 text-cyan-300 shadow-sm"
                      : "border-slate-800 hover:border-slate-700 text-slate-400"
                  }`}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Counter-CW ↺
                </button>
              </div>
            </div>

            {/* Concert Reverb */}
            <div className="space-y-2 bg-slate-950/40 p-3.5 rounded-xl border border-slate-800/60">
              <div className="flex justify-between text-xs font-medium text-slate-300">
                <span className="flex items-center gap-1.5 text-slate-200">
                  <Radio className="w-3.5 h-3.5 text-purple-400" />
                  Room Reverb
                </span>
                <span className="text-purple-400 font-mono font-bold">
                  {Math.round(options.reverbLevel * 100)}% Wet
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="0.5"
                step="0.02"
                disabled={disabled}
                value={options.reverbLevel}
                onChange={(e) =>
                  handleOptionChange("reverbLevel", parseFloat(e.target.value))
                }
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-400"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>0% (Studio Dry)</span>
                <span>15% (Natural)</span>
                <span>50% (Cathedral)</span>
              </div>
            </div>

            {/* Sub-Bass Boost */}
            <div className="space-y-2 bg-slate-950/40 p-3.5 rounded-xl border border-slate-800/60">
              <div className="flex justify-between text-xs font-medium text-slate-300">
                <span className="flex items-center gap-1.5 text-slate-200">
                  <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                  Sub-Bass Boost
                </span>
                <span className="text-emerald-400 font-mono font-bold">
                  +{options.bassBoost} dB
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="12"
                step="1"
                disabled={disabled}
                value={options.bassBoost}
                onChange={(e) =>
                  handleOptionChange("bassBoost", parseInt(e.target.value))
                }
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>Flat (0 dB)</span>
                <span>Club (+4 dB)</span>
                <span>Max (+12 dB)</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
