"use client";

import React, { useEffect, useRef, useState } from "react";
import { Headphones, Volume2, Compass, Activity } from "lucide-react";
import { AudioProcessingOptions } from "@/types";

interface OrbitVisualizerProps {
  isPlaying: boolean;
  options: AudioProcessingOptions;
  currentTime?: number;
}

export default function OrbitVisualizer({
  isPlaying,
  options,
  currentTime,
}: OrbitVisualizerProps) {
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

    let lastTime = performance.now();
    let frameCount = 0;

    const render = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(centerX, centerY) * 0.70;

      // Update rotation angle
      const speed = Math.max(2, options.rotationSpeed);
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
            earPanRef.current.textContent = "Center Balance";
          }
        }
      }

      ctx.clearRect(0, 0, width, height);

      // Radial background grid glow
      const bgGrad = ctx.createRadialGradient(centerX, centerY, 10, centerX, centerY, radius * 1.2);
      bgGrad.addColorStop(0, "rgba(30, 41, 59, 0.4)");
      bgGrad.addColorStop(1, "rgba(11, 15, 25, 0)");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Outer radar rings
      ctx.strokeStyle = "rgba(56, 189, 248, 0.15)";
      ctx.lineWidth = 1;

      // Concentric rings
      [1.0, 0.72, 0.42].forEach((factor, idx) => {
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius * factor, 0, 2 * Math.PI);
        ctx.strokeStyle = idx === 0 ? "rgba(56, 189, 248, 0.25)" : "rgba(147, 51, 234, 0.18)";
        ctx.stroke();
      });

      // Crosshairs with dashes
      ctx.strokeStyle = "rgba(100, 116, 139, 0.25)";
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(centerX, centerY - radius - 8);
      ctx.lineTo(centerX, centerY + radius + 8);
      ctx.moveTo(centerX - radius - 8, centerY);
      ctx.lineTo(centerX + radius + 8, centerY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Sound Orb Coordinates
      const currentAngle = angleRef.current;
      const orbX = centerX + radius * Math.sin(currentAngle);
      const orbY = centerY - radius * Math.cos(currentAngle);

      // Trajectory trailing glow particles
      const trailCount = isPlaying ? 8 : 3;
      for (let i = trailCount; i > 0; i--) {
        const trailAngle = currentAngle - dirMultiplier * (i * 0.08);
        const tx = centerX + radius * Math.sin(trailAngle);
        const ty = centerY - radius * Math.cos(trailAngle);
        const alpha = (1 - i / trailCount) * (isPlaying ? 0.4 : 0.1);

        ctx.fillStyle = `rgba(56, 189, 248, ${alpha})`;
        ctx.beginPath();
        ctx.arc(tx, ty, 2 + (trailCount - i) * 0.35, 0, 2 * Math.PI);
        ctx.fill();
      }

      // Laser radar beam from center to sound source
      const beamGrad = ctx.createLinearGradient(centerX, centerY, orbX, orbY);
      beamGrad.addColorStop(0, "rgba(168, 85, 247, 0.2)");
      beamGrad.addColorStop(1, isPlaying ? "rgba(56, 189, 248, 0.8)" : "rgba(100, 116, 139, 0.3)");
      ctx.strokeStyle = beamGrad;
      ctx.lineWidth = isPlaying ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(orbX, orbY);
      ctx.stroke();

      // Rotating Audio Beacon Outer Glow
      const orbGlow = ctx.createRadialGradient(orbX, orbY, 2, orbX, orbY, 16);
      orbGlow.addColorStop(0, "#38bdf8");
      orbGlow.addColorStop(0.4, isPlaying ? "#a855f7" : "#0284c7");
      orbGlow.addColorStop(1, "rgba(56, 189, 248, 0)");
      ctx.fillStyle = orbGlow;
      ctx.beginPath();
      ctx.arc(orbX, orbY, 16, 0, 2 * Math.PI);
      ctx.fill();

      // Sound wave ripples emitting from orb (only when actively playing to save mobile battery)
      if (isPlaying) {
        const pulse = (now * 0.0025) % 1;
        ctx.strokeStyle = `rgba(56, 189, 248, ${1 - pulse})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(orbX, orbY, 6 + pulse * 14, 0, 2 * Math.PI);
        ctx.stroke();
      }

      // Center bright core of orb
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(orbX, orbY, 4, 0, 2 * Math.PI);
      ctx.fill();

      // Cardinal directional markers
      ctx.font = "9px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.fillStyle = "#64748b";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("FRONT", centerX, centerY - radius - 12);
      ctx.fillText("REAR", centerX, centerY + radius + 12);
      ctx.fillText("RIGHT", centerX + radius + 20, centerY);
      ctx.fillText("LEFT", centerX - radius - 18, centerY);

      // ONLY schedule next frame when active - saves CPU/GPU battery when paused!
      if (isPlaying) {
        animFrameRef.current = requestAnimationFrame(render);
      }
    };

    // Render immediately (draws frame once if paused, or starts animation loop if playing)
    render(performance.now());

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isPlaying, options, currentTime]);

  return (
    <div className="w-full max-w-sm flex flex-col items-center justify-center p-3 sm:p-3.5 bg-slate-950/80 backdrop-blur-md rounded-2xl border border-slate-800/80 shadow-2xl relative overflow-hidden">
      {/* Top HUD Stats */}
      <div className="w-full flex items-center justify-between text-[11px] font-mono text-slate-400 px-2 pb-1 border-b border-slate-800/60 mb-2">
        <div className="flex items-center gap-1.5 text-cyan-400">
          <Activity className={`w-3.5 h-3.5 ${isPlaying ? "animate-pulse" : ""}`} />
          <span className="text-[10px] sm:text-[11px]">360° HRTF RADAR</span>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-[11px]">
          <span ref={angleTextRef} className="text-purple-400 font-semibold">0°</span>
          <span className="text-slate-600">|</span>
          <span ref={earPanRef} className="text-emerald-400">Center Balance</span>
        </div>
      </div>

      {/* Radar Canvas with Center Head (Compact on mobile) */}
      <div className="relative w-44 h-44 sm:w-56 sm:h-56 flex items-center justify-center my-1">
        <canvas
          ref={canvasRef}
          width={224}
          height={224}
          className="absolute inset-0 block w-full h-full rounded-full"
        />

        {/* Center Listener Head */}
        <div className="z-10 flex flex-col items-center justify-center pointer-events-none">
          <div className="p-2 sm:p-3 bg-gradient-to-tr from-cyan-500/20 to-purple-500/20 rounded-full border border-cyan-400/50 backdrop-blur-md shadow-lg shadow-cyan-500/30">
            <Headphones className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-300" />
          </div>
          <span className="text-[8px] sm:text-[9px] tracking-wider text-slate-400 mt-0.5 sm:mt-1 uppercase font-bold font-mono">
            Listener
          </span>
        </div>
      </div>

      {/* Bottom Status pill */}
      <div className="mt-2 flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 bg-slate-900/90 rounded-full border border-slate-800 text-[10px] sm:text-[11px] font-medium text-slate-300">
        <span className="flex items-center gap-1 text-cyan-400">
          <Compass className="w-3 h-3" />
          {options.rotationSpeed}s / loop
        </span>
        <span className="text-slate-600">•</span>
        <span className="capitalize text-purple-300">{options.direction}</span>
        <span className="text-slate-600">•</span>
        <span className="text-emerald-300">Reverb {Math.round(options.reverbLevel * 100)}%</span>
      </div>
    </div>
  );
}
