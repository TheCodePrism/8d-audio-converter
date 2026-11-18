import { Metadata } from "next";
import AudioConverter from "@/components/AudioConverter";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Banner from "@/components/Banner";
import { Headphones, ShieldCheck, Zap, Compass, Disc3, Radio } from "lucide-react";

export const metadata: Metadata = {
  title: "8D Audio Converter & Spatial Player — 360° Binaural Music Studio",
  description:
    "Convert normal songs and audio tracks to 8D audio online with real-time 3D rotation, dynamic bass boost, and room reverb. Listen with headphones for 360° binaural immersion.",
};

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-[#07090E] text-slate-100 selection:bg-cyan-500 selection:text-black">
      <Banner />
      <Header />

      <main className="flex-grow px-3 py-3 sm:px-4 sm:py-6 md:px-8 md:py-8 max-w-7xl mx-auto w-full space-y-4 sm:space-y-8 pb-28 lg:pb-8">
        {/* Top Studio Hero Header — compact on mobile */}
        <div className="text-center space-y-1.5 sm:space-y-3 pt-0 sm:pt-2 md:pt-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 sm:px-3.5 sm:py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-[10px] sm:text-xs font-mono font-medium tracking-wide">
            <Radio className="w-3 h-3 sm:w-3.5 sm:h-3.5 animate-pulse" />
            <span>360° BINAURAL HRTF SPATIALIZER</span>
          </div>

          <h1 className="text-xl sm:text-3xl md:text-5xl font-extrabold tracking-tight">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-500">
              8D Spatial Audio
            </span>{" "}
            <span className="hidden sm:inline">Music Player</span>
          </h1>

          <p className="text-slate-400 text-xs sm:text-sm max-w-2xl mx-auto leading-relaxed hidden sm:block">
            Convert standard stereo tracks into an immersive 8D soundscape that orbits
            around your head in real-time. Load local tracks, paste YouTube songs, or try our instant demo audio.
          </p>
        </div>

        {/* Main 8D Music Player & Studio Converter */}
        <AudioConverter />

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
          <div className="p-4 bg-slate-900/60 rounded-2xl border border-slate-800/80 backdrop-blur-md flex items-start gap-3.5 shadow-lg">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">
                True 360° HRTF Orbit
              </h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Simulates real-world acoustic ear delays (ITD) and head shadow
                filters (ILD) to rotate sound smoothly around you.
              </p>
            </div>
          </div>

          <div className="p-4 bg-slate-900/60 rounded-2xl border border-slate-800/80 backdrop-blur-md flex items-start gap-3.5 shadow-lg">
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Disc3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">
                Instant A/B Audio Switch
              </h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Toggle seamlessly between the original stereo mix and the 8D master
                during playback to hear the acoustic difference.
              </p>
            </div>
          </div>

          <div className="p-4 bg-slate-900/60 rounded-2xl border border-slate-800/80 backdrop-blur-md flex items-start gap-3.5 shadow-lg">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">
                100% Private In-Browser
              </h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                All DSP rendering is executed on your device using Web Audio API.
                Your uploaded files never touch a cloud server.
              </p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
