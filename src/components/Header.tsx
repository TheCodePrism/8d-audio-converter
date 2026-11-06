import Link from "next/link";
import { Headphones, Github, Sparkles, Radio } from "lucide-react";

export default function Header() {
  return (
    <header className="bg-slate-950/80 border-b border-slate-800/80 sticky top-0 z-40 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo & Brand */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-3 group">
              <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-purple-600 text-white shadow-lg shadow-cyan-500/25 group-hover:scale-105 transition-all">
                <Headphones className="h-5 w-5" />
              </div>
              <div>
                <span className="text-base font-bold text-white tracking-tight flex items-center gap-1.5">
                  8D Audio Studio
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 uppercase">
                    PRO
                  </span>
                </span>
                <span className="text-[11px] text-slate-400 hidden sm:block">
                  360° Spatial Sound Player & Converter
                </span>
              </div>
            </Link>
          </div>

          {/* Navigation Links */}
          <nav className="flex items-center space-x-4 sm:space-x-6 text-xs sm:text-sm font-medium">
            <Link
              href="/"
              className="text-slate-200 hover:text-cyan-400 transition-colors flex items-center gap-1"
            >
              <Radio className="w-3.5 h-3.5 text-cyan-400" />
              <span>Studio</span>
            </Link>
            <Link
              href="/about"
              className="text-slate-400 hover:text-cyan-400 transition-colors"
            >
              HRTF Science
            </Link>
            <Link
              href="/contact"
              className="text-slate-400 hover:text-cyan-400 transition-colors hidden sm:block"
            >
              Contact
            </Link>
            <a
              href="https://github.com/TheCodePrism/8d-audio-converter"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-300 hover:text-white transition-all text-xs font-semibold shadow-sm"
            >
              <Github className="w-3.5 h-3.5" />
              <span>GitHub</span>
            </a>
          </nav>
        </div>
      </div>
    </header>
  );
}
