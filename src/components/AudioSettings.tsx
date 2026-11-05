"use client";

import React, { useState } from "react";
import { Sliders, RotateCw, RotateCcw, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
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
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mb-6">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-5 py-3.5 flex items-center justify-between bg-slate-50 hover:bg-slate-100 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-blue-600" />
          <span className="font-semibold text-slate-800 text-sm">
            8D Spatial Audio Settings & Presets
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
            {selectedPresetId.toUpperCase()}
          </span>
        </div>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-slate-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-500" />
        )}
      </button>

      {isOpen && (
        <div className="p-5 space-y-6">
          {/* Preset Chips */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Effect Presets
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => handlePresetSelect(preset.id)}
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    selectedPresetId === preset.id
                      ? "border-blue-600 bg-blue-50/70 text-blue-900 ring-1 ring-blue-500"
                      : "border-slate-200 hover:border-slate-300 bg-white text-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-medium text-xs">
                    <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                    <span>{preset.name}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">
                    {preset.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Granular Sliders */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-slate-100">
            {/* Rotation Speed */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-medium text-slate-700">
                <span>Orbit Speed</span>
                <span className="text-blue-600 font-mono font-semibold">
                  {options.rotationSpeed}s / revolution
                </span>
              </div>
              <input
                type="range"
                min={4}
                max={30}
                step={1}
                disabled={disabled}
                value={options.rotationSpeed}
                onChange={(e) =>
                  handleOptionChange("rotationSpeed", parseFloat(e.target.value))
                }
                className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-slate-200 accent-blue-600"
              />
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>Fast (4s)</span>
                <span>Slow (30s)</span>
              </div>
            </div>

            {/* Bass Boost */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-medium text-slate-700">
                <span>Bass Enhancement</span>
                <span className="text-blue-600 font-mono font-semibold">
                  +{options.bassBoost} dB
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={10}
                step={0.5}
                disabled={disabled}
                value={options.bassBoost}
                onChange={(e) =>
                  handleOptionChange("bassBoost", parseFloat(e.target.value))
                }
                className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-slate-200 accent-blue-600"
              />
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>Flat (0 dB)</span>
                <span>Max Punch (+10 dB)</span>
              </div>
            </div>

            {/* Reverb Level */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-medium text-slate-700">
                <span>Spatial Reverb Room</span>
                <span className="text-blue-600 font-mono font-semibold">
                  {Math.round(options.reverbLevel * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={0.4}
                step={0.02}
                disabled={disabled}
                value={options.reverbLevel}
                onChange={(e) =>
                  handleOptionChange("reverbLevel", parseFloat(e.target.value))
                }
                className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-slate-200 accent-blue-600"
              />
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>Dry / Intimate (0%)</span>
                <span>Concert Hall (40%)</span>
              </div>
            </div>

            {/* Rotation Direction */}
            <div className="space-y-2">
              <span className="block text-xs font-medium text-slate-700">
                Orbit Direction
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => handleOptionChange("direction", "clockwise")}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-medium transition-all ${
                    options.direction === "clockwise"
                      ? "border-blue-600 bg-blue-50 text-blue-700 font-semibold"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  Clockwise
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() =>
                    handleOptionChange("direction", "counter-clockwise")
                  }
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-medium transition-all ${
                    options.direction === "counter-clockwise"
                      ? "border-blue-600 bg-blue-50 text-blue-700 font-semibold"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Counter-Clockwise
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
