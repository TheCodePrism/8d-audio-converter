const express = require("express");
const cors = require("cors");
const { execFile, spawn } = require("child_process");
const { promisify } = require("util");
const { existsSync } = require("fs");
const path = require("path");
const { Readable } = require("stream");

const execFileAsync = promisify(execFile);
const app = express();

// ── Invidious Instances (tried in order) ──────────────────────────────────────
// These act as YouTube proxy servers, allowing us to bypass Render's datacenter
// IP block. The /api/v1/videos/:id endpoint returns stream URLs, and
// /videoplayback?... proxies the actual audio bytes through the instance.
const DEFAULT_INVIDIOUS_INSTANCES = [
  "yt.chocolatemoo53.com",
  "invidious.projectsegfau.lt",
  "invidious.drgns.space",
  "invidious.schenkl.is",
  "invidious.f5.si",
  "invidious.protokolla.fi",
  "invidious.jing.rocks",
];

let liveInvidiousInstances = [
  ...(process.env.INVIDIOUS_INSTANCE ? [process.env.INVIDIOUS_INSTANCE.trim()] : []),
  ...(process.env.INVIDIOUS_HOSTS
    ? process.env.INVIDIOUS_HOSTS.split(",").map((s) => s.trim()).filter(Boolean)
    : []),
  ...DEFAULT_INVIDIOUS_INSTANCES,
];

async function refreshInvidiousPool() {
  try {
    const res = await fetch("https://api.invidious.io/instances.json?sort_by=health", {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) {
      const data = await res.json();
      const healthy = data
        .filter(([host, meta]) => meta.type === "https" && meta.api === true && !meta.monitor?.down)
        .map(([host]) => host);
      if (healthy.length > 0) {
        liveInvidiousInstances = Array.from(new Set([...healthy, ...liveInvidiousInstances]));
        console.log(`[Invidious Pool] Live instances synced (${healthy.length} verified live API instances).`);
      }
    }
  } catch (err) {
    // Keep fallback list
  }
}

// Refresh pool every 30 minutes
setInterval(refreshInvidiousPool, 30 * 60 * 1000).unref();

// ── Helper: extract YouTube video ID ─────────────────────────────────────────
function extractVideoId(urlStr) {
  try {
    const parsed = new URL(urlStr);
    if (parsed.hostname === "youtu.be")
      return parsed.pathname.slice(1).split("/")[0].split("?")[0];
    if (parsed.pathname.startsWith("/shorts/"))
      return parsed.pathname.split("/shorts/")[1]?.split("/")[0]?.split("?")[0] || "";
    return parsed.searchParams.get("v") || "";
  } catch {
    return "";
  }
}

// ── Invidious: parallel fastest-success fetch for a videoId ─────────────────────
// Races all Invidious instances in parallel; returns the first one that successfully
// responds with valid audio format streams, immediately aborting the remaining ones.
async function getInvidiousAudioInfo(videoId) {
  const controller = new AbortController();
  const overallTimeout = setTimeout(() => controller.abort(), 12000);

  const fetchInstance = async (instance) => {
    const apiUrl = `https://${instance}/api/v1/videos/${videoId}`;
    const start = Date.now();
    try {
      const apiRes = await fetch(apiUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        },
      });
      if (!apiRes.ok) {
        throw new Error(`${instance} returned HTTP ${apiRes.status} (${Date.now() - start}ms)`);
      }
      const data = await apiRes.json();
      if (data.error) {
        throw new Error(`${instance} returned error: ${data.error} (${Date.now() - start}ms)`);
      }

      const formats = data.adaptiveFormats || [];
      // Prefer itag 140 (m4a 128kbps), then 251 (opus), then any audio format
      const preferredItags = ["140", "251", "250", "249", "139"];
      let audio = preferredItags
        .map((itag) => formats.find((f) => String(f.itag) === itag && f.url))
        .find(Boolean);
      if (!audio) {
        audio = formats.find((f) => f.type?.startsWith("audio/") && f.url);
      }
      if (!audio?.url) {
        throw new Error(`${instance} has no usable audio format (${Date.now() - start}ms)`);
      }

      const audioUrl = new URL(audio.url);
      const proxyUrl = `https://${instance}/videoplayback${audioUrl.search}`;
      const contentType = audio.type?.split(";")[0] || "audio/mp4";

      return {
        proxyUrl,
        contentType,
        instance,
        itag: audio.itag,
        elapsedMs: Date.now() - start,
      };
    } catch (err) {
      if (err.name === "AbortError") {
        throw err;
      }
      throw err;
    }
  };

  const pool = liveInvidiousInstances.slice(0, 10);
  try {
    console.log(`[Invidious] Racing ${pool.length} instances in parallel for videoId=${videoId}...`);
    const winner = await Promise.any(pool.map((instance) => fetchInstance(instance)));
    clearTimeout(overallTimeout);
    controller.abort(); // Cancel all slower in-flight requests immediately

    console.log(
      `[Invidious] ✓ Fastest instance won: ${winner.instance} in ${winner.elapsedMs}ms (itag=${winner.itag}, type=${winner.contentType})`
    );
    return winner;
  } catch (err) {
    clearTimeout(overallTimeout);
    console.warn(`[Invidious] All parallel instances failed or timed out for videoId=${videoId}.`);
    return null;
  }
}

// ── Invidious: pipe proxied audio stream to Express response ──────────────────
async function pipeInvidiousStream(proxyUrl, instance, contentType, req, res) {
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    Referer: `https://${instance}/`,
  };
  if (req.headers.range) {
    headers["Range"] = req.headers.range;
  }

  const streamRes = await fetch(proxyUrl, {
    redirect: "follow",
    headers,
    signal: AbortSignal.timeout(30000),
  });

  if (streamRes.status !== 200 && streamRes.status !== 206) {
    throw new Error(`Invidious stream returned HTTP ${streamRes.status}`);
  }

  const resType = streamRes.headers.get("content-type") || "";
  if (
    !resType.includes("audio") &&
    !resType.includes("video") &&
    !resType.includes("octet-stream")
  ) {
    throw new Error(`Invidious stream returned non-audio Content-Type: ${resType}`);
  }

  res.setHeader("Content-Type", resType || contentType || "audio/mp4");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Access-Control-Allow-Origin", "*");
  const cl = streamRes.headers.get("content-length");
  if (cl) res.setHeader("Content-Length", cl);
  const cr = streamRes.headers.get("content-range");
  if (cr) res.setHeader("Content-Range", cr);

  res.status(streamRes.status);

  const nodeStream = Readable.fromWeb(streamRes.body);
  nodeStream.pipe(res);

  return new Promise((resolve, reject) => {
    nodeStream.on("end", () => resolve(true));
    nodeStream.on("error", (err) => {
      console.error("[Invidious Stream Error]:", err);
      reject(err);
    });
    req.on("close", () => {
      nodeStream.destroy();
    });
  });
}

app.use(cors());
app.use(express.json());

// ── Resolve yt-dlp binary ─────────────────────────────────────────────────────
function getYtDlpPath() {
  const candidates = [
    path.join(__dirname, "..", "bin", "yt-dlp.exe"),
    path.join(__dirname, "..", "bin", "yt-dlp"),
    path.join(process.cwd(), "bin", "yt-dlp.exe"),
    path.join(process.cwd(), "bin", "yt-dlp"),
    "/usr/local/bin/yt-dlp",
    "/usr/bin/yt-dlp",
    "yt-dlp.exe",
    "yt-dlp",
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return "yt-dlp"; // fallback: rely on PATH
}

// ── Cookie file handling (bypasses YouTube datacenter bot wall) ───────────────
function getCookieArgs() {
  // 1. Check local file or Render Secret File mount (/etc/secrets/cookies.txt)
  const candidateFiles = [
    path.join(process.cwd(), "cookies.txt"),
    "/etc/secrets/cookies.txt",
    "/etc/secrets/yt_cookies.txt",
  ];
  for (const filePath of candidateFiles) {
    if (existsSync(filePath)) {
      console.log(`[YouTube Auth] Using cookies from disk file: ${filePath}`);
      return ["--cookies", filePath];
    }
  }

  // 2. Check environment variables (YOUTUBE_COOKIES, COOKIES, YT_COOKIES)
  const envCookie =
    process.env.YOUTUBE_COOKIES ||
    process.env.COOKIES ||
    process.env.YT_COOKIES;

  if (envCookie) {
    const tmpCookies = path.join(process.env.TEMP || "/tmp", "yt_cookies.txt");
    try {
      let raw = envCookie.trim();
      // Strip outer quotes if pasted with quotes
      if (
        (raw.startsWith('"') && raw.endsWith('"')) ||
        (raw.startsWith("'") && raw.endsWith("'"))
      ) {
        raw = raw.slice(1, -1);
      }

      // Support base64 encoded cookies.txt
      if (raw.startsWith("I05ldHNjYXBl")) {
        try {
          raw = Buffer.from(raw, "base64").toString("utf8");
        } catch {}
      }

      // Handle literal escaped newlines (\n) from env var entry
      const cookieData =
        raw.includes("\\n") && !raw.includes("\n")
          ? raw.replace(/\\n/g, "\n")
          : raw;

      // Only pass cookies if it contains legitimate Netscape cookie lines
      if (
        cookieData.length > 50 &&
        (cookieData.includes(".youtube.com") || cookieData.includes("# Netscape"))
      ) {
        require("fs").writeFileSync(tmpCookies, cookieData, "utf8");
        console.log("[YouTube Auth] Successfully wrote temporary cookies to", tmpCookies);
        return ["--cookies", tmpCookies];
      } else {
        console.warn("[YouTube Auth] Environment cookie detected but failed validation checks (too short or missing Netscape/youtube headers). Ignoring.");
      }
    } catch (err) {
      console.error("[YouTube Auth] Failed to write temporary cookies file:", err);
    }
  }

  return [];
}

function getProxyArgs() {
  const proxy =
    process.env.YT_PROXY ||
    process.env.YOUTUBE_PROXY ||
    process.env.HTTP_PROXY ||
    process.env.HTTPS_PROXY ||
    process.env.ALL_PROXY;
  if (proxy && proxy.trim().length > 4) {
    return ["--proxy", proxy.trim()];
  }
  return [];
}

function isValidYouTubeUrl(urlStr) {
  try {
    const parsed = new URL(urlStr);
    const validHosts = [
      "youtube.com",
      "www.youtube.com",
      "m.youtube.com",
      "music.youtube.com",
      "youtu.be",
    ];
    return validHosts.includes(parsed.hostname);
  } catch {
    return false;
  }
}

function cleanYouTubeUrl(urlStr) {
  try {
    const parsed = new URL(urlStr);
    let videoId = "";
    const listId = parsed.searchParams.get("list") || "";

    if (parsed.hostname === "youtu.be") {
      videoId = parsed.pathname.replace(/^\//, "").split("/")[0].split("?")[0];
    } else if (
      parsed.hostname === "music.youtube.com" ||
      parsed.hostname === "www.youtube.com" ||
      parsed.hostname === "m.youtube.com" ||
      parsed.hostname === "youtube.com"
    ) {
      if (parsed.pathname.startsWith("/shorts/")) {
        videoId = parsed.pathname.split("/shorts/")[1]?.split("/")[0]?.split("?")[0] || "";
      } else {
        videoId = parsed.searchParams.get("v") || "";
      }
    }

    // Canonicalize video URLs (standard, music, shorts, youtu.be) to watch URL
    if (videoId) {
      // Preserve legitimate user or album playlist parameters
      if (listId && (listId.startsWith("PL") || listId.startsWith("OLAK5uy_"))) {
        return `https://www.youtube.com/watch?v=${videoId}&list=${listId}`;
      }
      return `https://www.youtube.com/watch?v=${videoId}`;
    }

    parsed.searchParams.delete("si");
    parsed.searchParams.delete("feature");
    return parsed.toString();
  } catch {
    return urlStr;
  }
}

// ── Health check & Diagnostics ────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "8d-audio-backend",
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    platform: process.platform,
    memory: {
      rssMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      heapUsedMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      heapTotalMb: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
    },
    ytDlp: {
      binary: getYtDlpPath(),
      hasCookies: getCookieArgs().length > 0,
      hasProxy: getProxyArgs().length > 0,
    },
    invidious: {
      totalInstances: liveInvidiousInstances.length,
      instances: liveInvidiousInstances,
    },
  });
});

// ── Admin: Probe YouTube Extraction ───────────────────────────────────────────
app.post("/admin/probe", async (req, res) => {
  const { url } = req.body;
  if (!url || typeof url !== "string" || !isValidYouTubeUrl(url)) {
    return res.status(400).json({ error: "Invalid YouTube URL provided." });
  }

  const logs = [];
  const startTime = Date.now();
  const cleanUrl = cleanYouTubeUrl(url);
  const videoId = extractVideoId(cleanUrl);

  logs.push(`[${new Date().toISOString()}] Canonicalized URL: ${cleanUrl}`);
  logs.push(`[${new Date().toISOString()}] Extracted Video ID: ${videoId || "(none)"}`);

  let invidiousResult = null;
  if (videoId) {
    logs.push(`[${new Date().toISOString()}] Racing ${INVIDIOUS_INSTANCES.length} Invidious instances in parallel...`);

    const probePromises = INVIDIOUS_INSTANCES.map(async (instance) => {
      const instStart = Date.now();
      try {
        const apiUrl = `https://${instance}/api/v1/videos/${videoId}`;
        const apiRes = await fetch(apiUrl, {
          signal: AbortSignal.timeout(6000),
          headers: { "User-Agent": "Mozilla/5.0 (compatible; 8DAudioAdminBot/1.0)" },
        });
        const elapsed = Date.now() - instStart;
        if (!apiRes.ok) {
          return { success: false, instance, status: apiRes.status, elapsed, error: `HTTP ${apiRes.status}` };
        }
        const data = await apiRes.json();
        if (data.error) {
          return { success: false, instance, status: apiRes.status, elapsed, error: data.error };
        }
        const formats = data.adaptiveFormats || [];
        const preferredItags = ["140", "251", "250", "249", "139"];
        let audio = preferredItags
          .map((itag) => formats.find((f) => String(f.itag) === itag && f.url))
          .find(Boolean) || formats.find((f) => f.type?.startsWith("audio/") && f.url);

        if (audio) {
          return {
            success: true,
            instance,
            status: 200,
            elapsed,
            itag: audio.itag,
            type: audio.type,
            title: data.title,
            author: data.author,
            duration: data.lengthSeconds,
            proxyUrl: `https://${instance}/videoplayback${new URL(audio.url).search}`,
          };
        }
        return { success: false, instance, status: 200, elapsed, error: "No usable audio stream format" };
      } catch (e) {
        return { success: false, instance, status: 0, elapsed: Date.now() - instStart, error: e.message };
      }
    });

    const results = await Promise.allSettled(probePromises);
    const resolved = results.map((r) => r.value);

    // Sort by elapsed time to find the fastest successful one
    const successful = resolved
      .filter((r) => r && r.success)
      .sort((a, b) => a.elapsed - b.elapsed);

    resolved.forEach((r) => {
      if (r.success) {
        logs.push(
          `[${new Date().toISOString()}] ✓ ${r.instance} responded in ${r.elapsed}ms (itag=${r.itag}, type=${r.type})`
        );
      } else {
        logs.push(
          `[${new Date().toISOString()}] ✕ ${r.instance} failed in ${r.elapsed}ms (${r.error})`
        );
      }
    });

    if (successful.length > 0) {
      invidiousResult = successful[0];
      logs.push(
        `[${new Date().toISOString()}] 🏆 Fastest Winning Mirror: ${invidiousResult.instance} (${invidiousResult.elapsed}ms)`
      );
    }
  }

  return res.json({
    success: !!invidiousResult,
    videoId,
    totalTimeMs: Date.now() - startTime,
    invidiousResult,
    logs,
  });
});

// ── POST /youtube/info ────────────────────────────────────────────────────────
// Extracts video/playlist metadata using yt-dlp
app.post("/youtube/info", async (req, res) => {
  const { url } = req.body;

  if (!url || typeof url !== "string" || !isValidYouTubeUrl(url)) {
    return res
      .status(400)
      .json({ error: "Please provide a valid YouTube video or playlist URL." });
  }

  try {
    const cleanUrl = cleanYouTubeUrl(url);
    const parsed = new URL(cleanUrl);
    const isPlaylistUrl = parsed.searchParams.has("list");

    // ── Fast path: Official YouTube oEmbed API for single tracks ───────────────
    // YouTube's oEmbed endpoint is a public Google API that returns title, author,
    // and high-res thumbnail in ~50ms and NEVER blocks datacenter IP addresses.
    if (!isPlaylistUrl) {
      try {
        let videoId = "";
        if (parsed.hostname === "youtu.be") {
          videoId = parsed.pathname.replace(/^\//, "").split("/")[0].split("?")[0];
        } else {
          videoId = parsed.searchParams.get("v") || "";
        }

        if (videoId) {
          const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(cleanUrl)}&format=json`;
          const oembedRes = await fetch(oembedUrl);
          if (oembedRes.ok) {
            const oembedData = await oembedRes.json();
            const bestThumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
            return res.json({
              isPlaylist: false,
              title: oembedData.title || "YouTube Track",
              thumbnail: bestThumbnail,
              tracks: [
                {
                  id: videoId,
                  title: oembedData.title || "YouTube Track",
                  url: cleanUrl,
                  thumbnail: bestThumbnail,
                  author: oembedData.author_name || undefined,
                },
              ],
            });
          }
        }
      } catch (fastErr) {
        console.warn("[YouTube Info] Fast oEmbed check failed, falling back to yt-dlp:", fastErr.message);
      }
    }

    const ytDlpBinary = getYtDlpPath();
    const cookieArgs = getCookieArgs();

    const baseArgs = [
      "--js-runtimes",
      "deno",
      "--remote-components",
      "ejs:github",
      "--extractor-args",
      "youtube:player_client=android,web,mweb,ios;player_skip=webpage",
      "--add-header",
      "Referer: https://www.youtube.com/",
      "--add-header",
      "Origin: https://www.youtube.com/",
      "--force-ipv4",
      ...getProxyArgs(),
      "--dump-single-json",
      "--flat-playlist",
      "--no-warnings",
      "--no-check-certificates",
      cleanUrl,
    ];

    let stdout;
    try {
      const res = await execFileAsync(ytDlpBinary, [...cookieArgs, ...baseArgs], {
        maxBuffer: 15 * 1024 * 1024,
        timeout: 60000,
      });
      stdout = res.stdout;
    } catch (cookieErr) {
      if (cookieArgs.length > 0) {
        console.warn(
          "[YouTube Auth] Extraction with cookies failed (likely datacenter account checkpoint). Retrying automatically WITHOUT cookies..."
        );
        const res = await execFileAsync(ytDlpBinary, baseArgs, {
          maxBuffer: 15 * 1024 * 1024,
          timeout: 60000,
        });
        stdout = res.stdout;
      } else {
        throw cookieErr;
      }
    }

    const data = JSON.parse(stdout);
    const isPlaylist =
      data._type === "playlist" || Array.isArray(data.entries);

    let tracks = [];

    if (isPlaylist && Array.isArray(data.entries)) {
      tracks = data.entries
        .filter((entry) => entry && (entry.id || entry.url))
        .map((entry) => {
          const videoId = entry.id;
          const trackUrl =
            entry.url && entry.url.startsWith("http")
              ? entry.url
              : `https://www.youtube.com/watch?v=${videoId}`;

          return {
            id: videoId,
            title: entry.title || "Untitled Video",
            duration: typeof entry.duration === "number" ? entry.duration : undefined,
            url: trackUrl,
            thumbnail:
              entry.thumbnail ||
              (entry.thumbnails && entry.thumbnails.length > 0
                ? entry.thumbnails[entry.thumbnails.length - 1].url
                : `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`),
            author:
              entry.uploader || entry.channel || data.uploader || undefined,
          };
        });
    } else {
      const videoId = data.id;
      const trackUrl =
        data.webpage_url || `https://www.youtube.com/watch?v=${videoId}`;
      const bestThumbnail =
        data.thumbnail ||
        (data.thumbnails && data.thumbnails.length > 0
          ? data.thumbnails[data.thumbnails.length - 1].url
          : `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`);

      tracks = [
        {
          id: videoId,
          title: data.title || "Untitled Track",
          duration: typeof data.duration === "number" ? data.duration : undefined,
          url: trackUrl,
          thumbnail: bestThumbnail,
          author: data.uploader || data.channel || undefined,
        },
      ];
    }

    res.json({
      isPlaylist,
      title: data.title || (isPlaylist ? "YouTube Playlist" : "YouTube Video"),
      thumbnail: tracks.length > 0 && tracks[0].thumbnail ? tracks[0].thumbnail : undefined,
      tracks,
    });
  } catch (error) {
    console.error("YouTube metadata extraction failed, attempting oEmbed fallback:", error);

    // ── Resilient Fallback: Official YouTube oEmbed API ───────────────────────
    // If yt-dlp fails due to datacenter IP blocks, YouTube's official oEmbed API
    // returns video title, artist, and high-res thumbnail with 100% reliability
    try {
      const cleanUrl = cleanYouTubeUrl(url);
      const parsed = new URL(cleanUrl);
      let videoId = "";
      if (parsed.hostname === "youtu.be") {
        videoId = parsed.pathname.replace(/^\//, "").split("/")[0].split("?")[0];
      } else {
        videoId = parsed.searchParams.get("v") || "";
      }

      if (videoId) {
        console.log(`[YouTube Info] Falling back to YouTube oEmbed API for videoId: ${videoId}`);
        const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(cleanUrl)}&format=json`;
        const oembedRes = await fetch(oembedUrl);
        if (oembedRes.ok) {
          const oembedData = await oembedRes.json();
          const bestThumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
          return res.json({
            isPlaylist: false,
            title: oembedData.title || "YouTube Track",
            thumbnail: bestThumbnail,
            tracks: [
              {
                id: videoId,
                title: oembedData.title || "YouTube Track",
                url: cleanUrl,
                thumbnail: bestThumbnail,
                author: oembedData.author_name || undefined,
              },
            ],
          });
        }
      }
    } catch (oembedErr) {
      console.error("oEmbed fallback also failed:", oembedErr);
    }

    let message = "Failed to load YouTube video or playlist info.";
    if (error.code === "ENOENT") {
      message = "yt-dlp is not installed or not found on the server.";
    } else {
      const fullText = (error.stderr || error.message || "").trim();
      const meaningfulLines = fullText
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("Command failed:"));
      if (meaningfulLines.length > 0) {
        message = meaningfulLines[meaningfulLines.length - 1];
      }
    }
    res.status(500).json({ error: message });
  }
});

// ── GET /youtube/stream?url=... ───────────────────────────────────────────────
// Primary path: Invidious proxy (bypasses Render datacenter IP block entirely)
// Fallback: yt-dlp spawned locally (may fail on Render due to YouTube IP block)
app.get("/youtube/stream", async (req, res) => {
  const { url: videoUrl } = req.query;

  if (!videoUrl || !isValidYouTubeUrl(videoUrl)) {
    return res.status(400).json({ error: "Invalid YouTube URL provided." });
  }

  const cleanUrl = cleanYouTubeUrl(videoUrl);
  const videoId = extractVideoId(cleanUrl);

  // ── Primary: Invidious proxy ───────────────────────────────────────────────
  if (videoId) {
    try {
      const audioInfo = await getInvidiousAudioInfo(videoId);
      if (audioInfo) {
        console.log(`[Invidious] Streaming via ${audioInfo.instance} for ${videoId}`);
        await pipeInvidiousStream(
          audioInfo.proxyUrl,
          audioInfo.instance,
          audioInfo.contentType,
          req,
          res
        );
        return; // success
      }
    } catch (invErr) {
      console.error("[Invidious] All instances failed or stream error:", invErr.message);
    }
  }

  // ── Fallback: yt-dlp ───────────────────────────────────────────────────────
  if (res.headersSent) return; // Invidious already started sending, don't retry

  console.warn("[Stream] Invidious unavailable, falling back to yt-dlp...");

  try {
    const ytDlpBinary = getYtDlpPath();
    const cookieArgs = getCookieArgs();

    const getArgs = (withCookies, client = "android,web,mweb,ios") => [
      "--js-runtimes",
      "deno",
      "--remote-components",
      "ejs:github",
      "--extractor-args",
      `youtube:player_client=${client};player_skip=webpage`,
      "--add-header",
      "Referer: https://www.youtube.com/",
      "--add-header",
      "Origin: https://www.youtube.com/",
      "--force-ipv4",
      ...getProxyArgs(),
      ...(withCookies ? cookieArgs : []),
      "-f",
      "ba/b",
      "-o",
      "-",
      "--no-playlist",
      "--no-warnings",
      "--no-check-certificates",
      cleanUrl,
    ];

    const startStream = (useCookies, client = "android,web,mweb,ios") => {
      const child = spawn(ytDlpBinary, getArgs(useCookies, client));

      let hasSentHeaders = false;
      let stderr = "";

      child.stdout.on("data", (chunk) => {
        if (!hasSentHeaders && !res.headersSent) {
          res.setHeader("Content-Type", "audio/mp4");
          res.setHeader("Cache-Control", "no-cache");
          res.setHeader("Access-Control-Allow-Origin", "*");
          hasSentHeaders = true;
        }
        res.write(chunk);
      });

      child.stdout.on("end", () => {
        if (hasSentHeaders || res.headersSent) {
          res.end();
        }
      });

      child.stderr.on("data", (chunk) => {
        stderr = (stderr + chunk.toString()).slice(-4000);
      });

      child.on("error", (err) => {
        console.error("yt-dlp spawn error:", err);
        if (!res.headersSent && !hasSentHeaders) {
          res.status(500).json({ error: "Failed to spawn yt-dlp process." });
        } else {
          res.destroy();
        }
      });

      child.on("close", (code) => {
        if (code !== 0) {
          console.error(
            `yt-dlp stream failed (useCookies=${useCookies}, client=${client}) with code ${code}:`,
            stderr
          );
          if (!res.headersSent && !hasSentHeaders) {
            if (useCookies && cookieArgs.length > 0) {
              console.warn("[YouTube Auth] Stream with cookies failed. Retrying WITHOUT cookies...");
              startStream(false, client);
              return;
            }
            const cleanErr =
              stderr
                .split("\n")
                .map((l) => l.trim())
                .filter((l) => l && !l.startsWith("Command failed:"))
                .pop() || "yt-dlp stream exited with error.";
            res.status(500).json({ error: cleanErr });
          } else {
            res.destroy();
          }
        }
      });

      req.on("close", () => {
        child.kill("SIGKILL");
      });
    };

    startStream(cookieArgs.length > 0);
  } catch (err) {
    console.error("YouTube streaming error:", err);
    if (!res.headersSent) {
      res.status(500).json({
        error: err?.message || "Failed to stream YouTube audio.",
      });
    }
  }
});

// ── Start server ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✓ 8D Audio backend running on port ${PORT}`);
  console.log(`✓ yt-dlp binary: ${getYtDlpPath()}`);
  console.log(`✓ Proxy configured: ${getProxyArgs().length > 0 ? "YES" : "NO"}`);
  console.log(`✓ YouTube cookies: ${getCookieArgs().length > 0 ? "YES" : "NO"}`);

  // Fetch verified healthy Invidious instances on boot
  refreshInvidiousPool().catch(() => {});
});

