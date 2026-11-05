"use client";

import React, { useEffect, useRef } from "react";
import { Headphones, Volume2 } from "lucide-react";
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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let lastTime = performance.now();

    const render = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(centerX, centerY) * 0.72;

      // Update rotation angle
      const speed = Math.max(2, options.rotationSpeed);
      const angularVelocity = (2 * Math.PI) / speed;
      const dirMultiplier = options.direction === "counter-clockwise" ? -1 : 1;

      if (currentTime !== undefined && isPlaying) {
        // Sync directly to current track time if provided
        angleRef.current = dirMultiplier * ((2 * Math.PI * currentTime) / speed);
      } else if (isPlaying) {
        // Continuous smooth animation
        angleRef.current += dirMultiplier * angularVelocity * dt;
      }

      ctx.clearRect(0, 0, width, height);

      // 1. Draw outer radar rings
      ctx.strokeStyle = "rgba(59, 130, 246, 0.15)";
      ctx.lineWidth = 1;

      // Outer ring
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
      ctx.stroke();

      // Middle ring
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * 0.65, 0, 2 * Math.PI);
      ctx.stroke();

      // Inner ring
      ctx.strokeStyle = "rgba(147, 51, 234, 0.15)";
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * 0.35, 0, 2 * Math.PI);
      ctx.stroke();

      // Crosshairs
      ctx.strokeStyle = "rgba(156, 163, 175, 0.2)";
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(centerX, centerY - radius - 8);
      ctx.lineTo(centerX, centerY + radius + 8);
      ctx.moveTo(centerX - radius - 8, centerY);
      ctx.lineTo(centerX + radius + 8, centerY);
      ctx.stroke();
      ctx.setLineDash([]);

      // 2. Sound Orb Orbit Coordinates
      const currentAngle = angleRef.current;
      const orbX = centerX + radius * Math.sin(currentAngle);
      const orbY = centerY - radius * Math.cos(currentAngle);

      // Trajectory trailing glow
      const trailLength = 8;
      for (let i = trailLength; i > 0; i--) {
        const trailAngle = currentAngle - dirMultiplier * (i * 0.08);
        const tx = centerX + radius * Math.sin(trailAngle);
        const ty = centerY - radius * Math.cos(trailAngle);
        const alpha = (1 - i / trailLength) * (isPlaying ? 0.35 : 0.15);

        ctx.fillStyle = `rgba(59, 130, 246, ${alpha})`;
        ctx.beginPath();
        ctx.arc(tx, ty, 3 + (trailLength - i) * 0.5, 0, 2 * Math.PI);
        ctx.fill();
      }

      // Connecting line from center to orb
      const gradLine = ctx.createLinearGradient(centerX, centerY, orbX, orbY);
      gradLine.addColorStop(0, "rgba(147, 51, 234, 0.1)");
      gradLine.addColorStop(1, isPlaying ? "rgba(59, 130, 246, 0.6)" : "rgba(156, 163, 175, 0.3)");
      ctx.strokeStyle = gradLine;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(orbX, orbY);
      ctx.stroke();

      // Rotating Audio Source Glowing Orb
      const orbGlow = ctx.createRadialGradient(orbX, orbY, 2, orbX, orbY, 14);
      orbGlow.addColorStop(0, "rgba(96, 165, 250, 1)");
      orbGlow.addColorStop(0.5, isPlaying ? "rgba(147, 51, 234, 0.8)" : "rgba(59, 130, 246, 0.5)");
      orbGlow.addColorStop(1, "rgba(59, 130, 246, 0)");
      ctx.fillStyle = orbGlow;
      ctx.beginPath();
      ctx.arc(orbX, orbY, 14, 0, 2 * Math.PI);
      ctx.fill();

      // Sound waves emitting from orb when playing
      if (isPlaying) {
        const pulse = (now * 0.003) % 1;
        ctx.strokeStyle = `rgba(59, 130, 246, ${1 - pulse})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(orbX, orbY, 6 + pulse * 12, 0, 2 * Math.PI);
        ctx.stroke();
      }

      // Center orb point
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(orbX, orbY, 4, 0, 2 * Math.PI);
      ctx.fill();

      // Cardinal Labels (Front, Right, Back, Left)
      ctx.font = "10px sans-serif";
      ctx.fillStyle = "#9ca3af";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("FRONT", centerX, centerY - radius - 14);
      ctx.fillText("BACK", centerX, centerY + radius + 14);
      ctx.fillText("RIGHT", centerX + radius + 22, centerY);
      ctx.fillText("LEFT", centerX - radius - 20, centerY);

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isPlaying, options, currentTime]);

  return (
    <div className="flex flex-col items-center justify-center p-4 bg-slate-900 rounded-xl text-white shadow-inner">
      <div className="relative w-64 h-64 flex items-center justify-center">
        <canvas
          ref={canvasRef}
          width={256}
          height={256}
          className="absolute inset-0 block"
        />

        {/* Center Listener Icon */}
        <div className="z-10 flex flex-col items-center justify-center pointer-events-none">
          <div className="p-2.5 bg-blue-600/30 rounded-full border border-blue-400/40 backdrop-blur-sm shadow-lg shadow-blue-500/20">
            <Headphones className="w-6 h-6 text-blue-300" />
          </div>
          <span className="text-[10px] tracking-widest text-slate-400 mt-1 uppercase font-semibold">
            Listener
          </span>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-4 text-xs text-slate-400">
        <span className="flex items-center gap-1">
          <Volume2 className="w-3.5 h-3.5 text-blue-400" />
          {options.rotationSpeed}s / Orbit
        </span>
        <span className="text-slate-600">•</span>
        <span className="capitalize">{options.direction}</span>
        <span className="text-slate-600">•</span>
        <span>Reverb: {Math.round(options.reverbLevel * 100)}%</span>
      </div>
    </div>
  );
}
