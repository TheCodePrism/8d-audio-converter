import Link from "next/link";
import { Headphones, Heart, Sparkles, ShieldCheck } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-slate-950 border-t border-slate-900 mt-auto text-slate-400">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-gradient-to-tr from-cyan-500 to-purple-600 text-white shadow-md shadow-cyan-500/20">
                <Headphones className="h-4 w-4" />
              </div>
              <span className="font-bold text-white text-sm">
                8D Audio Spatial Studio
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
              Transform standard stereo songs into a 360-degree binaural spatial
              soundscape. Featuring 3D HRTF listener simulation, customizable
              orbit speed, acoustic room reverb, and deep bass boost.
            </p>
            <div className="flex items-center gap-2 text-[11px] font-mono text-emerald-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>100% Client-Side In-Browser Audio DSP Processing</span>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-mono font-bold text-slate-300 tracking-wider uppercase mb-3">
              Studio Features
            </h3>
            <ul className="space-y-2 text-xs">
              <li>
                <span className="text-slate-400">360° HRTF Binaural Panner</span>
              </li>
              <li>
                <span className="text-slate-400">Interactive Radar Visualizer</span>
              </li>
              <li>
                <span className="text-slate-400">A/B Real-time Audio Comparison</span>
              </li>
              <li>
                <span className="text-slate-400">Lossless 16-bit WAV Export</span>
              </li>
              <li>
                <span className="text-slate-400">YouTube Video & Playlist Importer</span>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-mono font-bold text-slate-300 tracking-wider uppercase mb-3">
              Navigation
            </h3>
            <ul className="space-y-2 text-xs">
              <li>
                <Link
                  href="/"
                  className="text-slate-400 hover:text-cyan-400 transition-colors"
                >
                  Audio Player & Studio
                </Link>
              </li>
              <li>
                <Link
                  href="/about"
                  className="text-slate-400 hover:text-cyan-400 transition-colors"
                >
                  How 8D Audio Works
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy"
                  className="text-slate-400 hover:text-cyan-400 transition-colors"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="text-slate-400 hover:text-cyan-400 transition-colors"
                >
                  Support & Feedback
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} 8D Audio Converter. Open source MIT.</p>
          <p className="flex items-center gap-1">
            Built with 360° spatial acoustics & Web Audio API
          </p>
        </div>
      </div>
    </footer>
  );
}
