import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata = {
  title: "Privacy Policy — 8D Audio Converter",
  description: "Privacy policy for the 8D Audio Converter application.",
};

export default function PrivacyPage() {
  return (
    <div className="flex flex-col min-h-screen bg-[#07090E] text-slate-100">
      <Header />
      <main className="flex-grow p-4 md:p-8">
        <div className="max-w-3xl mx-auto space-y-6 bg-slate-900/80 p-6 sm:p-10 rounded-3xl border border-slate-800 shadow-2xl backdrop-blur-xl">
          <h1 className="text-3xl font-extrabold text-white">
            Privacy Policy
          </h1>
          <p className="text-slate-300 text-sm leading-relaxed">
            Your privacy is our priority. Unlike traditional cloud converter tools,
            <strong className="text-white"> 8D Audio Converter does not upload your files to any remote server.</strong>
          </p>

          <div className="space-y-4 text-slate-400 text-sm leading-relaxed">
            <h2 className="text-lg font-bold text-white">1. Client-Side Audio Processing</h2>
            <p>
              All audio analysis, decoding, spatial rotation calculations, and
              WAV encoding occur entirely in your local web browser session using
              the standard Web Audio API. No copies of your music or recordings
              are sent across the network.
            </p>

            <h2 className="text-lg font-bold text-white">2. Analytics & Storage</h2>
            <p>
              We do not track or store personal identifiers or cookies. Any
              temporary object URLs generated during audio rendering are held in
              local browser memory only and released when you close or reload the
              tab.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
