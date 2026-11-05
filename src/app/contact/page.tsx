import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Mail, MessageSquare } from "lucide-react";

export const metadata = {
  title: "Contact — 8D Audio Converter",
  description: "Get in touch or report an issue with the 8D Audio Converter.",
};

export default function ContactPage() {
  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <Header />
      <main className="flex-grow p-4 md:p-8">
        <div className="max-w-2xl mx-auto space-y-6 bg-white p-6 sm:p-10 rounded-2xl border border-slate-200 shadow-sm">
          <div className="space-y-2">
            <h1 className="text-3xl font-extrabold text-slate-900">Contact Us</h1>
            <p className="text-slate-600 text-sm">
              Have feedback, questions, or ideas for new spatial audio effects?
              Reach out to us!
            </p>
          </div>

          <div className="space-y-4 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
              <Mail className="w-5 h-5 text-blue-600" />
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase">
                  Email
                </div>
                <a
                  href="mailto:aswinmshenoy2000@gmail.com"
                  className="text-sm font-medium text-blue-600 hover:underline"
                >
                  aswinmshenoy2000@gmail.com
                </a>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
              <MessageSquare className="w-5 h-5 text-purple-600" />
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase">
                  GitHub Issues
                </div>
                <a
                  href="https://github.com/TheCodePrism/8d-audio-converter/issues"
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-medium text-blue-600 hover:underline"
                >
                  github.com/TheCodePrism/8d-audio-converter
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
