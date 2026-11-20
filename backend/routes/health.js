const express = require("express");
const { getYtDlpPath } = require("../utils/binaries");
const { getCookieArgs, getProxyArgs } = require("../utils/auth");
const { isValidYouTubeUrl, cleanYouTubeUrl, extractVideoId } = require("../utils/youtube");
const { getLiveInstances } = require("../services/invidious");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

const router = express.Router();

// ── Health Check ─────────────────────────────────────────────────────────────
router.get("/health", (_req, res) => {
  const liveInstances = getLiveInstances();
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
      totalInstances: liveInstances.length,
      instances: liveInstances,
    },
  });
});

// ── Admin: Probe YouTube Extraction ───────────────────────────────────────────
router.post("/admin/probe", async (req, res) => {
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
  const liveInstances = getLiveInstances().slice(0, 8);

  if (videoId) {
    logs.push(`[${new Date().toISOString()}] Racing ${liveInstances.length} Invidious instances in parallel...`);

    const probePromises = liveInstances.map(async (instance) => {
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

  // ── yt-dlp Probe ───────────────────────────────────────────────────────────
  let ytdlpResult = null;
  const ytStart = Date.now();
  try {
    const ytDlpBinary = getYtDlpPath();
    const testArgs = [
      "--js-runtimes",
      "deno",
      "--remote-components",
      "ejs:github",
      "--geo-bypass",
      "--geo-bypass-country",
      "IN",
      "-f",
      "ba/b",
      "-g",
      "--force-ipv4",
      "--no-playlist",
      "--no-warnings",
      cleanUrl,
    ];
    logs.push(`[${new Date().toISOString()}] Running yt-dlp test extraction...`);
    const { stdout, stderr } = await execFileAsync(ytDlpBinary, testArgs, { timeout: 15000 });
    const streamUrl = stdout.trim().split("\n")[0];
    ytdlpResult = {
      success: true,
      elapsed: Date.now() - ytStart,
      hasStreamUrl: !!streamUrl,
      previewUrl: streamUrl ? streamUrl.slice(0, 100) + "..." : null,
    };
    logs.push(`[${new Date().toISOString()}] ✓ yt-dlp succeeded in ${ytdlpResult.elapsed}ms`);
  } catch (ytErr) {
    ytdlpResult = {
      success: false,
      elapsed: Date.now() - ytStart,
      error: ytErr.stderr || ytErr.message,
    };
    logs.push(`[${new Date().toISOString()}] ✕ yt-dlp failed in ${ytdlpResult.elapsed}ms: ${(ytErr.stderr || ytErr.message).slice(0, 200)}`);
  }

  return res.json({
    success: !!invidiousResult || (ytdlpResult && ytdlpResult.success),
    videoId,
    totalTimeMs: Date.now() - startTime,
    invidiousResult,
    ytdlpResult,
    logs,
  });
});

// ── Admin: Test Player Clients on Datacenter IP ──────────────────────────────
router.post("/admin/test-clients", async (req, res) => {
  const { url = "https://www.youtube.com/watch?v=KSAAO3MHL1k" } = req.body;
  const cleanUrl = cleanYouTubeUrl(url);
  const ytDlpBinary = getYtDlpPath();
  const clientsToTest = ["tv", "web_creator", "android_creator", "web_safari", "android_vr", "mweb", "ios", "android"];
  const results = {};

  for (const client of clientsToTest) {
    const start = Date.now();
    try {
      const testArgs = [
        "--js-runtimes",
        "deno",
        "--remote-components",
        "ejs:github",
        "--geo-bypass",
        "--geo-bypass-country",
        "IN",
        "--extractor-args",
        `youtube:player_client=${client}`,
        "-f",
        "ba/b",
        "-g",
        "--force-ipv4",
        "--no-playlist",
        cleanUrl,
      ];
      const { stdout } = await execFileAsync(ytDlpBinary, testArgs, { timeout: 12000 });
      const streamUrl = stdout.trim().split("\n")[0];
      results[client] = {
        success: true,
        elapsed: Date.now() - start,
        hasUrl: !!streamUrl,
        urlPrefix: streamUrl ? streamUrl.slice(0, 80) : null,
      };
    } catch (err) {
      results[client] = {
        success: false,
        elapsed: Date.now() - start,
        error: (err.stderr || err.message || "").trim().split("\n").pop(),
      };
    }
  }

  res.json({ url: cleanUrl, results });
});

module.exports = router;
