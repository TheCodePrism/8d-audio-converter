"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Activity,
  X,
  Volume2,
  Copy,
  Check,
  Trash2,
  Wifi,
  WifiOff,
  Cpu,
  Layers,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  ShieldAlert,
} from "lucide-react";
import { clientLogger, ClientLogEntry, LogTag } from "@/lib/clientLogger";

interface UserDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UserDiagnosticsModal({ isOpen, onClose }: UserDiagnosticsModalProps) {
  const [logs, setLogs] = useState<ClientLogEntry[]>([]);
  const [filter, setFilter] = useState<"all" | "errors" | LogTag>("all");
  const [copied, setCopied] = useState(false);
  const [audioTesting, setAudioTesting] = useState(false);
  const [audioSupported, setAudioSupported] = useState<boolean | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(true);

  useEffect(() => {
    setLogs(clientLogger.getLogs());
    const unsubscribe = clientLogger.subscribe((updated) => setLogs(updated));

    if (typeof window !== "undefined") {
      setIsOnline(navigator.onLine);
      const handleOnline = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);

      const supported = "AudioContext" in window || "webkitAudioContext" in window;
      setAudioSupported(supported);

      return () => {
        unsubscribe();
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }
    return unsubscribe;
  }, []);

  if (!isOpen) return null;

  const filteredLogs = logs.filter((l) => {
    if (filter === "all") return true;
    if (filter === "errors") return l.level === "error" || l.level === "warn";
    return l.tag === filter;
  });

  const handleCopyReport = async () => {
    const report = clientLogger.generateBugReport();
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback
    }
  };

  const handleTestAudio = () => {
    if (audioTesting) return;
    try {
      setAudioTesting(true);
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) throw new Error("AudioContext not supported");

      const ctx = new AudioCtx();
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const panner = ctx.createPanner();

      panner.panningModel = "HRTF";
      panner.distanceModel = "inverse";
      panner.positionX.setValueAtTime(-2, ctx.currentTime);
      panner.positionX.linearRampToValueAtTime(2, ctx.currentTime + 0.6);

      osc.type = "sine";
      osc.frequency.setValueAtTime(520, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.5);

      gain.gain.setValueAtTime(0.01, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

      osc.connect(panner);
      panner.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.6);

      clientLogger.success("System", "Audio hardware output test chime emitted successfully.");

      setTimeout(() => {
        setAudioTesting(false);
        ctx.close();
      }, 700);
    } catch (err: any) {
      setAudioTesting(false);
      clientLogger.error("System", "Audio test failed:", err?.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl max-h-[85vh] flex flex-col rounded-3xl border border-slate-800 bg-[#0A0D14] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-slate-900/40">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Session Diagnostics & Logs
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  Client Telemetry
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Track your local conversions, audio playback events, and device capability.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Telemetry quick status chips */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 px-6 py-3 border-b border-slate-800/60 bg-slate-950/40 text-xs">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900/60 border border-slate-800">
            {isOnline ? (
              <Wifi className="w-4 h-4 text-emerald-400" />
            ) : (
              <WifiOff className="w-4 h-4 text-rose-400" />
            )}
            <div>
              <div className="text-[10px] text-slate-400">Network</div>
              <div className="font-semibold text-slate-200">
                {isOnline ? "Online" : "Offline"}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900/60 border border-slate-800">
            <Cpu className="w-4 h-4 text-cyan-400" />
            <div>
              <div className="text-[10px] text-slate-400">Web Audio API</div>
              <div className="font-semibold text-slate-200">
                {audioSupported ? "HRTF Capable" : "Unsupported"}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900/60 border border-slate-800">
            <Layers className="w-4 h-4 text-purple-400" />
            <div>
              <div className="text-[10px] text-slate-400">Recorded Events</div>
              <div className="font-semibold text-slate-200">{logs.length} items</div>
            </div>
          </div>

          <button
            onClick={handleTestAudio}
            disabled={audioTesting}
            className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
          >
            <Volume2 className={`w-4 h-4 ${audioTesting ? "animate-pulse" : ""}`} />
            <span>{audioTesting ? "Testing..." : "Test Audio Output"}</span>
          </button>
        </div>

        {/* Filter bar */}
        <div className="flex items-center justify-between px-6 py-2.5 border-b border-slate-800/40 bg-slate-900/20 text-xs">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {(["all", "errors", "Queue", "YouTube", "DSP", "Player", "Storage"] as const).map(
              (f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                    filter === f
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent"
                  }`}
                >
                  {f === "all" ? "All Logs" : f === "errors" ? "Errors Only" : f}
                </button>
              )
            )}
          </div>

          <button
            onClick={() => clientLogger.clear()}
            className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-rose-400 transition-colors shrink-0 ml-2"
            title="Clear current log buffer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        </div>

        {/* Log Viewer Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-2 font-mono text-[11px] leading-relaxed select-text bg-[#07090E]/90 min-h-[260px] max-h-[400px]">
          {filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <CheckCircle2 className="w-8 h-8 text-slate-400/50 mb-2" />
              <p>No log events recorded matching this filter.</p>
            </div>
          ) : (
            filteredLogs.map((log) => {
              const dateStr = new Date(log.timestamp).toLocaleTimeString();
              const isErr = log.level === "error";
              const isWarn = log.level === "warn";
              const isSuccess = log.level === "success";

              return (
                <div
                  key={log.id}
                  className={`p-2.5 rounded-xl border transition-all ${
                    isErr
                      ? "bg-rose-500/10 border-rose-500/30 text-rose-200"
                      : isWarn
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-200"
                      : isSuccess
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-200"
                      : "bg-slate-900/60 border-slate-800/80 text-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400">{dateStr}</span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                          isErr
                            ? "bg-rose-500/30 text-rose-300"
                            : isWarn
                            ? "bg-amber-500/30 text-amber-300"
                            : isSuccess
                            ? "bg-emerald-500/30 text-emerald-300"
                            : "bg-cyan-500/20 text-cyan-300"
                        }`}
                      >
                        {log.tag}
                      </span>
                    </div>
                  </div>
                  <div className="break-words">{log.message}</div>
                  {log.details && (
                    <pre className="mt-1.5 p-2 rounded-lg bg-black/50 text-[10px] text-slate-400 overflow-x-auto whitespace-pre-wrap">
                      {typeof log.details === "string"
                        ? log.details
                        : JSON.stringify(log.details, null, 2)}
                    </pre>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-slate-800/80 bg-slate-900/40 text-xs">
          <div className="flex items-center gap-2 text-slate-400">
            <ShieldAlert className="w-4 h-4 text-purple-400" />
            <span>Administrator?</span>
            <Link
              href="/admin"
              onClick={onClose}
              className="text-cyan-400 hover:text-cyan-300 underline font-medium inline-flex items-center gap-1"
            >
              Open Admin Terminal <ExternalLink className="w-3 h-3" />
            </Link>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              onClick={handleCopyReport}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold border border-slate-700 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? "Report Copied!" : "Copy Bug Report"}</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold transition-all shadow-lg shadow-cyan-500/20 hover:scale-[1.02] active:scale-[0.98]"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
