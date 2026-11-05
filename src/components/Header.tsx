import Link from "next/link";
import { Headphones, Github } from "lucide-react";

export default function Header() {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 backdrop-blur-md bg-white/90">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2.5 group">
              <div className="p-2 rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20 group-hover:bg-blue-700 transition-colors">
                <Headphones className="h-5 w-5" />
              </div>
              <span className="text-lg font-bold text-slate-900 tracking-tight">
                8D Audio
              </span>
            </Link>
          </div>

          <nav className="flex items-center space-x-6 text-sm font-medium">
            <Link
              href="/"
              className="text-slate-600 hover:text-blue-600 transition-colors"
            >
              Converter
            </Link>
            <Link
              href="/about"
              className="text-slate-600 hover:text-blue-600 transition-colors"
            >
              How it Works
            </Link>
            <Link
              href="/contact"
              className="text-slate-600 hover:text-blue-600 transition-colors"
            >
              Contact
            </Link>
            <a
              href="https://github.com/TheCodePrism/8d-audio-converter"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition-colors text-xs font-semibold"
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
