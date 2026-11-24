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
  analyserRef?:
    | React.RefObject<AnalyserNode | null>
    | React.MutableRefObject<AnalyserNode | null>
    | { current: AnalyserNode | null };
}

export default function OrbitVisualizer({
  isPlaying,
  options,
  currentTime,
  coverImage,
  title,
  artist,
  is8DReady: _is8DReady = false,
  analyserRef,
}: OrbitVisualizerProps) {
  const coverImgRef = useRef<HTMLImageElement | HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const angleRef = useRef<number>(0);
  const angleTextRef = useRef<HTMLSpanElement | null>(null);
  const earPanRef = useRef<HTMLSpanElement | null>(null);
  const listenerPointerRef = useRef<HTMLDivElement | null>(null);
  const listenerDiscRef = useRef<HTMLDivElement | null>(null);

  // Beat detector refs
  const bassBaselineRef = useRef<number>(0.2);
  const currentScaleRef = useRef<number>(1.0);

  // Idle breathing refs (animation runs even when paused)
  const idlePhaseRef = useRef<number>(0);
  const ringPulseRef = useRef<number>(0);

  // Physics lerp refs for silky fluid wave animation in the sweep wake
  const wakeAmpsRef = useRef<number[]>(new Array(60).fill(0.1));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(
      typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
      2
    );
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
      const radius = (size / 2) * 0.68;

      // ── Frequency Band Extraction ──
      let freqDataArray: Uint8Array | null = null;
      let timeDataArray: Uint8Array | null = null;
      let kickEnergy = 0;
      let midEnergy = 0;
      let highEnergy = 0;
      let instantEnergy = 0;
      let hasAudioData = false;

      // ── Idle animation phase (always advances) ──
      idlePhaseRef.current += dt * (isPlaying ? 2.2 : 0.6);
      ringPulseRef.current += dt * (isPlaying ? 3.5 : 0.9);

      if (analyserRef?.current && isPlaying) {
        try {
          const analyser = analyserRef.current as any;
          const bufferLength = analyser.frequencyBinCount || 256;
          const freqData = new Uint8Array(bufferLength);
          const timeData = new Uint8Array(bufferLength);
          analyser.getByteFrequencyData(freqData);
          analyser.getByteTimeDomainData(timeData);
          freqDataArray = freqData;
          timeDataArray = timeData;
          hasAudioData = true;

          // Sub-bass / kick (bins 0-3: ~0–340 Hz)
          const b0 = (freqData[0] || 0) / 255;
          const b1 = (freqData[1] || 0) / 255;
          const b2 = (freqData[2] || 0) / 255;
          const b3 = (freqData[3] || 0) / 255;
          kickEnergy = b0 * 0.35 + b1 * 0.45 + b2 * 0.15 + b3 * 0.05;

          // Mid range (bins 20-60: ~1.7–5.2 kHz) — vocals/snare
          let midSum = 0;
          for (let i = 20; i < Math.min(60, bufferLength); i++) midSum += freqData[i];
          midEnergy = midSum / (40 * 255);

          // High range (bins 60-120: ~5.2–10 kHz) — cymbals/air
          let highSum = 0;
          for (let i = 60; i < Math.min(120, bufferLength); i++) highSum += freqData[i];
          highEnergy = highSum / (60 * 255);

          // Combined energy for general reactivity
          instantEnergy = kickEnergy * 0.6 + midEnergy * 0.3 + highEnergy * 0.1;

          // Rolling adaptive baseline
          bassBaselineRef.current +=
            (kickEnergy - bassBaselineRef.current) * 0.05;
          const baseline = Math.max(0.06, bassBaselineRef.current);

          // Transient: sharp kick spike above baseline
          const delta = Math.max(0, kickEnergy - baseline * 1.12);
          const normalizedHit = Math.min(
            1,
            delta / Math.max(0.12, 1 - baseline)
          );
          const targetScale = 1.0 + Math.pow(normalizedHit, 1.4) * 0.085;

          if (targetScale > currentScaleRef.current) {
            currentScaleRef.current = targetScale;
          } else {
            currentScaleRef.current += (1.0 - currentScaleRef.current) * 0.18;
          }
        } catch {
          currentScaleRef.current += (1.0 - currentScaleRef.current) * 0.18;
        }
      } else if (isPlaying) {
        currentScaleRef.current += (1.0 - currentScaleRef.current) * 0.18;
      } else {
        currentScaleRef.current = 1.0 + Math.sin(idlePhaseRef.current) * 0.012;
      }

      // ── Part 1: Cover Image Audio-Reactive CSS Filter ──
      // Brightness ← kick, Saturation ← mids, Contrast ← overall (no hue shift)
      if (coverImgRef.current) {
        const el = coverImgRef.current as HTMLElement;
        if (isPlaying && hasAudioData) {
          const brightness = (1 + kickEnergy * 0.45).toFixed(3);
          const saturation = (1 + midEnergy * 0.9).toFixed(3);
          const contrast   = (1 + instantEnergy * 0.18).toFixed(3);
          el.style.filter = `brightness(${brightness}) saturate(${saturation}) contrast(${contrast})`;
        } else if (isPlaying) {
          // No analyser — just scale & gentle brightness
          const brightness = (1 + (currentScaleRef.current - 1) * 2).toFixed(3);
          el.style.filter = `brightness(${brightness})`;
        } else {
          // Paused: slow breathe on saturation only
          const idleSat = (1 + Math.sin(idlePhaseRef.current * 0.5) * 0.12).toFixed(3);
          el.style.filter = `saturate(${idleSat})`;
        }
        // Beat scale pump
        const s = currentScaleRef.current.toFixed(4);
        el.style.transform = `scale(${s})`;
      }

      // ── Listener disc pulse ──
      if (listenerDiscRef.current) {
        const discScale = 1.0 + (currentScaleRef.current - 1.0) * 1.2;
        listenerDiscRef.current.style.transform = `scale(${discScale.toFixed(4)})`;
      }

      // ── Rotation Angle ──
      const speed = Math.max(2, options.rotationSpeed || 12);
      const angularVelocity = (2 * Math.PI) / speed;
      const dirMultiplier = options.direction === "counter-clockwise" ? -1 : 1;

      if (currentTime !== undefined && isPlaying) {
        angleRef.current = dirMultiplier * ((2 * Math.PI * currentTime) / speed);
      } else if (isPlaying) {
        angleRef.current += dirMultiplier * angularVelocity * dt;
      }

      const rawDeg = ((angleRef.current * 180) / Math.PI) % 360;
      const positiveDeg = Math.round(rawDeg < 0 ? rawDeg + 360 : rawDeg);

      if (listenerPointerRef.current) {
        listenerPointerRef.current.style.transform = `rotate(${positiveDeg}deg)`;
      }

      frameCount++;
      if (frameCount % 6 === 0) {
        if (angleTextRef.current)
          angleTextRef.current.textContent = `${positiveDeg}°`;
        if (earPanRef.current) {
          const sinVal = Math.sin(angleRef.current);
          if (sinVal > 0.3)
            earPanRef.current.textContent = `Right (${Math.round(sinVal * 100)}%)`;
          else if (sinVal < -0.3)
            earPanRef.current.textContent = `Left (${Math.round(Math.abs(sinVal) * 100)}%)`;
          else earPanRef.current.textContent = "Center";
        }
      }

      // ── Clear ──
      ctx.clearRect(0, 0, size, size);

      // Vignette
      const centerShade = ctx.createRadialGradient(
        centerX, centerY, radius * 0.2,
        centerX, centerY, radius * 1.15
      );
      centerShade.addColorStop(0, "rgba(7,11,20,0.45)");
      centerShade.addColorStop(0.7, "rgba(7,11,20,0.20)");
      centerShade.addColorStop(1, "rgba(7,11,20,0.65)");
      ctx.fillStyle = centerShade;
      ctx.fillRect(0, 0, size, size);

      // ── Concentric Radar Rings with per-ring breathing ──
      const idlePulse = 0.5 + 0.5 * Math.sin(ringPulseRef.current);
      const ringBaseAlpha = isPlaying ? 0.5 : 0.22 + idlePulse * 0.14;
      const ringBeatBoost = isPlaying ? kickEnergy * 0.3 : 0;

      [1.0, 0.72, 0.44].forEach((factor, idx) => {
        const phaseOffset = idx * 1.1;
        const breathe = 0.5 + 0.5 * Math.sin(ringPulseRef.current - phaseOffset);
        const alpha =
          idx === 0
            ? ringBaseAlpha + ringBeatBoost * 0.4 + (isPlaying ? 0 : breathe * 0.1)
            : idx === 1
            ? (ringBaseAlpha - 0.05) * (0.85 + breathe * 0.15) + ringBeatBoost * 0.25
            : (ringBaseAlpha - 0.1) * (0.6 + breathe * 0.3);

        ctx.beginPath();
        ctx.arc(centerX, centerY, radius * factor, 0, 2 * Math.PI);
        ctx.strokeStyle =
          idx === 0 ? `rgba(56,189,248,${alpha})`
          : idx === 1 ? `rgba(168,85,247,${alpha})`
          : `rgba(56,189,248,${alpha})`;
        ctx.lineWidth = idx === 0 ? 1.5 : 1;
        ctx.stroke();
      });

      // Crosshairs
      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.moveTo(centerX, centerY - radius - 8);
      ctx.lineTo(centerX, centerY + radius + 8);
      ctx.moveTo(centerX - radius - 8, centerY);
      ctx.lineTo(centerX + radius + 8, centerY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Orb position
      const currentAngle = angleRef.current;
      const isVertical = options.verticalOrbit !== false;
      const elevationSin = isVertical
        ? Math.sin((currentAngle * speed) / (speed * 1.35))
        : 0;
      const perspectiveScale = 1.0 + elevationSin * 0.25;

      const pattern = options.orbitPattern || "circle";
      let orbX = centerX;
      let orbY = centerY;

      if (pattern === "figure8") {
        orbX = centerX + radius * Math.sin(currentAngle);
        orbY = centerY - radius * Math.sin(2 * currentAngle) * 0.72;
      } else if (pattern === "spiral") {
        const breathe = 0.5 + 0.5 * Math.sin((currentAngle * speed) / (speed * 2.4));
        const dynR = radius * (0.45 + 0.85 * breathe);
        orbX = centerX + dynR * Math.sin(currentAngle);
        orbY = centerY - dynR * Math.cos(currentAngle);
      } else if (pattern === "pendulum") {
        const sweepAngle = (Math.PI * 0.46) * Math.sin(currentAngle);
        orbX = centerX + radius * Math.sin(sweepAngle);
        orbY = centerY - radius * Math.cos(sweepAngle);
      } else {
        orbX = centerX + radius * Math.sin(currentAngle);
        orbY = centerY - radius * Math.cos(currentAngle);
      }

      // ── Part 2: 360° Flowing Audio Wave Vortex (Spiral wave graph trailing 360° around the deck) ──
      const wavePointCount = 60; // 60 points for high-definition smooth wave across 360°
      const wakeArc = (358 * Math.PI) / 180; // Full 360° spiral trailing sweep vortex
      const wakeStartOffset = 0.04; // starts immediately behind the sound orb
      const wakeInner = 36; // clean base around listener disc
      const wakeAvailableLength = radius - wakeInner - 2;

      // Update smoothed amplitudes with physics lerp
      const smoothedAmps = wakeAmpsRef.current;
      if (smoothedAmps.length !== wavePointCount) {
        wakeAmpsRef.current = new Array(wavePointCount).fill(0.1);
      }

      // Collect wave crest points and base points
      const crestPoints: { x: number; y: number; f: number; amp: number }[] = [];
      const basePoints: { x: number; y: number }[] = [];
      const secondaryPoints: { x: number; y: number }[] = [];

      for (let i = 0; i < wavePointCount; i++) {
        const f = i / (wavePointCount - 1); // 0 (at sound orb) → 1.0 (spiral tail wrapping full 360°)

        let targetAmp = 0;
        if (hasAudioData && freqDataArray) {
          const binIdx = Math.floor(f * Math.min(100, freqDataArray.length / 2));
          targetAmp = (freqDataArray[binIdx] || 0) / 255;
        } else if (isPlaying) {
          targetAmp = 0.22 + 0.18 * Math.sin(now * 0.005 + i * 0.25);
        } else {
          targetAmp = 0.07 + 0.06 * Math.sin(idlePhaseRef.current * 0.7 - i * 0.18);
        }

        // Liquid traveling harmonic wave cascade across the 360° vortex
        const waveCascade = Math.sin(now * 0.007 - f * 12.0);
        const dynamicAmp = targetAmp * 0.7 + (waveCascade * 0.5 + 0.5) * targetAmp * 0.5;

        // Smooth physics lerp
        const currentA = smoothedAmps[i] ?? 0.1;
        const lerpFactor = dynamicAmp > currentA ? 0.35 : 0.14;
        smoothedAmps[i] = currentA + (dynamicAmp - currentA) * lerpFactor;
        const amp = smoothedAmps[i];

        // Smooth spiral taper from outer orb orbit (f=0) down to inner base (f=1)
        const trailFade = Math.pow(Math.cos(f * (Math.PI * 0.5)), 1.05);
        const waveHeight = Math.max(3.0, amp * wakeAvailableLength * (0.25 + 0.75 * trailFade));

        const barAngle = currentAngle - dirMultiplier * (wakeStartOffset + f * wakeArc);

        // Aerodynamic trailing drag curve
        const dragDeflection = dirMultiplier * 0.035 * (1 - f) * (amp + 0.2);
        const tipAngle = barAngle - dragDeflection;

        const xS = centerX + Math.sin(barAngle) * wakeInner;
        const yS = centerY - Math.cos(barAngle) * wakeInner;
        const xE = centerX + Math.sin(tipAngle) * (wakeInner + waveHeight);
        const yE = centerY - Math.cos(tipAngle) * (wakeInner + waveHeight);

        // Secondary harmonic echo wave (for layered depth)
        const secHeight = waveHeight * (0.55 + 0.15 * Math.sin(now * 0.009 - f * 14.0));
        const xSec = centerX + Math.sin(tipAngle) * (wakeInner + secHeight);
        const ySec = centerY - Math.cos(tipAngle) * (wakeInner + secHeight);

        crestPoints.push({ x: xE, y: yE, f, amp });
        basePoints.push({ x: xS, y: yS });
        secondaryPoints.push({ x: xSec, y: ySec });
      }

      if (crestPoints.length > 2) {
        // ── 1. Translucent Fluid Wave Area Fill (Under the graph) ──
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(crestPoints[0].x, crestPoints[0].y);
        for (let i = 1; i < crestPoints.length; i++) {
          const prev = crestPoints[i - 1];
          const curr = crestPoints[i];
          const mx = (prev.x + curr.x) / 2;
          const my = (prev.y + curr.y) / 2;
          ctx.quadraticCurveTo(prev.x, prev.y, mx, my);
        }
        ctx.lineTo(crestPoints[crestPoints.length - 1].x, crestPoints[crestPoints.length - 1].y);

        // Connect along the base curve back to the start
        for (let i = basePoints.length - 1; i >= 0; i--) {
          ctx.lineTo(basePoints[i].x, basePoints[i].y);
        }
        ctx.closePath();

        const waveFill = ctx.createRadialGradient(centerX, centerY, wakeInner, centerX, centerY, radius);
        waveFill.addColorStop(0, "rgba(34, 211, 238, 0.16)");
        waveFill.addColorStop(0.45, "rgba(56, 189, 248, 0.09)");
        waveFill.addColorStop(0.8, "rgba(168, 85, 247, 0.04)");
        waveFill.addColorStop(1, "rgba(168, 85, 247, 0.0)");
        ctx.fillStyle = waveFill;
        ctx.fill();
        ctx.restore();

        // ── 2. Segment-by-Segment Luminous Wave Crest (Seamless Color along 360° Vortex) ──
        for (let i = 1; i < crestPoints.length; i++) {
          const prev = crestPoints[i - 1];
          const curr = crestPoints[i];
          const f = i / (crestPoints.length - 1);
          const trailFade = Math.pow(Math.cos(f * (Math.PI * 0.5)), 1.05);

          // Color transition: Electric Cyan (f=0) → Neon Sky Blue (f=0.45) → Ultraviolet Purple (f=1.0)
          let cr = 34, cg = 211, cb = 238;
          if (f < 0.45) {
            const t = f / 0.45;
            cr = Math.round(34 + (56 - 34) * t);
            cg = Math.round(211 + (189 - 211) * t);
            cb = Math.round(238 + (248 - 238) * t);
          } else {
            const t = (f - 0.45) / 0.55;
            cr = Math.round(56 + (168 - 56) * t);
            cg = Math.round(189 + (85 - 189) * t);
            cb = Math.round(248 + (247 - 248) * t);
          }

          const alpha = isPlaying
            ? Math.min(0.95, (0.35 + curr.amp * 0.65) * trailFade)
            : Math.min(0.45, (0.15 + idlePulse * 0.15) * trailFade);

          // Pass A: Soft glow halo
          ctx.beginPath();
          ctx.moveTo(prev.x, prev.y);
          ctx.lineTo(curr.x, curr.y);
          ctx.strokeStyle = `rgba(${cr}, ${cg}, ${cb}, ${(alpha * 0.4).toFixed(3)})`;
          ctx.lineWidth = isPlaying ? 5 : 3;
          ctx.lineCap = "round";
          ctx.stroke();

          // Pass B: Sharp bright core wave line
          ctx.beginPath();
          ctx.moveTo(prev.x, prev.y);
          ctx.lineTo(curr.x, curr.y);
          ctx.strokeStyle = `rgba(${cr}, ${cg}, ${cb}, ${alpha.toFixed(3)})`;
          ctx.lineWidth = isPlaying ? 2.2 : 1.5;
          ctx.lineCap = "round";
          ctx.stroke();

          // Secondary dashed harmonic line
          const secPrev = secondaryPoints[i - 1];
          const secCurr = secondaryPoints[i];
          ctx.beginPath();
          ctx.moveTo(secPrev.x, secPrev.y);
          ctx.lineTo(secCurr.x, secCurr.y);
          ctx.strokeStyle = `rgba(${cr}, ${cg}, ${cb}, ${(alpha * 0.35).toFixed(3)})`;
          ctx.lineWidth = 1.1;
          ctx.setLineDash([3, 4]);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // ── 3. Floating Sparkling Nodes on Major Peaks across the Vortex ──
        for (let i = 2; i < crestPoints.length - 2; i += 3) {
          const pt = crestPoints[i];
          if (isPlaying && pt.amp > 0.35 && pt.f < 0.85) {
            const alpha = Math.min(1, pt.amp + 0.35);
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 1.6, 0, 2 * Math.PI);
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha.toFixed(3)})`;
            ctx.shadowColor = "#38bdf8";
            ctx.shadowBlur = 6;
            ctx.fill();
            ctx.shadowBlur = 0;
          }
        }
      }

      // ── Trail particles ──
      const trailCount = isPlaying ? 10 : 3;
      for (let i = trailCount; i > 0; i--) {
        const trailAngle = currentAngle - dirMultiplier * (i * 0.07);
        const tx = centerX + radius * Math.sin(trailAngle);
        const ty = centerY - radius * Math.cos(trailAngle);
        const alpha = (1 - i / trailCount) * (isPlaying ? 0.6 : 0.08);
        ctx.fillStyle = `rgba(56,189,248,${alpha})`;
        ctx.beginPath();
        ctx.arc(tx, ty, (2.2 + (trailCount - i) * 0.4) * perspectiveScale, 0, 2 * Math.PI);
        ctx.fill();
      }

      // ── Laser Beam — double-stroke glow ──
      const beamSegments = 28;
      const dx = (orbX - centerX) / beamSegments;
      const dy = (orbY - centerY) / beamSegments;
      const segLen = Math.hypot(dx, dy);
      const perpX = segLen > 0 ? -dy / segLen : 0;
      const perpY = segLen > 0 ? dx / segLen : 0;

      const buildBeamPath = () => {
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        for (let seg = 1; seg <= beamSegments; seg++) {
          const segRatio = seg / beamSegments;
          let waveOffset = 0;
          if (hasAudioData && timeDataArray && isPlaying) {
            const waveIdx = Math.floor(segRatio * Math.min(128, timeDataArray.length / 2));
            const sample = ((timeDataArray[waveIdx] || 128) - 128) / 128;
            waveOffset = sample * 18 * Math.sin(Math.PI * segRatio);
          } else if (isPlaying) {
            waveOffset = Math.sin(seg * 0.9 - now * 0.009) * 4 * Math.sin(Math.PI * segRatio);
          } else {
            waveOffset = Math.sin(seg * 0.6 - idlePhaseRef.current * 0.5) * 1.5 * Math.sin(Math.PI * segRatio);
          }
          ctx.lineTo(
            centerX + dx * seg + perpX * waveOffset,
            centerY + dy * seg + perpY * waveOffset
          );
        }
      };

      // Pass 1 — wide glow halo
      buildBeamPath();
      const glowGrad = ctx.createLinearGradient(centerX, centerY, orbX, orbY);
      glowGrad.addColorStop(0, "rgba(168,85,247,0.0)");
      glowGrad.addColorStop(0.4, "rgba(168,85,247,0.25)");
      glowGrad.addColorStop(1, isPlaying ? "rgba(56,189,248,0.35)" : "rgba(100,116,139,0.15)");
      ctx.strokeStyle = glowGrad;
      ctx.lineWidth = isPlaying ? 7 : 4;
      ctx.lineCap = "round";
      ctx.stroke();

      // Pass 2 — sharp bright core
      buildBeamPath();
      const coreGrad = ctx.createLinearGradient(centerX, centerY, orbX, orbY);
      coreGrad.addColorStop(0, "rgba(168,85,247,0.55)");
      coreGrad.addColorStop(1, isPlaying ? "rgba(56,189,248,1.0)" : "rgba(100,116,139,0.45)");
      ctx.strokeStyle = coreGrad;
      ctx.lineWidth = isPlaying ? 1.8 : 1;
      ctx.stroke();

      // ── Orb glow ──
      const dynamicPulse = 1.0 + kickEnergy * 0.35;
      const glowRadius = Math.max(10, 18 * perspectiveScale * dynamicPulse);
      const orbGlow = ctx.createRadialGradient(orbX, orbY, 2, orbX, orbY, glowRadius);
      orbGlow.addColorStop(0, "#38bdf8");
      orbGlow.addColorStop(0.4, isPlaying ? (isVertical ? "#c084fc" : "#a855f7") : "#0284c7");
      orbGlow.addColorStop(1, "rgba(56,189,248,0)");
      ctx.fillStyle = orbGlow;
      ctx.beginPath();
      ctx.arc(orbX, orbY, glowRadius, 0, 2 * Math.PI);
      ctx.fill();

      // Orb ripple
      const ripplePulse = isPlaying
        ? (now * 0.0025) % 1
        : (Math.sin(idlePhaseRef.current * 0.4) * 0.5 + 0.5) * 0.6;
      const rippleAlpha = isPlaying
        ? (1 - ripplePulse) * (0.65 + kickEnergy * 0.3)
        : (1 - ripplePulse) * 0.2;
      ctx.strokeStyle = `rgba(56,189,248,${rippleAlpha})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(orbX, orbY, (6 + ripplePulse * 18) * perspectiveScale * dynamicPulse, 0, 2 * Math.PI);
      ctx.stroke();

      // Orb white core
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "#38bdf8";
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(orbX, orbY, 4.5 * perspectiveScale * dynamicPulse, 0, 2 * Math.PI);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Cardinal labels (pushed far out so orb never overlaps)
      ctx.font = "bold 9px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.fillStyle = "#e2e8f0";
      ctx.shadowColor = "rgba(0,0,0,0.95)";
      ctx.shadowBlur = 5;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("FRONT", centerX, centerY - radius - 18);
      ctx.fillText("REAR",  centerX, centerY + radius + 18);
      ctx.fillText("RIGHT", centerX + radius + 26, centerY);
      ctx.fillText("LEFT",  centerX - radius - 24, centerY);
      ctx.shadowBlur = 0;

      // Always animate (idle breathing when paused)
      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, options, currentTime, analyserRef]);

  return (
    <div className="relative w-full max-w-[300px] sm:max-w-[360px] md:max-w-[380px] aspect-square mx-auto flex items-center justify-center rounded-2xl sm:rounded-3xl overflow-hidden border border-slate-700/60 shadow-2xl bg-slate-950 group select-none transition-all duration-150">

      {/* Layer 1 — Ambient backlight glow */}
      {coverImage ? (
        <div
          className="absolute -inset-6 bg-cover bg-center rounded-3xl blur-3xl opacity-45 scale-110 pointer-events-none"
          style={{ backgroundImage: `url(${coverImage})` }}
        />
      ) : (
        <div className="absolute -inset-6 rounded-3xl blur-3xl opacity-35 bg-gradient-to-tr from-cyan-500 via-purple-600 to-pink-500 pointer-events-none" />
      )}

      {/* Layer 2 — Album art (audio-reactive CSS filter + beat scale) */}
      {coverImage ? (
        <img
          ref={coverImgRef as React.RefObject<HTMLImageElement>}
          src={coverImage}
          alt={title || (artist ? `${artist} - Album Art` : "Album Art")}
          className="absolute inset-0 w-full h-full object-cover select-none"
          style={{ transition: "filter 80ms ease-out, transform 75ms ease-out" }}
        />
      ) : (
        <div
          ref={coverImgRef as React.RefObject<HTMLDivElement>}
          className="absolute inset-0 w-full h-full bg-gradient-to-br from-slate-900 via-slate-950 to-purple-950/90 flex items-center justify-center"
          style={{ transition: "filter 80ms ease-out, transform 75ms ease-out" }}
        >
          <div
            className={`w-52 h-52 sm:w-64 sm:h-64 rounded-full border border-slate-700/40 flex items-center justify-center ${isPlaying ? "animate-spin" : ""}`}
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

      {/* Layer 3 — Glass vignette */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/50 via-slate-950/20 to-slate-950/70 backdrop-blur-[1px] pointer-events-none" />

      {/* Layer 4 — Radar canvas */}
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%" }}
        className="absolute inset-0 block pointer-events-none z-10"
      />

      {/* Layer 5 — Listener disc + teardrop needle (precisely centered at 50% 50%) */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 flex items-center justify-center pointer-events-none select-none z-10">
        <div
          ref={listenerDiscRef}
          className={`relative w-14 h-14 rounded-full bg-slate-950/85 border border-cyan-400/60 backdrop-blur-md shadow-xl shadow-cyan-500/25 transition-transform duration-75 flex items-center justify-center ${
            isPlaying
              ? "ring-2 ring-cyan-400/50 shadow-[0_0_18px_rgba(34,211,238,0.35)]"
              : "opacity-80 ring-1 ring-cyan-400/20"
          }`}
        >
          {/* Teardrop needle rotates toward orb */}
          <div
            ref={listenerPointerRef}
            className="absolute -inset-2.5 rounded-full pointer-events-none"
            style={{ transformOrigin: "center center" }}
          >
            <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full" style={{ overflow: "visible" }}>
              <polygon points="50,4 54,16 46,16" fill="#22d3ee" filter="url(#needleGlow)" />
              <defs>
                <filter id="needleGlow" x="-80%" y="-80%" width="260%" height="260%">
                  <feGaussianBlur stdDeviation="2.5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
            </svg>
          </div>
          <Headphones className="w-7 h-7 text-cyan-300 drop-shadow-[0_0_10px_rgba(56,189,248,0.8)]" />

          {/* Listener Label anchored below the disc without shifting the disc's center */}
          <span className="absolute top-[calc(100%+3px)] left-1/2 -translate-x-1/2 whitespace-nowrap text-[8px] sm:text-[9px] tracking-widest text-cyan-200/90 font-mono font-bold uppercase drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] pointer-events-none">
            Listener
          </span>
        </div>
      </div>

      {/* Layer 6 — Top HUD */}
      <div className="absolute top-3 inset-x-3 z-20 flex items-center justify-between pointer-events-none select-none">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-950/75 border border-slate-700/80 backdrop-blur-md text-cyan-300 shadow-md">
          <Activity className={`w-3 h-3 text-cyan-400 ${isPlaying ? "animate-pulse" : ""}`} />
          <span className="text-[10px] font-mono font-semibold tracking-wider uppercase">
            {options.orbitPattern === "figure8"
              ? "16D FIGURE-8 ∞"
              : options.orbitPattern === "spiral"
              ? "16D SPIRAL 🌀"
              : options.orbitPattern === "pendulum"
              ? "16D PENDULUM ↔"
              : options.verticalOrbit !== false
              ? "16D SPHERICAL"
              : "360° HRTF"}
          </span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-950/75 border border-slate-700/80 backdrop-blur-md font-mono text-[10px] shadow-md">
          <span ref={angleTextRef} className="text-purple-300 font-bold">0°</span>
          <span className="text-slate-500">|</span>
          <span ref={earPanRef} className="text-emerald-300 font-medium">Center</span>
        </div>
      </div>

      {/* Layer 7 — Bottom HUD */}
      <div className="absolute bottom-3 inset-x-3 z-20 flex items-center justify-center pointer-events-none select-none">
        <div className="flex items-center gap-1.5 sm:gap-2 px-3 py-1 rounded-full bg-slate-950/80 border border-slate-700/80 backdrop-blur-md text-[10px] font-mono font-medium text-slate-300 shadow-lg">
          <span className="flex items-center gap-1 text-cyan-300">
            <Compass className="w-3 h-3 text-cyan-400 shrink-0" />
            <span>{options.rotationSpeed || 12}s</span>
          </span>
          <span className="text-slate-600">•</span>
          <span className="text-purple-300">
            {options.verticalOrbit !== false ? "16D" : "8D"}
            <span className="hidden sm:inline">
              {options.verticalOrbit !== false ? " ↕" : " ↔"}
            </span>
          </span>
          {(options.centerAnchor ?? 0.18) > 0 && (
            <>
              <span className="text-slate-600 hidden sm:inline">•</span>
              <span className="text-amber-300 hidden sm:inline">
                Vocal {Math.round((options.centerAnchor ?? 0.18) * 100)}%
              </span>
              <span
                className="w-1.5 h-1.5 rounded-full bg-amber-400 sm:hidden shrink-0"
                title={`Vocal ${Math.round((options.centerAnchor ?? 0.18) * 100)}%`}
              />
            </>
          )}
          <span className="text-slate-600">•</span>
          <span className="text-emerald-300 hidden sm:inline capitalize">
            {options.reverbRoom || "Club"} {Math.round((options.reverbLevel ?? 0.16) * 100)}%
          </span>
          <span
            className="w-1.5 h-1.5 rounded-full bg-emerald-400 sm:hidden shrink-0"
            title={`${options.reverbRoom || "Club"} Reverb ${Math.round((options.reverbLevel ?? 0.16) * 100)}%`}
          />
        </div>
      </div>
    </div>
  );
}
