const express = require("express");
const cors = require("cors");
const { execFile, spawn } = require("child_process");
const { promisify } = require("util");
const { existsSync } = require("fs");
const path = require("path");

const execFileAsync = promisify(execFile);
const app = express();

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

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
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
    const ytDlpBinary = getYtDlpPath();
    const cookieArgs = getCookieArgs();

    const baseArgs = [
      "--js-runtimes",
      "deno,node",
      "--remote-components",
      "ejs:github",
      "--extractor-args",
      "youtube:player_client=tv,mweb,default",
      "--force-ipv4",
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
    console.error("YouTube metadata extraction failed:", error);
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
// Streams audio directly from yt-dlp to avoid Google CDN 403 Forbidden errors
app.get("/youtube/stream", (req, res) => {
  const { url: videoUrl } = req.query;

  if (!videoUrl || !isValidYouTubeUrl(videoUrl)) {
    return res.status(400).json({ error: "Invalid YouTube URL provided." });
  }

  try {
    const cleanUrl = cleanYouTubeUrl(videoUrl);
    const ytDlpBinary = getYtDlpPath();
    const cookieArgs = getCookieArgs();

    const getArgs = (withCookies) => [
      "--js-runtimes",
      "deno,node",
      "--remote-components",
      "ejs:github",
      "--extractor-args",
      "youtube:player_client=tv,mweb,default",
      "--force-ipv4",
      ...(withCookies ? cookieArgs : []),
      "-f",
      "ba[ext=m4a]/ba/b",
      "-o",
      "-",
      "--no-playlist",
      "--no-warnings",
      "--no-check-certificates",
      cleanUrl,
    ];

    const startStream = (useCookies) => {
      const child = spawn(ytDlpBinary, getArgs(useCookies));

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
          console.error(`yt-dlp stream failed (useCookies=${useCookies}) with code:`, code, stderr);
          if (!res.headersSent && !hasSentHeaders) {
            if (useCookies && cookieArgs.length > 0) {
              console.warn("[YouTube Auth] Stream with cookies failed. Retrying automatically WITHOUT cookies...");
              startStream(false);
              return;
            }
            res.status(500).json({ error: "Failed to download audio from YouTube." });
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
  console.log(`8D Audio backend running on port ${PORT}`);
});

