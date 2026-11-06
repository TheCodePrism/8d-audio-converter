import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Headphones, Sparkles, Volume2, Shield } from "lucide-react";

export const metadata = {
  title: "About 8D Audio — How It Works",
  description:
    "Learn the science behind 8D audio, Head-Related Transfer Function (HRTF), and how our in-browser converter works.",
};

export default function AboutPage() {
  return (
    <div className="flex flex-col min-h-screen bg-[#07090E] text-slate-100">
      <Header />
      <main className="flex-grow p-4 md:p-8">
        <div className="max-w-3xl mx-auto space-y-8 bg-slate-900/80 p-6 sm:p-10 rounded-3xl border border-slate-800 shadow-2xl backdrop-blur-xl">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-mono font-medium">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Acoustic Science</span>
            </div>
            <h1 className="text-3xl font-extrabold text-white">
              What is 8D Audio?
            </h1>
            <p className="text-slate-300 leading-relaxed text-sm md:text-base">
              8D Audio is an immersive audio production technique that uses
              binaural panning, frequency attenuation, and spatial reverberation
              to create the illusion of music moving physically around your head
              in a 360-degree circle.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white">
              The Science: Head-Related Transfer Function (HRTF)
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              When humans hear a sound in the real world, the sound waves arrive
              at each ear at slightly different times (Interaural Time
              Difference) and with slight volume and frequency filtering caused
              by the shape of our head and ears (Interaural Level Difference).
              Our studio simulates these precise acoustic transformations using
              the Web Audio API’s HRTF spatialization model.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-800">
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
              <Headphones className="w-5 h-5 text-cyan-400 mb-2" />
              <h3 className="font-semibold text-white text-sm">
                Headphones Required
              </h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Because 8D audio relies on stereo channel separation delivered
                directly to each ear, regular speakers cannot reproduce the 3D
                binaural illusion.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
              <Shield className="w-5 h-5 text-emerald-400 mb-2" />
              <h3 className="font-semibold text-white text-sm">
                100% In-Browser DSP
              </h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Your files are decoded and processed locally in your browser
                using high-performance Web Audio API threads without any cloud
                uploads.
              </p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
