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
    <div className="flex flex-col min-h-screen bg-slate-50">
      <Header />
      <main className="flex-grow p-4 md:p-8">
        <div className="max-w-3xl mx-auto space-y-8 bg-white p-6 sm:p-10 rounded-2xl border border-slate-200 shadow-sm">
          <div className="space-y-3">
            <h1 className="text-3xl font-extrabold text-slate-900">
              What is 8D Audio?
            </h1>
            <p className="text-slate-600 leading-relaxed">
              8D Audio is an immersive audio production technique that uses
              binaural panning, frequency attenuation, and spatial reverberation
              to create the illusion of music moving physically around your head
              in a 360-degree circle.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-800">
              The Science: Head-Related Transfer Function (HRTF)
            </h2>
            <p className="text-slate-600 text-sm leading-relaxed">
              When humans hear a sound in the real world, the sound waves arrive
              at each ear at slightly different times (Interaural Time
              Difference) and with slight volume and frequency filtering caused
              by the shape of our head and ears (Interaural Level Difference).
              Our converter simulates these precise acoustic transformations using
              the Web Audio API’s HRTF spatialization model.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <Headphones className="w-5 h-5 text-blue-600 mb-2" />
              <h3 className="font-semibold text-slate-800 text-sm">
                Headphones Required
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Because 8D audio relies on stereo channel separation delivered
                directly to each ear, listening on normal speakers merges both
                channels and reduces the effect.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <Shield className="w-5 h-5 text-emerald-600 mb-2" />
              <h3 className="font-semibold text-slate-800 text-sm">
                100% In-Browser Privacy
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Your audio files are never uploaded to any remote server or
                cloud. All DSP mathematics happen locally inside your browser
                hardware.
              </p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
