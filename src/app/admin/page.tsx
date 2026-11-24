"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Activity,
  Server,
  Cpu,
  Layers,
  RotateCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Radio,
  Search,
  ExternalLink,
  Shield,
  Wifi,
  Terminal,
  Volume2,
  Sparkles,
  ArrowRight,
  Database,
  RefreshCw,
  Gauge,
  Play,
  Download,
  Trash2,
  Globe,
  Sliders,
  Check,
} from "lucide-react";
import { AdminGatekeeper } from "@/components/AdminGatekeeper";
import { clientLogger, ClientLogEntry } from "@/lib/clientLogger";

interface BackendHealth {
  status: string;
  service?: string;
  uptime?: number;
  timestamp?: string;
  nodeVersion?: string;
  platform?: string;
  memory?: {
    rssMb: number;
    heapUsedMb: number;
    heapTotalMb: number;
  };
  ytDlp?: {
    binary: string;
    hasCookies: boolean;
    hasProxy?: boolean;
  };
  invidious?: {
    totalInstances: number;
    instances: string[];
  };
}

interface ProbeResult {
  success: boolean;
  videoId?: string;
  totalTimeMs?: number;
  logs: string[];
  streamTest?: {
    status: number;
    contentType: string;
    contentLength: string;
    bytesReceived: number;
    decodeSuccess: boolean;
    duration?: number;
    error?: string;
  };
  raw?: any;
}

const BACKEND_OPTIONS = [
  { id: "auto", label: "Auto (Configured Proxy /api/health)", url: "/api/health" },
  { id: "render", label: "Render Cloud (eightd-audio-converter-5nii)", url: "https://eightd-audio-converter-5nii.onrender.com/health" },
  { id: "local", label: "Local Node Server (localhost:3001)", url: "http://localhost:3001/health" },
];

export default function AdminPage() {
  return (
    <AdminGatekeeper>
      {({ adminKey, onLogout }) => <AdminDashboard adminKey={adminKey} onLogout={onLogout} />}
    </AdminGatekeeper>
  );
}

function AdminDashboard({ adminKey, onLogout }: { adminKey: string; onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState<
    "infrastructure" | "invidious" | "youtube-lab" | "client-dsp" | "terminal"
  >("infrastructure");

  // Backend Health State
  const [selectedBackend, setSelectedBackend] = useState<string>("auto");
  const [backendStatus, setBackendStatus] = useState<string>("checking");
  const [backendLatency, setBackendLatency] = useState<number | null>(null);
  const [backendData, setBackendData] = useState<BackendHealth | null>(null);
  const [isHealthRefreshing, setIsHealthRefreshing] = useState(false);

  // Invidious Ping State
  const [invidiousPings, setInvidiousPings] = useState<Record<string, { status: number; latency: number; ok: boolean }>>({});
  const [isPingingPool, setIsPingingPool] = useState(false);

  // YouTube Lab Probe State
  const [testUrl, setTestUrl] = useState("https://www.youtube.com/watch?v=CKVr4PejT3s");
  const [isProbing, setIsProbing] = useState(false);
  const [probeResult, setProbeResult] = useState<ProbeResult | null>(null);

  // Client DSP & Storage State
  const [audioCtxDetails, setAudioCtxDetails] = useState<{
    state: string;
    sampleRate: number;
    channels: number;
    maxChannels: number;
    hrtfSupported: boolean;
    hardwareConcurrency: number;
  } | null>(null);
  const [storageStats, setStorageStats] = useState<{ quotaMb: number; usageMb: number } | null>(null);
  const [dspBenchSpeed, setDspBenchSpeed] = useState<number | null>(null);
  const [isBenchmarking, setIsBenchmarking] = useState(false);

  // Terminal & Logs State
  const [allLogs, setAllLogs] = useState<ClientLogEntry[]>([]);
  const [logFilter, setLogFilter] = useState<string>("all");

  // Fetch Health
  const checkHealth = useCallback(async () => {
    setIsHealthRefreshing(true);
    setBackendStatus("checking");
    const startTime = Date.now();
    try {
      const option = BACKEND_OPTIONS.find((b) => b.id === selectedBackend) || BACKEND_OPTIONS[0];
      const res = await fetch(option.url, { signal: AbortSignal.timeout(6000) });
      const latency = Date.now() - startTime;
      setBackendLatency(latency);

      if (res.ok) {
        const data = await res.json();
        const actual = data.details || data;
        setBackendData(actual);
        setBackendStatus("healthy");
      } else {
        setBackendStatus("error");
      }
    } catch {
      setBackendLatency(Date.now() - startTime);
      setBackendStatus("unreachable");
    } finally {
      setIsHealthRefreshing(false);
    }
  }, [selectedBackend]);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  // Inspect Client Web Audio & Storage
  useEffect(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const panner = ctx.createPanner();
        setAudioCtxDetails({
          state: ctx.state,
          sampleRate: ctx.sampleRate,
          channels: ctx.destination.channelCount,
          maxChannels: ctx.destination.maxChannelCount,
          hrtfSupported: panner.panningModel !== undefined,
          hardwareConcurrency: navigator.hardwareConcurrency || 4,
        });
        ctx.close();
      }
    } catch (e) {
      console.warn("AudioContext inspection error:", e);
    }

    if (navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then((est) => {
        setStorageStats({
          quotaMb: Math.round((est.quota || 0) / (1024 * 1024)),
          usageMb: Math.round((est.usage || 0) / (1024 * 1024)),
        });
      });
    }

    setAllLogs(clientLogger.getLogs());
    const unsub = clientLogger.subscribe((updated) => setAllLogs(updated));
    return unsub;
  }, []);

  // Ping all Invidious instances
  const pingInvidiousPool = async () => {
    const instances = backendData?.invidious?.instances || [
      "inv.tux.pizza",
      "invidious.drgns.space",
      "invidious.asir.dev",
      "yewtu.be",
      "invidious.lunar.icu",
      "invidious.private.coffee",
    ];

    setIsPingingPool(true);
    const results: Record<string, { status: number; latency: number; ok: boolean }> = {};

    await Promise.all(
      instances.map(async (inst) => {
        const start = Date.now();
        try {
          const res = await fetch(`https://${inst}/api/v1/videos/CKVr4PejT3s`, {
            signal: AbortSignal.timeout(4500),
          });
          const elapsed = Date.now() - start;
          results[inst] = { status: res.status, latency: elapsed, ok: res.ok };
        } catch {
          results[inst] = { status: 0, latency: Date.now() - start, ok: false };
        }
      })
    );

    setInvidiousPings(results);
    setIsPingingPool(false);
  };

  // Run Benchmark DSP speed
  const runDspBenchmark = async () => {
    setIsBenchmarking(true);
    setDspBenchSpeed(null);
    try {
      const OfflineCtx = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
      if (!OfflineCtx) throw new Error("OfflineAudioContext not available");

      const sampleRate = 44100;
      const durationSeconds = 10;
      const offline = new OfflineCtx(2, sampleRate * durationSeconds, sampleRate);

      const osc = offline.createOscillator();
      const panner = offline.createPanner();
      panner.panningModel = "HRTF";

      osc.connect(panner);
      panner.connect(offline.destination);
      osc.start(0);

      const start = performance.now();
      await offline.startRendering();
      const elapsedMs = performance.now() - start;

      const speedMultiplier = (durationSeconds * 1000) / elapsedMs;
      setDspBenchSpeed(Math.round(speedMultiplier * 10) / 10);
    } catch (err: any) {
      console.warn("Benchmark error:", err);
    } finally {
      setIsBenchmarking(false);
    }
  };

  // Run YouTube Diagnostic Probe
  const handleRunProbe = async () => {
    if (!testUrl.trim()) return;
    setIsProbing(true);
    setProbeResult(null);

    const logs: string[] = [];
    const pushLog = (msg: string) => logs.push(`[${new Date().toLocaleTimeString()}] ${msg}`);

    pushLog(`Starting authenticated live extraction probe for: ${testUrl}`);

    try {
      // Step 1: Probe Backend Invidious / Info API with adminKey
      pushLog("Querying server-side extraction engine (/api/admin/probe)...");
      const probeRes = await fetch("/api/admin/probe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminKey,
        },
        body: JSON.stringify({ url: testUrl.trim() }),
      });

      let probeData: any = {};
      if (probeRes.ok) {
        probeData = await probeRes.json();
        if (probeData.logs) {
          probeData.logs.forEach((l: string) => logs.push(l));
        }
      } else {
        pushLog(`Backend probe returned HTTP ${probeRes.status}`);
      }

      // Step 2: Test Audio Stream Delivery
      pushLog("Testing client audio stream fetch (/api/youtube/stream)...");
      const streamStart = Date.now();
      const streamRes = await fetch(
        `/api/youtube/stream?url=${encodeURIComponent(testUrl.trim())}`
      );
      const streamElapsed = Date.now() - streamStart;

      const contentType = streamRes.headers.get("content-type") || "";
      const contentLength = streamRes.headers.get("content-length") || "unknown";
      pushLog(
        `Stream response: HTTP ${streamRes.status} (${streamElapsed}ms), Content-Type: ${contentType}`
      );

      if (!streamRes.ok) {
        const errText = await streamRes.text();
        pushLog(`Stream request failed: ${errText.slice(0, 300)}`);
        setProbeResult({
          success: false,
          logs,
          streamTest: {
            status: streamRes.status,
            contentType,
            contentLength,
            bytesReceived: 0,
            decodeSuccess: false,
            error: errText.slice(0, 300),
          },
          raw: probeData,
        });
        return;
      }

      // Read initial audio bytes
      pushLog("Reading audio stream buffer into client memory...");
      const audioBlob = await streamRes.blob();
      pushLog(`Received ${Math.round(audioBlob.size / 1024)} KB payload.`);

      // Test Web Audio decode
      pushLog("Testing Web Audio API decodeAudioData()...");
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      let decodeSuccess = false;
      let duration: number | undefined;

      try {
        const arrayBuffer = await audioBlob.arrayBuffer();
        const decoded = await ctx.decodeAudioData(arrayBuffer);
        decodeSuccess = true;
        duration = decoded.duration;
        pushLog(
          `✓ Audio decoded successfully! Duration: ${Math.round(decoded.duration)}s, Channels: ${decoded.numberOfChannels}, SampleRate: ${decoded.sampleRate}Hz`
        );
      } catch (decodeErr: any) {
        pushLog(`✕ decodeAudioData failed: ${decodeErr?.message}`);
      } finally {
        ctx.close();
      }

      setProbeResult({
        success: decodeSuccess,
        videoId: probeData.videoId,
        totalTimeMs: Date.now() - streamStart,
        logs,
        streamTest: {
          status: streamRes.status,
          contentType,
          contentLength,
          bytesReceived: audioBlob.size,
          decodeSuccess,
          duration,
        },
        raw: probeData,
      });
    } catch (err: any) {
      pushLog(`✕ Fatal Probe Error: ${err?.message}`);
      setProbeResult({
        success: false,
        logs,
      });
    } finally {
      setIsProbing(false);
    }
  };

  const handleDownloadDump = () => {
    const dump = {
      timestamp: new Date().toISOString(),
      backendData,
      backendLatency,
      audioCtxDetails,
      storageStats,
      invidiousPings,
      recentLogs: allLogs,
    };
    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sphere8d-telemetry-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-3">
            <span className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Activity className="w-6 h-6" />
            </span>
            Studio Control & Telemetry Suite
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time backend metrics, Invidious instance resilience, extraction lab, and DSP audit.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={checkHealth}
            disabled={isHealthRefreshing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-xs font-semibold text-slate-300 hover:text-white transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isHealthRefreshing ? "animate-spin" : ""}`} />
            <span>Refresh Health</span>
          </button>
          <button
            onClick={handleDownloadDump}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-xs font-semibold text-cyan-300 transition-all hover:scale-[1.02]"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Dump</span>
          </button>
        </div>
      </div>

      {/* Tabs bar */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar border-b border-slate-800/80 pb-2">
        {[
          { id: "infrastructure", label: "Infrastructure & Health", icon: Server },
          { id: "invidious", label: "Invidious Pool Matrix", icon: Globe },
          { id: "youtube-lab", label: "YouTube Extraction Lab", icon: Play },
          { id: "client-dsp", label: "Client DSP & Storage", icon: Cpu },
          { id: "terminal", label: "System Debug Logs", icon: Terminal },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                isActive
                  ? "bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border border-cyan-500/40 shadow-lg shadow-cyan-500/10"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── TAB 1: INFRASTRUCTURE & BACKEND HEALTH ────────────────────────────────────── */}
      {activeTab === "infrastructure" && (
        <div className="space-y-6">
          {/* Target selector */}
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-slate-300 font-semibold">
              <Sliders className="w-4 h-4 text-cyan-400" />
              <span>Target Backend Endpoint:</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {BACKEND_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setSelectedBackend(opt.id)}
                  className={`px-3 py-1.5 rounded-xl transition-all font-mono text-[11px] ${
                    selectedBackend === opt.id
                      ? "bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  {opt.label.split(" (")[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Status card */}
            <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">Backend Status</span>
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    backendStatus === "healthy"
                      ? "bg-emerald-400 animate-pulse"
                      : backendStatus === "checking"
                      ? "bg-amber-400 animate-spin"
                      : "bg-rose-500"
                  }`}
                />
              </div>
              <div className="text-xl font-extrabold text-white capitalize">{backendStatus}</div>
              <div className="text-[11px] text-slate-400 font-mono">
                Round-trip RTT: {backendLatency !== null ? `${backendLatency}ms` : "--"}
              </div>
            </div>

            {/* Memory Card */}
            <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">Memory Usage (RSS)</span>
                <Gauge className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-xl font-extrabold text-white">
                {backendData?.memory?.rssMb ? `${backendData.memory.rssMb} MB` : "N/A"}
              </div>
              <div className="text-[11px] text-slate-400 font-mono">
                Heap: {backendData?.memory?.heapUsedMb || 0} / {backendData?.memory?.heapTotalMb || 0} MB
              </div>
            </div>

            {/* Platform & Uptime */}
            <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">Uptime & Node</span>
                <Clock className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-xl font-extrabold text-white">
                {backendData?.uptime
                  ? `${Math.floor(backendData.uptime / 3600)}h ${Math.floor((backendData.uptime % 3600) / 60)}m`
                  : "N/A"}
              </div>
              <div className="text-[11px] text-slate-400 font-mono">
                Node: {backendData?.nodeVersion || "N/A"} ({backendData?.platform || "cloud"})
              </div>
            </div>

            {/* yt-dlp & Invidious Pool */}
            <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">yt-dlp & Invidious</span>
                <Globe className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-xl font-extrabold text-white">
                {backendData?.invidious?.totalInstances || 12} Nodes
              </div>
              <div className="text-[11px] text-slate-400 font-mono">
                Cookies: {backendData?.ytDlp?.hasCookies ? "Active" : "None"} • Proxy:{" "}
                {backendData?.ytDlp?.hasProxy ? "Configured" : "Direct"}
              </div>
            </div>
          </div>

          {/* Details Table */}
          <div className="p-6 rounded-3xl bg-slate-900/40 border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Server className="w-4 h-4 text-cyan-400" />
              <span>Full Environment Specs</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                <span className="text-slate-400">Service Identifier:</span>
                <p className="text-slate-200 font-bold">{backendData?.service || "8d-audio-backend"}</p>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                <span className="text-slate-400">yt-dlp Binary Path:</span>
                <p className="text-slate-200 font-bold break-all">{backendData?.ytDlp?.binary || "yt-dlp (PATH)"}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: INVIDIOUS POOL MATRIX ────────────────────────────────────────── */}
      {activeTab === "invidious" && (
        <div className="space-y-6">
          <div className="p-5 rounded-3xl bg-slate-900/40 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Globe className="w-5 h-5 text-cyan-400" />
                Live Invidious Instance Pool ({backendData?.invidious?.instances?.length || 12} Instances)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Dynamic public instance cluster used to race audio metadata extraction in parallel.
              </p>
            </div>
            <button
              onClick={pingInvidiousPool}
              disabled={isPingingPool}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-all shadow-md shadow-cyan-500/20 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isPingingPool ? "animate-spin" : ""}`} />
              <span>{isPingingPool ? "Pinging Instances..." : "Ping All Instances"}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {(
              backendData?.invidious?.instances || [
                "inv.tux.pizza",
                "invidious.drgns.space",
                "invidious.asir.dev",
                "yewtu.be",
                "invidious.lunar.icu",
                "invidious.private.coffee",
                "invidious.jing.rocks",
                "invidious.privacydev.net",
                "iv.melmac.space",
                "yt.chocolatemoo53.com",
                "invidious.nerdvpn.de",
                "inv.nadeko.net",
              ]
            ).map((inst) => {
              const ping = invidiousPings[inst];
              return (
                <div
                  key={inst}
                  className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="font-mono text-xs font-semibold text-slate-200 truncate">
                      {inst}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {ping ? (
                        ping.ok ? (
                          <span className="text-emerald-400">HTTP {ping.status} • {ping.latency}ms</span>
                        ) : (
                          <span className="text-rose-400">Failed / Blocked</span>
                        )
                      ) : (
                        "Ready for race"
                      )}
                    </div>
                  </div>
                  <div
                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                      ping ? (ping.ok ? "bg-emerald-400" : "bg-rose-500") : "bg-slate-600"
                    }`}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── TAB 3: YOUTUBE EXTRACTION LAB ───────────────────────────────────────── */}
      {activeTab === "youtube-lab" && (
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-slate-900/40 border border-slate-800 space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Play className="w-5 h-5 text-cyan-400" />
              Live YouTube Audio Stream & Decoding Probe
            </h2>
            <p className="text-xs text-slate-400">
              Performs an end-to-end extraction test: validates video ID, tests Invidious parallel race, executes yt-dlp extractor with Android client fallback, and decodes the stream waveform in Web Audio API.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={testUrl}
                onChange={(e) => setTestUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="flex-1 px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500/60"
              />
              <button
                onClick={handleRunProbe}
                disabled={isProbing || !testUrl.trim()}
                className="px-5 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-50 flex items-center justify-center gap-2 shrink-0"
              >
                {isProbing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                <span>{isProbing ? "Probing Stream..." : "Run Extraction Probe"}</span>
              </button>
            </div>
          </div>

          {/* Probe Results Box */}
          {probeResult && (
            <div className="p-6 rounded-3xl bg-slate-900/40 border border-slate-800 space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  {probeResult.success ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-rose-400" />
                  )}
                  <span>
                    Extraction Status: {probeResult.success ? "SUCCESSFUL" : "FAILED"} (
                    {probeResult.totalTimeMs || 0}ms)
                  </span>
                </h3>
              </div>

              {/* Execution log step feed */}
              <div className="p-4 rounded-2xl bg-black/60 border border-slate-800 font-mono text-xs text-slate-300 space-y-1.5 max-h-80 overflow-y-auto">
                {probeResult.logs.map((log, idx) => (
                  <div
                    key={idx}
                    className={`leading-relaxed ${
                      log.includes("✓")
                        ? "text-emerald-300"
                        : log.includes("✕") || log.includes("failed")
                        ? "text-rose-300"
                        : "text-slate-300"
                    }`}
                  >
                    {log}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 4: CLIENT DSP & STORAGE AUDITOR ─────────────────────────────────── */}
      {activeTab === "client-dsp" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* AudioContext Spec Card */}
            <div className="p-6 rounded-3xl bg-slate-900/40 border border-slate-800 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Cpu className="w-4 h-4 text-cyan-400" />
                <span>Web Audio Context Capabilities</span>
              </h3>
              <div className="space-y-2.5 font-mono text-xs">
                <div className="flex justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-slate-400">Context State:</span>
                  <span className="text-emerald-400 font-bold">{audioCtxDetails?.state || "Unknown"}</span>
                </div>
                <div className="flex justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-slate-400">Sample Rate:</span>
                  <span className="text-slate-200 font-bold">{audioCtxDetails?.sampleRate || 44100} Hz</span>
                </div>
                <div className="flex justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-slate-400">Hardware Concurrency:</span>
                  <span className="text-cyan-400 font-bold">{audioCtxDetails?.hardwareConcurrency || 4} Cores</span>
                </div>
                <div className="flex justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-slate-400">HRTF Panning Model:</span>
                  <span className="text-purple-400 font-bold">
                    {audioCtxDetails?.hrtfSupported ? "Supported" : "Unsupported"}
                  </span>
                </div>
              </div>
            </div>

            {/* Offline Storage Quota Card */}
            <div className="p-6 rounded-3xl bg-slate-900/40 border border-slate-800 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Database className="w-4 h-4 text-purple-400" />
                <span>Browser Storage & IndexedDB</span>
              </h3>
              <div className="space-y-2.5 font-mono text-xs">
                <div className="flex justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-slate-400">IndexedDB Engine:</span>
                  <span className="text-slate-200 font-bold">idb / localforage</span>
                </div>
                <div className="flex justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-slate-400">Storage Used:</span>
                  <span className="text-purple-400 font-bold">{storageStats?.usageMb || 0} MB</span>
                </div>
                <div className="flex justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-slate-400">Available Quota:</span>
                  <span className="text-slate-200 font-bold">{storageStats?.quotaMb || 0} MB</span>
                </div>
              </div>

              {/* DSP Benchmark action */}
              <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-200">Offline DSP Benchmark</div>
                  <div className="text-[10px] text-slate-400">
                    {dspBenchSpeed ? `Speed: ${dspBenchSpeed}x realtime` : "Measure 8D rendering speed"}
                  </div>
                </div>
                <button
                  onClick={runDspBenchmark}
                  disabled={isBenchmarking}
                  className="px-3 py-1.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-300 font-semibold text-xs transition-all disabled:opacity-50"
                >
                  {isBenchmarking ? "Running..." : "Test Speed"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 5: SYSTEM DEBUG LOGS ────────────────────────────────────────────── */}
      {activeTab === "terminal" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Terminal className="w-5 h-5 text-cyan-400" />
              <span>Real-Time Client & DSP Telemetry Feed</span>
            </h2>
            <button
              onClick={() => clientLogger.clear()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-rose-400 hover:bg-slate-800 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Buffer</span>
            </button>
          </div>

          <div className="p-4 rounded-3xl bg-black/80 border border-slate-800 font-mono text-xs max-h-[500px] overflow-y-auto space-y-2">
            {allLogs.length === 0 ? (
              <div className="text-slate-500 text-center py-12">No telemetry logs recorded in this session.</div>
            ) : (
              allLogs.map((l) => (
                <div
                  key={l.id}
                  className={`p-2 rounded-lg border ${
                    l.level === "error"
                      ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
                      : l.level === "warn"
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                      : l.level === "success"
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                      : "bg-slate-900/60 border-slate-800 text-slate-300"
                  }`}
                >
                  <span className="text-slate-500 mr-2">[{new Date(l.timestamp).toLocaleTimeString()}]</span>
                  <span className="font-bold mr-2 uppercase text-[10px]">[{l.tag}]</span>
                  <span>{l.message}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
