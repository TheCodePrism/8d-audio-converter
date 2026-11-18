import { Sparkles, Headphones } from "lucide-react";

export default function Banner() {
  return (
    <div className="bg-gradient-to-r from-cyan-950 via-slate-950 to-purple-950 border-b border-cyan-500/20 text-slate-300 py-1.5 px-3 sm:py-2 sm:px-4 text-[11px] sm:text-xs font-mono text-center relative overflow-hidden">
      <div className="max-w-7xl mx-auto flex items-center justify-center gap-1.5 sm:gap-2">
        <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-cyan-400 animate-pulse shrink-0" />
        <span>
          <strong className="text-white">Headphones Recommended:</strong>{" "}
          <span className="hidden sm:inline">
            Sound actively orbits around your head using binaural HRTF 3D physics.
          </span>
          <span className="sm:hidden">Best with headphones for 360° sound.</span>
        </span>
        <Headphones className="h-3.5 w-3.5 text-purple-400 shrink-0 hidden sm:inline" />
      </div>
    </div>
  );
}
