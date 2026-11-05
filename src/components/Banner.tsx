import { Sparkles, Headphones } from "lucide-react";

export default function Banner() {
  return (
    <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white py-2.5 px-4 text-xs sm:text-sm font-medium relative overflow-hidden text-center shadow-inner">
      <div className="max-w-7xl mx-auto flex items-center justify-center gap-2">
        <Sparkles className="h-4 w-4 text-amber-300 animate-pulse shrink-0" />
        <span>
          <strong>360° HRTF Spatial Engine & Radar Visualizer</strong> is now live!
          Wear headphones for the full immersive effect.
        </span>
        <Headphones className="h-4 w-4 text-blue-200 shrink-0 hidden sm:inline" />
      </div>
    </div>
  );
}
