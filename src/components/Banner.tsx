import { Sparkles, Headphones } from "lucide-react";

export default function Banner() {
  return (
    <div className="bg-gradient-to-r from-cyan-950 via-slate-950 to-purple-950 border-b border-cyan-500/20 text-slate-300 py-2 px-4 text-xs font-mono text-center relative overflow-hidden">
      <div className="max-w-7xl mx-auto flex items-center justify-center gap-2">
        <Sparkles className="h-3.5 w-3.5 text-cyan-400 animate-pulse shrink-0" />
        <span>
          <strong className="text-white">Headphones Required:</strong> Sound actively orbits around your head using binaural HRTF 3D physics.
        </span>
        <Headphones className="h-3.5 w-3.5 text-purple-400 shrink-0 hidden sm:inline" />
      </div>
    </div>
  );
}
