import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Mail, MessageSquare } from "lucide-react";

export const metadata = {
  title: "Contact — 8D Audio Converter",
  description: "Get in touch or report an issue with the 8D Audio Converter.",
};

export default function ContactPage() {
  return (
    <div className="flex flex-col min-h-screen bg-[#07090E] text-slate-100">
      <Header />
      <main className="flex-grow p-4 md:p-8">
        <div className="max-w-2xl mx-auto space-y-6 bg-slate-900/80 p-6 sm:p-10 rounded-3xl border border-slate-800 shadow-2xl backdrop-blur-xl">
          <div className="space-y-2">
            <h1 className="text-3xl font-extrabold text-white">Contact & Support</h1>
            <p className="text-slate-400 text-sm">
              Have feedback, questions, or ideas for new spatial audio presets?
              Reach out to us!
            </p>
          </div>

          <div className="space-y-4 pt-4 border-t border-slate-800">
            <div className="flex items-center gap-3.5 p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
              <Mail className="w-5 h-5 text-cyan-400" />
              <div>
                <div className="text-[11px] font-mono font-semibold text-slate-400 uppercase">
                  Email Support
                </div>
                <a
                  href="mailto:aswinmshenoy2000@gmail.com"
                  className="text-sm font-medium text-cyan-400 hover:underline"
                >
                  aswinmshenoy2000@gmail.com
                </a>
              </div>
            </div>

            <div className="flex items-center gap-3.5 p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
              <MessageSquare className="w-5 h-5 text-purple-400" />
              <div>
                <div className="text-[11px] font-mono font-semibold text-slate-400 uppercase">
                  GitHub Issues & Feature Requests
                </div>
                <a
                  href="https://github.com/TheCodePrism/8d-audio-converter/issues"
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-medium text-purple-400 hover:underline"
                >
                  github.com/TheCodePrism/8d-audio-converter/issues
                </a>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
