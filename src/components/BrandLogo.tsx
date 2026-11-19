"use client";

import React, { useState } from "react";

interface BrandLogoProps {
  className?: string;
  size?: number;
  forceHover?: boolean;
}

export default function BrandLogo({
  className = "w-10 h-10",
  size = 48,
  forceHover,
}: BrandLogoProps) {
  const [isSelfHovered, setIsSelfHovered] = useState(false);
  const activeHover = forceHover !== undefined ? forceHover : isSelfHovered;

  return (
    <div
      className={`relative inline-flex items-center justify-center select-none cursor-pointer group ${className}`}
      onMouseEnter={() => setIsSelfHovered(true)}
      onMouseLeave={() => setIsSelfHovered(false)}
      style={{ width: size, height: size }}
      title="8D Audio Studio — Hover to spatialize"
    >
      {/* Ambient background bloom glow */}
      <div
        className={`absolute inset-0 rounded-2xl bg-gradient-to-tr from-cyan-500/30 via-blue-600/20 to-purple-600/30 blur-md transition-all duration-700 pointer-events-none ${
          activeHover
            ? "opacity-100 scale-125 from-cyan-400/50 via-blue-500/30 to-purple-500/60"
            : "opacity-40 group-hover:opacity-90 group-hover:scale-110"
        }`}
      />

      <svg
        viewBox="0 0 100 100"
        className="w-full h-full relative z-10 overflow-visible transition-transform duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Primary 8D Neon Gradient */}
          <linearGradient id="logo8DGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="50%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>

          {/* Secondary Wire Gradient */}
          <linearGradient id="wireGrad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#06b6d4" />
            <stop offset="40%" stopColor="#818cf8" />
            <stop offset="80%" stopColor="#c084fc" />
            <stop offset="100%" stopColor="#f43f5e" />
          </linearGradient>

          {/* Glowing filter */}
          <filter id="neonFilter" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* ── 360° Orbital Aura Ring ── */}
        <ellipse
          cx="50"
          cy="50"
          rx="44"
          ry="20"
          className={`transition-all duration-700 ease-out origin-center stroke-cyan-400/40 ${
            activeHover
              ? "opacity-90 rotate-45 scale-110 stroke-cyan-300 stroke-[2.2]"
              : "opacity-30 -rotate-20 stroke-[1.5] group-hover:opacity-75 group-hover:rotate-12"
          }`}
          strokeDasharray="4 4"
        />

        {/* Orbiting Sound Particle (spins faster on hover) */}
        <circle
          cx="50"
          cy="50"
          r="2.5"
          className={`fill-cyan-300 filter drop-shadow-[0_0_6px_#22d3ee] transition-all duration-700 ${
            activeHover
              ? "translate-x-[36px] translate-y-[-24px] scale-125"
              : "translate-x-[-32px] translate-y-[-16px] group-hover:translate-x-[28px]"
          }`}
        />

        {/* ── CENTER CORE: Figure 8 morphing into Infinity (∞) ── */}
        <g
          className={`origin-center transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
            activeHover
              ? "rotate-90 scale-110"
              : "rotate-0 scale-100 group-hover:rotate-90 group-hover:scale-110"
          }`}
        >
          {/* Continuous Figure-8 Path: Smooth two-lobed loop */}
          <path
            d="M 50,50 
               C 40,50 34,43 34,35 
               C 34,26 41,20 50,20 
               C 59,20 66,26 66,35 
               C 66,43 60,50 50,50 
               C 40,50 32,57 32,66 
               C 32,75 40,82 50,82 
               C 60,82 68,75 68,66 
               C 68,57 60,50 50,50 Z"
            stroke="url(#logo8DGrad)"
            strokeWidth={activeHover ? 5.5 : 5}
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#neonFilter)"
            className="transition-all duration-500"
          />

          {/* Core Sound Nodes inside the lobes */}
          <circle
            cx="50"
            cy="35"
            r={activeHover ? "3" : "2"}
            className="fill-cyan-300 transition-all duration-500"
          />
          <circle
            cx="50"
            cy="66"
            r={activeHover ? "3" : "2"}
            className="fill-purple-300 transition-all duration-500"
          />
        </g>

        {/* ── OVER-EAR HEADPHONE STRUCTURE ── */}
        {/* Headband Arch: rests over 8 in resting state, expands into spatial orbit on hover */}
        <g
          className={`origin-center transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
            activeHover
              ? "opacity-60 scale-125 -translate-y-1"
              : "opacity-100 scale-100 translate-y-0 group-hover:opacity-60 group-hover:scale-125"
          }`}
        >
          {/* Headband outer cushion arc */}
          <path
            d="M 22,50 C 22,22 78,22 78,50"
            stroke="url(#logo8DGrad)"
            strokeWidth="3.5"
            strokeLinecap="round"
            fill="none"
          />
          {/* Headband inner structural rail */}
          <path
            d="M 26,48 C 26,27 74,27 74,48"
            stroke="#0f172a"
            strokeWidth="1.5"
            strokeLinecap="round"
            fill="none"
          />
        </g>

        {/* Left Earcup */}
        <rect
          x="16"
          y="42"
          width="11"
          height="22"
          rx="5.5"
          fill="#07090e"
          stroke="url(#logo8DGrad)"
          strokeWidth="2.2"
          className={`origin-center transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
            activeHover
              ? "-translate-x-3.5 -rotate-12 scale-90"
              : "translate-x-0 rotate-0 scale-100 group-hover:-translate-x-3.5 group-hover:-rotate-12"
          }`}
        />
        {/* Left Earcup LED slot */}
        <rect
          x="19"
          y="46"
          width="4"
          height="14"
          rx="2"
          fill="#22d3ee"
          className={`transition-opacity duration-500 ${
            activeHover ? "opacity-100" : "opacity-70 group-hover:opacity-100"
          }`}
        />

        {/* Right Earcup */}
        <rect
          x="73"
          y="42"
          width="11"
          height="22"
          rx="5.5"
          fill="#07090e"
          stroke="url(#logo8DGrad)"
          strokeWidth="2.2"
          className={`origin-center transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
            activeHover
              ? "translate-x-3.5 rotate-12 scale-90"
              : "translate-x-0 rotate-0 scale-100 group-hover:translate-x-3.5 group-hover:rotate-12"
          }`}
        />
        {/* Right Earcup LED slot */}
        <rect
          x="77"
          y="46"
          width="4"
          height="14"
          rx="2"
          fill="#a855f7"
          className={`transition-opacity duration-500 ${
            activeHover ? "opacity-100" : "opacity-70 group-hover:opacity-100"
          }`}
        />

        {/* ── RESTING AUDIO CORD (Neat drop when not hovered) ── */}
        <path
          d="M 22,64 C 20,74 24,84 32,88 C 38,91 44,92 50,92"
          stroke="url(#wireGrad)"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
          className={`transition-all duration-500 ${
            activeHover
              ? "opacity-0 scale-50"
              : "opacity-80 scale-100 group-hover:opacity-0 group-hover:scale-50"
          }`}
        />

        {/* ── TANGLED / WEAVING HEADSET WIRE (Morphs & tangles around infinity loops on hover) ── */}
        <g
          className={`transition-all duration-700 ease-out ${
            activeHover
              ? "opacity-100 scale-100"
              : "opacity-0 scale-75 pointer-events-none group-hover:opacity-100 group-hover:scale-100"
          }`}
        >
          {/* 3D Tangled Wire looping around the infinity lobes */}
          <path
            d="M 17,60 
               C 10,72 26,82 36,78 
               C 48,72 32,56 46,46 
               C 56,38 72,42 78,32 
               C 84,22 66,16 54,26 
               C 42,36 60,60 74,66 
               C 86,72 94,56 84,48
               C 76,42 66,48 58,54
               C 46,62 38,72 30,76
               C 22,80 18,88 24,94
               C 30,100 44,98 52,94"
            stroke="url(#wireGrad)"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            filter="url(#neonFilter)"
            strokeDasharray="180"
            className="animate-pulse"
          />

          {/* Golden mini-jack / 3.5mm plug dangling at the end of the tangled cable */}
          <circle cx="52" cy="94" r="2.5" fill="#facc15" />
          <line
            x1="52"
            y1="94"
            x2="56"
            y2="97"
            stroke="#facc15"
            strokeWidth="1.8"
            strokeLinecap="round"
          />

          {/* Tiny neon sparks / spatial acoustic particles orbiting the tangle */}
          <circle cx="34" cy="48" r="1.5" fill="#38bdf8" className="animate-ping" />
          <circle cx="68" cy="52" r="1.5" fill="#c084fc" className="animate-ping" />
        </g>
      </svg>
    </div>
  );
}
