import { Metadata } from "next";
import AudioConverter from "@/components/AudioConverter";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Banner from "@/components/Banner";
import { Headphones, ShieldCheck, Zap, Compass } from "lucide-react";

export const metadata: Metadata = {
  title: "8D Audio Converter — Free Online 360° Spatial Sound Generator",
  description:
    "Convert normal audio tracks to 8D audio online with real-time 3D rotation, dynamic bass boost, and room reverb.",
};

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <Banner />
      <Header />

      <main className="flex-grow p-4 md:p-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Hero Header */}
          <div className="text-center space-y-3 pt-4">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold">
              <Headphones className="w-3.5 h-3.5" />
              <span>Headphones Recommended</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600">
              8D Audio Converter
            </h1>
            <p className="text-slate-600 text-sm md:text-base max-w-2xl mx-auto leading-relaxed">
              Upload any audio track to create an immersive 360° spatial audio
              experience where sound smoothly orbits around your head with deep
              bass and reverberation.
            </p>
          </div>

          {/* Main Converter Tool */}
          <AudioConverter />

          {/* Value Prop Badges */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm flex items-start gap-3">
              <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                <Compass className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-800">
                  True 360° HRTF Orbit
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Simulates realistic binaural positioning moving continuously
                  front, back, left, and right.
                </p>
              </div>
            </div>

            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm flex items-start gap-3">
              <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-800">
                  100% Private & In-Browser
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Your audio never leaves your device. All DSP processing is
                  rendered directly in your browser.
                </p>
              </div>
            </div>

            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm flex items-start gap-3">
              <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-800">
                  Customizable Presets
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tune rotation speeds, reverb room size, and bass boost with
                  instant A/B audio comparison.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
