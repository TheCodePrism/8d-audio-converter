/* eslint-disable react-hooks/exhaustive-deps, react/no-unescaped-entities */
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Activity,
  Server,
  Cpu,
  Layers,
  HelpCircle,
  Play,
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
} from "lucide-react";

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
  invidiousResult?: {
    instance: string;
    itag: string | number;
    type: string;
    title: string;
    author: string;
    duration: string | number;
    proxyUrl: string;
  };
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
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<
    "diagnostics" | "architecture" | "backend" | "client-dsp" | "faq"
  >("diagnostics");

  // YouTube Diagnostic state
  const [testUrl, setTestUrl] = useState("https://www.youtube.com/watch?v=CKVr4PejT3s");
  const [isProbing, setIsProbing] = useState(false);
  const [probeResult, setProbeResult] = useState<ProbeResult | null>(null);

  // Backend Health state
  const [backendStatus, setBackendStatus] = useState<string>("checking");
  const [backendLatency, setBackendLatency] = useState<number | null>(null);
  const [backendData, setBackendData] = useState<BackendHealth | null>(null);
  const [selectedBackend, setSelectedBackend] = useState<string>("auto");

  // Client Web Audio DSP state
  const [audioCtxDetails, setAudioCtxDetails] = useState<{
    state: string;
    sampleRate: number;
    channels: number;
    maxChannels: number;
    hrtfSupported: boolean;
    hardwareConcurrency: number;
  } | null>(null);

  // Check Backend Health
  const checkHealth = async () => {
    setBackendStatus("checking");
    const startTime = Date.now();
    try {
      const url =
        selectedBackend === "local"
          ? "http://localhost:3001/health"
          : selectedBackend === "render"
          ? "https://8d-audio-backend.onrender.com/health"
          : "/api/health";

      const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
      const latency = Date.now() - startTime;
      setBackendLatency(latency);

      if (res.ok) {
        const data = await res.json();
        // If fetched via Next.js proxy (/api/health), details is in data.details
        const actualDetails = data.details || data;
        setBackendData(actualDetails);
        setBackendStatus("healthy");
      } else {
        setBackendStatus("error");
      }
    } catch (err) {
      setBackendLatency(Date.now() - startTime);
      setBackendStatus("unreachable");
    }
  };

  useEffect(() => {
    checkHealth();
  }, [selectedBackend]);

  // Inspect Client Web Audio
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
      console.warn("Client Web Audio inspection error:", e);
    }
  }, []);

  // Run YouTube Diagnostic Probe
  const handleRunProbe = async () => {
    if (!testUrl.trim()) return;
    setIsProbing(true);
    setProbeResult(null);

    const logs: string[] = [];
    const pushLog = (msg: string) => logs.push(`[${new Date().toLocaleTimeString()}] ${msg}`);

    pushLog(`Starting live extraction probe for: ${testUrl}`);

    try {
      // Step 1: Probe Backend Invidious / Info API
      pushLog("Querying server-side extraction engine (/api/admin/probe)...");
      const probeRes = await fetch("/api/admin/probe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
        totalTimeMs: probeData.totalTimeMs,
        invidiousResult: probeData.invidiousResult,
        logs,
        streamTest: {
          status: streamRes.status,
          contentType,
          contentLength,
          bytesReceived: audioBlob.size,
          decodeSuccess,
          duration,
        },
      });
    } catch (err: any) {
      pushLog(`Fatal diagnostic error: ${err?.message}`);
      setProbeResult({
        success: false,
        logs,
        streamTest: {
          status: 500,
          contentType: "",
          contentLength: "",
          bytesReceived: 0,
          decodeSuccess: false,
          error: err?.message,
        },
      });
    } finally {
      setIsProbing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                  <Activity className="w-5 h-5" />
                </span>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                  System Observability & Diagnostics
                  <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                    ADMIN
                  </span>
                </h1>
              </div>
              <p className="text-xs sm:text-sm text-slate-400">
                Complete system observability answering every <strong>Why</strong>,{" "}
                <strong>Where</strong>, <strong>How</strong>, and <strong>When</strong> behind the 8D/16D audio engine.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800">
                <span
                  className={`w-2 h-2 rounded-full ${
                    backendStatus === "healthy"
                      ? "bg-emerald-400 animate-ping"
                      : backendStatus === "checking"
                      ? "bg-amber-400 animate-pulse"
                      : "bg-red-400"
                  }`}
                />
                <span className="text-xs font-mono">
                  {backendStatus === "healthy"
                    ? `Backend Online (${backendLatency}ms)`
                    : backendStatus === "checking"
                    ? "Checking..."
                    : "Backend Offline"}
                </span>
              </div>

              <Link
                href="/"
                className="px-3.5 py-2 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white text-xs font-semibold rounded-xl shadow-md transition-all flex items-center gap-1.5"
              >
                <Radio className="w-3.5 h-3.5" />
                <span>Return to Studio</span>
              </Link>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 mt-6 border-b border-slate-800 pb-1 overflow-x-auto no-scrollbar">
            {[
              { id: "diagnostics", label: "YouTube Extraction Probe", icon: Search },
              { id: "faq", label: "The 'Why, Where, How, When'", icon: HelpCircle },
              { id: "architecture", label: "Engine Architecture Map", icon: Layers },
              { id: "backend", label: "Backend & Invidious Pool", icon: Server },
              { id: "client-dsp", label: "Client Web Audio DSP", icon: Cpu },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-2 px-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap ${
                    activeTab === tab.id
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* TAB 1: YOUTUBE EXTRACTION DIAGNOSTIC PROBE */}
        {activeTab === "diagnostics" && (
          <div className="space-y-6">
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl backdrop-blur-xl space-y-5">
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-cyan-400" />
                  <span>Live YouTube Stream Extraction Tester</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Test any YouTube video URL through the multi-layer proxy chain. Inspects response headers, Invidious mirrors, byte stream chunks, and client Web Audio decode capability.
                </p>
              </div>

              {/* URL Input Form */}
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={testUrl}
                  onChange={(e) => setTestUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="flex-1 bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-4 py-2.5 text-xs font-mono text-slate-200 outline-none transition-all"
                />
                <button
                  type="button"
                  disabled={isProbing}
                  onClick={handleRunProbe}
                  className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 transition-all"
                >
                  {isProbing ? (
                    <RotateCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  <span>{isProbing ? "Running Diagnostics..." : "Run Test Probe"}</span>
                </button>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="text-[11px] font-mono">Quick test presets:</span>
                <button
                  type="button"
                  onClick={() => setTestUrl("https://www.youtube.com/watch?v=CKVr4PejT3s")}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px]"
                >
                  Roothi Diwali (CKVr4PejT3s)
                </button>
                <button
                  type="button"
                  onClick={() => setTestUrl("https://www.youtube.com/watch?v=jfKfPfyJRdk")}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px]"
                >
                  Lofi Girl (jfKfPfyJRdk)
                </button>
              </div>

              {/* Probe Result Cards */}
              {probeResult && (
                <div className="space-y-4 pt-4 border-t border-slate-800">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                      <span className="text-[10px] font-mono uppercase text-slate-500">
                        Probe Status
                      </span>
                      <div className="flex items-center gap-1.5">
                        {probeResult.success ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-red-400" />
                        )}
                        <span
                          className={`text-sm font-bold ${
                            probeResult.success ? "text-emerald-400" : "text-red-400"
                          }`}
                        >
                          {probeResult.success ? "SUCCESS" : "FAILED"}
                        </span>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                      <span className="text-[10px] font-mono uppercase text-slate-500">
                        Invidious Proxy
                      </span>
                      <div className="text-sm font-semibold text-cyan-300 truncate">
                        {probeResult.invidiousResult?.instance || "Fallback Mode"}
                      </div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                      <span className="text-[10px] font-mono uppercase text-slate-500">
                        Payload Size
                      </span>
                      <div className="text-sm font-semibold text-slate-200">
                        {probeResult.streamTest?.bytesReceived
                          ? `${Math.round(probeResult.streamTest.bytesReceived / 1024)} KB`
                          : "0 KB"}
                      </div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                      <span className="text-[10px] font-mono uppercase text-slate-500">
                        Web Audio Decode
                      </span>
                      <div className="text-sm font-semibold text-purple-300">
                        {probeResult.streamTest?.decodeSuccess
                          ? `✓ Decoded (${Math.round(probeResult.streamTest.duration || 0)}s)`
                          : "✕ Not Decoded"}
                      </div>
                    </div>
                  </div>

                  {/* Trace Output Console */}
                  <div className="space-y-2">
                    <span className="text-xs font-mono text-slate-400 flex items-center gap-1">
                      <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Live Diagnostic Trace:</span>
                    </span>
                    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 font-mono text-xs text-slate-300 max-h-72 overflow-y-auto space-y-1 custom-scrollbar">
                      {probeResult.logs.map((line, idx) => (
                        <div
                          key={idx}
                          className={`${
                            line.includes("✓")
                              ? "text-emerald-400"
                              : line.includes("✕") || line.includes("failed") || line.includes("error")
                              ? "text-red-400"
                              : "text-slate-300"
                          }`}
                        >
                          {line}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: THE "WHY, WHERE, HOW, WHEN" GUIDE */}
        {activeTab === "faq" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Card 1: WHY */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                  <span className="px-2.5 py-1 rounded-xl bg-cyan-500/10 text-cyan-300 font-bold font-mono text-sm border border-cyan-500/30">
                    WHY
                  </span>
                  <h3 className="font-bold text-white text-base">
                    Why do YouTube videos work locally but sometimes fail on Render?
                  </h3>
                </div>
                <div className="text-xs text-slate-300 space-y-2 leading-relaxed">
                  <p>
                    <strong>1. Datacenter IP Reputation:</strong> When running on your local laptop, your ISP assigns a residential IP address. YouTube rarely challenges residential IPs. However, cloud platforms like Render, AWS, and DigitalOcean use datacenter IP blocks. YouTube aggressively challenges datacenter IPs with bot-detection walls, returning:
                  </p>
                  <code className="block p-2 rounded-lg bg-slate-950 text-red-300 text-[11px] font-mono border border-red-950">
                    ERROR: Failed to extract any player response; confirm you are on latest yt-dlp
                  </code>
                  <p>
                    <strong>2. The Multi-Layer Solution:</strong> We implemented a resilient multi-tier bypass:
                  </p>
                  <ul className="list-disc pl-4 space-y-1 text-slate-400">
                    <li>
                      <strong>Primary:</strong> Decentralized Invidious instance mesh (`yt.chocolatemoo53.com`, `invidious.nerdvpn.de`, `inv.tux.pizza`). Invidious acts as an intermediate non-datacenter proxy.
                    </li>
                    <li>
                      <strong>Secondary:</strong> Secret Netscape Cookies (`cookies.txt` or `YOUTUBE_COOKIES`), which authenticate requests with a trusted Google session cookie.
                    </li>
                    <li>
                      <strong>Fallback:</strong> TV Samsung & VisionOS client spoofing.
                    </li>
                  </ul>
                </div>
              </div>

              {/* Card 2: WHERE */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                  <span className="px-2.5 py-1 rounded-xl bg-purple-500/10 text-purple-300 font-bold font-mono text-sm border border-purple-500/30">
                    WHERE
                  </span>
                  <h3 className="font-bold text-white text-base">
                    Where is the music converted and stored?
                  </h3>
                </div>
                <div className="text-xs text-slate-300 space-y-2 leading-relaxed">
                  <p>
                    <strong>100% Client-Side In-Browser Computation:</strong>
                  </p>
                  <p>
                    Many audio converters upload your private files to a remote server. Our architecture is radically different:
                  </p>
                  <ul className="list-disc pl-4 space-y-1 text-slate-400">
                    <li>
                      <strong>Uploaded Local Files:</strong> Never touch any server. They are decoded directly by your phone or computer CPU via the Web Audio API.
                    </li>
                    <li>
                      <strong>YouTube Streams:</strong> The Render backend only acts as a dumb stream byte pipe (relaying raw audio chunks).
                    </li>
                    <li>
                      <strong>8D/16D Spatial DSP:</strong> The HRTF binaural convolution, 3D orbit simulation, Haas delay, and master limiting execute <strong>entirely in your browser</strong> using hardware-accelerated Web Audio nodes.
                    </li>
                    <li>
                      <strong>Output WAV Files:</strong> Generated in memory using zero-copy `Int16Array` buffers and saved directly to your local download directory.
                    </li>
                  </ul>
                </div>
              </div>

              {/* Card 3: HOW */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                  <span className="px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-300 font-bold font-mono text-sm border border-emerald-500/30">
                    HOW
                  </span>
                  <h3 className="font-bold text-white text-base">
                    How does the 16D Helical 3D Spatial Algorithm work?
                  </h3>
                </div>
                <div className="text-xs text-slate-300 space-y-2 leading-relaxed">
                  <p>
                    Unlike primitive stereo panning that just pans Left/Right, our spatial engine implements:
                  </p>
                  <ul className="list-disc pl-4 space-y-1 text-slate-400">
                    <li>
                      <strong>Lissajous 3D Helical Elevation:</strong> The sound traverses an organic orbit around the head:
                      <code className="block my-1 p-1.5 bg-slate-950 text-cyan-300 rounded font-mono text-[10px]">
                        x = radius · cos(θ), z = radius · sin(θ), y = 0.95 · sin(2θ)
                      </code>
                      This lifts the sound above your head at the front and dips it below the chin at the rear.
                    </li>
                    <li>
                      <strong>Phantom Center Vocal Anchor:</strong> Dedicated center gain (`centerAnchor`) routes lead vocals and kick drums through a non-orbiting center channel, eliminating vocal dizziness.
                    </li>
                    <li>
                      <strong>Doppler & Pinna Filtering:</strong> Dynamic Biquad low-pass filtering softens highs when the audio is behind the listener, mimicking human ear cartilage reflection.
                    </li>
                  </ul>
                </div>
              </div>

              {/* Card 4: WHEN */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                  <span className="px-2.5 py-1 rounded-xl bg-amber-500/10 text-amber-300 font-bold font-mono text-sm border border-amber-500/30">
                    WHEN
                  </span>
                  <h3 className="font-bold text-white text-base">
                    When does the background queue process and retry?
                  </h3>
                </div>
                <div className="text-xs text-slate-300 space-y-2 leading-relaxed">
                  <p>
                    <strong>Non-Blocking Asynchronous Queue Runner:</strong>
                  </p>
                  <ul className="list-disc pl-4 space-y-1 text-slate-400">
                    <li>
                      <strong>Instant Visibility:</strong> When you import a playlist (e.g. 20 tracks), all 20 appear in the queue immediately as <em>Pending</em>. You can play already-converted tracks while the rest convert.
                    </li>
                    <li>
                      <strong>Single-Track Worker:</strong> To avoid crashing mobile browsers with out-of-memory errors, the worker executes one track at a time.
                    </li>
                    <li>
                      <strong>Instant Retry:</strong> If a track encounters a network timeout or cold start, click <strong>"Retry"</strong> to reset its status to <em>Pending</em>. The worker automatically picks it back up.
                    </li>
                    <li>
                      <strong>Render Cold Starts:</strong> Free-tier Render instances spin down after 15 minutes. The first request may take 30-40 seconds to wake up the backend.
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: ENGINE ARCHITECTURE MAP */}
        {activeTab === "architecture" && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                <span>Full System Architecture & Data Flow</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Visual boundary separation between Server Network Relay and Browser Web Audio DSP.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Stage 1 */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                    STAGE 1: INGESTION
                  </span>
                  <Database className="w-4 h-4 text-cyan-400" />
                </div>
                <h4 className="text-sm font-bold text-white">Audio Ingestion & Relay</h4>
                <p className="text-xs text-slate-400">
                  User uploads files or pastes YouTube URLs. YouTube requests are resolved via Invidious mesh to bypass datacenter IP restrictions.
                </p>
                <div className="p-2.5 rounded-xl bg-slate-900 text-[11px] font-mono text-cyan-300 space-y-1">
                  <div>• HTTP 307 direct redirect (0s Vercel timeout)</div>
                  <div>• Invidious fallback chain</div>
                  <div>• Zero-storage pass-through</div>
                </div>
              </div>

              {/* Stage 2 */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-cyan-500/40 space-y-3 ring-1 ring-cyan-500/20">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/30">
                    STAGE 2: BROWSER DSP
                  </span>
                  <Cpu className="w-4 h-4 text-purple-400" />
                </div>
                <h4 className="text-sm font-bold text-white">16D Web Audio Engine</h4>
                <p className="text-xs text-slate-400">
                  Executes inside the client's browser. Decodes raw audio into IEEE float32 buffers and passes them through the spatial DSP graph.
                </p>
                <div className="p-2.5 rounded-xl bg-slate-900 text-[11px] font-mono text-purple-300 space-y-1">
                  <div>• Parametric Low-Shelf Bass EQ</div>
                  <div>• 3D Helical Lissajous Panner</div>
                  <div>• Phantom Center Vocal Anchor</div>
                  <div>• Abbey Road Synthetic Reverb</div>
                  <div>• Master Dynamics Limiter</div>
                </div>
              </div>

              {/* Stage 3 */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                    STAGE 3: PLAYBACK & EXPORT
                  </span>
                  <Volume2 className="w-4 h-4 text-emerald-400" />
                </div>
                <h4 className="text-sm font-bold text-white">Binaural Deck & WAV Export</h4>
                <p className="text-xs text-slate-400">
                  Plays in real-time through headphones with 360° radar visualizer, or renders to lossless 16-bit 44.1kHz master WAV files.
                </p>
                <div className="p-2.5 rounded-xl bg-slate-900 text-[11px] font-mono text-emerald-300 space-y-1">
                  <div>• Direct Int16Array WAV compiler</div>
                  <div>• A/B Real-time bypass switch</div>
                  <div>• Autoplay & shuffle playlist queue</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: BACKEND & INVIDIOUS POOL */}
        {activeTab === "backend" && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <Server className="w-4 h-4 text-cyan-400" />
                  <span>Backend Infrastructure & Invidious Pool</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Live status of the yt-dlp binary, cookie auth, and active Invidious proxy nodes.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={selectedBackend}
                  onChange={(e) => setSelectedBackend(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-xs rounded-xl px-3 py-1.5 font-mono text-slate-200 outline-none"
                >
                  <option value="auto">Auto (Configured Backend)</option>
                  <option value="local">Local (localhost:3001)</option>
                  <option value="render">Live Render Backend</option>
                </select>

                <button
                  type="button"
                  onClick={checkHealth}
                  className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300 hover:text-white transition-all"
                  title="Refresh status"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Backend Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-[10px] font-mono uppercase text-slate-500">Service Status</span>
                <div className="text-sm font-bold text-emerald-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  {backendStatus.toUpperCase()}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-[10px] font-mono uppercase text-slate-500">Ping Latency</span>
                <div className="text-sm font-bold text-cyan-300">
                  {backendLatency !== null ? `${backendLatency} ms` : "---"}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-[10px] font-mono uppercase text-slate-500">Cookie Auth</span>
                <div className="text-sm font-bold text-purple-300">
                  {backendData?.ytDlp?.hasCookies ? "Active (Cookies Loaded)" : "Inactive"}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-[10px] font-mono uppercase text-slate-500">Memory Footprint</span>
                <div className="text-sm font-bold text-slate-200">
                  {backendData?.memory?.rssMb ? `${backendData.memory.rssMb} MB RSS` : "---"}
                </div>
              </div>
            </div>

            {/* Invidious Mirrors List */}
            <div className="space-y-3 pt-3 border-t border-slate-800">
              <h4 className="text-xs font-mono font-semibold text-slate-300 uppercase">
                Active Invidious Instance Pool ({backendData?.invidious?.totalInstances || 7} Mirrors)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {(
                  backendData?.invidious?.instances || [
                    "yt.chocolatemoo53.com",
                    "invidious.nerdvpn.de",
                    "inv.tux.pizza",
                    "invidious.projectsegfau.lt",
                    "invidious.privacyredirect.com",
                    "iv.melmac.space",
                    "invidious.perennialte.ch",
                  ]
                ).map((instance, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between text-xs"
                  >
                    <span className="font-mono text-cyan-300 truncate">{instance}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      Standby
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: CLIENT WEB AUDIO DSP */}
        {activeTab === "client-dsp" && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Cpu className="w-4 h-4 text-purple-400" />
                <span>Client Web Audio DSP Inspector</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Hardware capabilities of your current device browser executing the spatial 8D/16D pipeline.
              </p>
            </div>

            {audioCtxDetails ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-[10px] font-mono uppercase text-slate-500">AudioContext State</span>
                  <div className="text-sm font-bold text-emerald-400">{audioCtxDetails.state}</div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-[10px] font-mono uppercase text-slate-500">Hardware Sample Rate</span>
                  <div className="text-sm font-bold text-cyan-300">
                    {audioCtxDetails.sampleRate.toLocaleString()} Hz
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-[10px] font-mono uppercase text-slate-500">HRTF Binaural Panner</span>
                  <div className="text-sm font-bold text-purple-300">
                    {audioCtxDetails.hrtfSupported ? "✓ Hardware Supported" : "Emulated"}
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-[10px] font-mono uppercase text-slate-500">CPU Logical Cores</span>
                  <div className="text-sm font-bold text-slate-200">
                    {audioCtxDetails.hardwareConcurrency} Cores
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-[10px] font-mono uppercase text-slate-500">Channels</span>
                  <div className="text-sm font-bold text-slate-200">
                    {audioCtxDetails.channels} Stereo Output ({audioCtxDetails.maxChannels} max)
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-[10px] font-mono uppercase text-slate-500">WAV Compiler</span>
                  <div className="text-sm font-bold text-emerald-400">
                    TypedArray Int16 (Zero-Freeze)
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 text-center text-xs text-slate-500">
                Web Audio API not detected in current environment.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
