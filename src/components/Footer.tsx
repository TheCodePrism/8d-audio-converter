import Link from "next/link";
import { Headphones, Heart } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-white border-t border-slate-200 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Headphones className="h-5 w-5 text-blue-600" />
              <span className="font-bold text-slate-800 text-sm">
                8D Audio Converter
              </span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Experience music in a new dimension with in-browser 8D spatial
              sound. High quality binaural rotation, bass enhancement, and room
              reverberation.
            </p>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-slate-600 tracking-wider uppercase">
              Explore
            </h3>
            <ul className="mt-3 space-y-2 text-xs">
              <li>
                <Link
                  href="/"
                  className="text-slate-500 hover:text-blue-600 transition-colors"
                >
                  Converter Home
                </Link>
              </li>
              <li>
                <Link
                  href="/about"
                  className="text-slate-500 hover:text-blue-600 transition-colors"
                >
                  How 8D Audio Works
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy"
                  className="text-slate-500 hover:text-blue-600 transition-colors"
                >
                  Privacy Policy
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-slate-600 tracking-wider uppercase">
              Connect & Source
            </h3>
            <ul className="mt-3 space-y-2 text-xs">
              <li>
                <a
                  href="https://github.com/TheCodePrism/8d-audio-converter"
                  target="_blank"
                  rel="noreferrer"
                  className="text-slate-500 hover:text-blue-600 transition-colors"
                >
                  GitHub Repository
                </a>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="text-slate-500 hover:text-blue-600 transition-colors"
                >
                  Contact & Support
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-2">
          <p>© {new Date().getFullYear()} 8D Audio Converter. All rights reserved.</p>
          <p className="flex items-center gap-1">
            Built with <Heart className="w-3.5 h-3.5 text-red-500 fill-current" /> for music lovers
          </p>
        </div>
      </div>
    </footer>
  );
}
