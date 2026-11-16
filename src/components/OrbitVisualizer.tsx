/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useEffect, useRef } from "react";
import { Headphones, Compass, Activity, Disc3 } from "lucide-react";
import { AudioProcessingOptions } from "@/types";

export interface OrbitVisualizerProps {
  isPlaying: boolean;
  options: AudioProcessingOptions;
  currentTime?: number;
  coverImage?: string;
  title?: string;
  artist?: string;
  is8DReady?: boolean;
}

export default function OrbitVisualizer({
  isPlaying,
  options,
  currentTime,
  coverImage,
  title,
  artist,
  is8DReady = false,
}: OrbitVisualizerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const angleRef = useRef<number>(0);
  const angleTextRef = useRef<HTMLSpanElement | null>(null);
  const earPanRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Retina & High-DPI support for crisp radar lines
    const dpr = Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 2);
    const size = 320;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    let lastTime = performance.now();
    let frameCount = 0;

    const render = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      const centerX = size / 2;
      const centerY = size / 2;
      const radius = (size / 2) * 0.72;

      // Update rotation angle
      const speed = Math.max(2, options.rotationSpeed || 12);
      const angularVelocity = (2 * Math.PI) / speed;
      const dirMultiplier = options.direction === "counter-clockwise" ? -1 : 1;

      if (currentTime !== undefined && isPlaying) {
        angleRef.current = dirMultiplier * ((2 * Math.PI * currentTime) / speed);
      } else if (isPlaying) {
        angleRef.current += dirMultiplier * angularVelocity * dt;
      }

      // Calculate degrees (0 - 360) for HUD without triggering React re-renders
      const rawDeg = ((angleRef.current * 180) / Math.PI) % 360;
      const positiveDeg = Math.round(rawDeg < 0 ? rawDeg + 360 : rawDeg);

      frameCount++;
      if (frameCount % 6 === 0) {
        if (angleTextRef.current) {
          angleTextRef.current.textContent = `${positiveDeg}°`;
        }
        if (earPanRef.current) {
          const sinVal = Math.sin(angleRef.current);
          if (sinVal > 0.3) {
            earPanRef.current.textContent = `Right (${Math.round(sinVal * 100)}%)`;
          } else if (sinVal < -0.3) {
            earPanRef.current.textContent = `Left (${Math.round(Math.abs(sinVal) * 100)}%)`;
          } else {
            earPanRef.current.textContent = "Center";
          }
        }
      }

      // Clear previous frame (100% transparent to let the cover image shine through)
      ctx.clearRect(0, 0, size, size);

      // Subtle center shadow vignette so listener avatar and radar lines pop over light album covers
      const centerShade = ctx.createRadialGradient(centerX, centerY, radius * 0.2, centerX, centerY, radius * 1.15);
      centerShade.addColorStop(0, "rgba(7, 11, 20, 0.45)");
      centerShade.addColorStop(0.7, "rgba(7, 11, 20, 0.20)");
      centerShade.addColorStop(1, "rgba(7, 11, 20, 0.65)");
      ctx.fillStyle = centerShade;
      ctx.fillRect(0, 0, size, size);

      // Outer radar rings (vibrant neon cyan & purple)
      [1.0, 0.72, 0.44].forEach((factor, idx) => {
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius * factor, 0, 2 * Math.PI);
        ctx.strokeStyle =
          idx === 0
            ? isPlaying
              ? "rgba(56, 189, 248, 0.65)"
              : "rgba(56, 189, 248, 0.30)"
            : idx === 1
            ? "rgba(168, 85, 247, 0.40)"
            : "rgba(56, 189, 248, 0.25)";
        ctx.lineWidth = idx === 0 ? 1.5 : 1;
        ctx.stroke();
      });

      // Crosshairs with dashes
      ctx.strokeStyle = "rgba(255, 255, 255, 0.28)";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.moveTo(centerX, centerY - radius - 8);
      ctx.lineTo(centerX, centerY + radius + 8);
      ctx.moveTo(centerX - radius - 8, centerY);
      ctx.lineTo(centerX + radius + 8, centerY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Sound Orb Coordinates with 16D vertical perspective scaling
      const currentAngle = angleRef.current;
      const isVertical = options.verticalOrbit !== false;
      const elevationSin = isVertical ? Math.sin((currentAngle * speed) / (speed * 1.35)) : 0;
      const perspectiveScale = 1.0 + elevationSin * 0.25;
      const orbX = centerX + radius * Math.sin(currentAngle);
      const orbY = centerY - radius * Math.cos(currentAngle);

      // Trajectory trailing glow particles
      const trailCount = isPlaying ? 10 : 4;
      for (let i = trailCount; i > 0; i--) {
        const trailAngle = currentAngle - dirMultiplier * (i * 0.07);
        const tx = centerX + radius * Math.sin(trailAngle);
        const ty = centerY - radius * Math.cos(trailAngle);
        const alpha = (1 - i / trailCount) * (isPlaying ? 0.6 : 0.15);

        ctx.fillStyle = `rgba(56, 189, 248, ${alpha})`;
        ctx.beginPath();
        ctx.arc(tx, ty, (2.2 + (trailCount - i) * 0.4) * perspectiveScale, 0, 2 * Math.PI);
        ctx.fill();
      }

      // Laser radar beam from center listener to sound source
      const beamGrad = ctx.createLinearGradient(centerX, centerY, orbX, orbY);
      beamGrad.addColorStop(0, "rgba(168, 85, 247, 0.3)");
      beamGrad.addColorStop(1, isPlaying ? "rgba(56, 189, 248, 0.9)" : "rgba(100, 116, 139, 0.4)");
      ctx.strokeStyle = beamGrad;
      ctx.lineWidth = isPlaying ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(orbX, orbY);
      ctx.stroke();

      // Rotating Audio Beacon Outer Glow (pulses with 16D elevation)
      const glowRadius = Math.max(10, 18 * perspectiveScale);
      const orbGlow = ctx.createRadialGradient(orbX, orbY, 2, orbX, orbY, glowRadius);
      orbGlow.addColorStop(0, "#38bdf8");
      orbGlow.addColorStop(0.4, isPlaying ? (isVertical ? "#c084fc" : "#a855f7") : "#0284c7");
      orbGlow.addColorStop(1, "rgba(56, 189, 248, 0)");
      ctx.fillStyle = orbGlow;
      ctx.beginPath();
      ctx.arc(orbX, orbY, glowRadius, 0, 2 * Math.PI);
      ctx.fill();

      // Sound wave ripples emitting from orb (when actively playing)
      if (isPlaying) {
        const pulse = (now * 0.0025) % 1;
        ctx.strokeStyle = `rgba(56, 189, 248, ${1 - pulse})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(orbX, orbY, (6 + pulse * 16) * perspectiveScale, 0, 2 * Math.PI);
        ctx.stroke();
      }

      // Center bright white core of orb
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "#38bdf8";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(orbX, orbY, 4.5 * perspectiveScale, 0, 2 * Math.PI);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Cardinal directional markers with high contrast text shadow
      ctx.font = "bold 9px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.fillStyle = "#f1f5f9";
      ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
      ctx.shadowBlur = 4;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("FRONT", centerX, centerY - radius - 14);
      ctx.fillText("REAR", centerX, centerY + radius + 14);
      ctx.fillText("RIGHT", centerX + radius + 22, centerY);
      ctx.fillText("LEFT", centerX - radius - 20, centerY);
      ctx.shadowBlur = 0;

      // Schedule next frame only when playing (saves battery when paused)
      if (isPlaying) {
        animFrameRef.current = requestAnimationFrame(render);
      }
    };

    render(performance.now());

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isPlaying, options, currentTime]);

  return (
    <div
      ref={containerRef}
      className="relative w-full max-w-[320px] sm:max-w-[360px] md:max-w-[380px] aspect-square mx-auto flex items-center justify-center rounded-3xl overflow-hidden border border-slate-700/60 shadow-2xl bg-slate-950 group select-none"
    >
      {/* ── Layer 1: Ambient Blurred Backlight Glow ── */}
      {coverImage ? (
        <div
          className="absolute -inset-6 bg-cover bg-center rounded-3xl blur-3xl opacity-45 scale-110 pointer-events-none transition-all duration-700"
          style={{ backgroundImage: `url(${coverImage})` }}
        />
      ) : (
        <div className="absolute -inset-6 rounded-3xl blur-3xl opacity-35 bg-gradient-to-tr from-cyan-500 via-purple-600 to-pink-500 pointer-events-none" />
      )}

      {/* ── Layer 2: Album Cover Image (or Cyberpunk Spatial Vinyl Fallback) ── */}
      {coverImage ? (
        <img
          src={coverImage}
          alt={title || "Album Art"}
          className="absolute inset-0 w-full h-full object-cover select-none transition-transform duration-700 group-hover:scale-105"
        />
      ) : (
        <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-slate-900 via-slate-950 to-purple-950/90 flex items-center justify-center">
          <div
            className={`w-52 h-52 sm:w-64 sm:h-64 rounded-full border border-slate-700/40 flex items-center justify-center transition-all ${
              isPlaying ? "animate-spin" : ""
            }`}
            style={{ animationDuration: "20s" }}
          >
            <div className="w-40 h-40 sm:w-48 sm:h-48 rounded-full border border-slate-700/30 flex items-center justify-center">
              <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full border border-slate-700/20 flex items-center justify-center">
                <Disc3 className="w-10 h-10 text-slate-600 opacity-60" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Layer 3: Glass Vignette Overlay ── */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/50 via-slate-950/20 to-slate-950/70 backdrop-blur-[1px] pointer-events-none" />

      {/* ── Layer 4: Transparent 360° / 16D Radar Canvas ── */}
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%" }}
        className="absolute inset-0 block pointer-events-none z-10"
      />

      {/* ── Layer 5: Center Listener Hologram Disc ── */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none z-10">
        <div
          className={`p-2.5 sm:p-3 rounded-full bg-slate-950/70 border border-cyan-400/60 backdrop-blur-md shadow-xl shadow-cyan-500/25 transition-all duration-300 ${
            isPlaying ? "scale-105 ring-2 ring-cyan-400/40" : "scale-100 opacity-80"
          }`}
        >
          <Headphones className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-300 drop-shadow-[0_0_8px_rgba(56,189,248,0.7)]" />
        </div>
        <span className="text-[8px] sm:text-[9px] tracking-widest text-cyan-200/90 font-mono font-bold uppercase mt-1 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
          Listener
        </span>
      </div>

      {/* ── Layer 6: Floating Top HUD Glass Bar ── */}
      <div className="absolute top-3 inset-x-3 z-20 flex items-center justify-between pointer-events-none select-none">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-950/75 border border-slate-700/80 backdrop-blur-md text-cyan-300 shadow-md">
          <Activity className={`w-3 h-3 text-cyan-400 ${isPlaying ? "animate-pulse" : ""}`} />
          <span className="text-[10px] font-mono font-semibold tracking-wider">
            {options.verticalOrbit !== false ? "16D SPHERICAL" : "360° HRTF"}
          </span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-950/75 border border-slate-700/80 backdrop-blur-md font-mono text-[10px] shadow-md">
          <span ref={angleTextRef} className="text-purple-300 font-bold">
            0°
          </span>
          <span className="text-slate-500">|</span>
          <span ref={earPanRef} className="text-emerald-300 font-medium">
            Center
          </span>
        </div>
      </div>

      {/* ── Layer 7: Floating Bottom HUD Glass Pill ── */}
      <div className="absolute bottom-3 inset-x-3 z-20 flex items-center justify-center pointer-events-none select-none">
        <div className="flex items-center gap-1.5 sm:gap-2 px-3 py-1 rounded-full bg-slate-950/80 border border-slate-700/80 backdrop-blur-md text-[10px] font-mono font-medium text-slate-300 shadow-lg">
          <span className="flex items-center gap-1 text-cyan-300">
            <Compass className="w-3 h-3 text-cyan-400" />
            {options.rotationSpeed || 12}s
          </span>
          <span className="text-slate-600">•</span>
          <span className="text-purple-300">
            {options.verticalOrbit !== false ? "16D ↕" : "8D ↔"}
          </span>
          {(options.centerAnchor ?? 0.18) > 0 && (
            <>
              <span className="text-slate-600">•</span>
              <span className="text-amber-300">
                Vocal {Math.round((options.centerAnchor ?? 0.18) * 100)}%
              </span>
            </>
          )}
          <span className="text-slate-600">•</span>
          <span className="text-emerald-300">
            Reverb {Math.round((options.reverbLevel ?? 0.16) * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
}
