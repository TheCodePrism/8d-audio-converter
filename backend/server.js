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
  const localCookies = path.join(process.cwd(), "cookies.txt");
  if (existsSync(localCookies)) {
    return ["--cookies", localCookies];
  }
  if (process.env.YOUTUBE_COOKIES) {
    const tmpCookies = path.join(process.env.TEMP || "/tmp", "yt_cookies.txt");
    try {
      require("fs").writeFileSync(tmpCookies, process.env.YOUTUBE_COOKIES, "utf8");
      return ["--cookies", tmpCookies];
    } catch {}
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

    if (parsed.hostname === "youtu.be") {
      videoId = parsed.pathname.replace(/^\//, "").split("/")[0].split("?")[0];
    } else if (
      parsed.hostname === "music.youtube.com" ||
      parsed.hostname === "www.youtube.com" ||
      parsed.hostname === "m.youtube.com" ||
      parsed.hostname === "youtube.com"
    ) {
      videoId = parsed.searchParams.get("v") || "";
    }

    // Canonicalize any video URL (including YouTube Music and youtu.be) to standard watch URL
    if (videoId) {
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
    const args = [
      "--impersonate",
      "chrome",
      "--force-ipv4",
      ...getCookieArgs(),
      "--dump-single-json",
      "--flat-playlist",
      "--no-warnings",
      "--no-check-certificates",
      cleanUrl,
    ];

    const { stdout } = await execFileAsync(ytDlpBinary, args, {
      maxBuffer: 15 * 1024 * 1024,
      timeout: 35000,
    });

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

    const args = [
      "--impersonate",
      "chrome",
      "--force-ipv4",
      ...getCookieArgs(),
      "-f",
      "ba[ext=m4a]/ba/b",
      "-o",
      "-",
      "--no-playlist",
      "--no-warnings",
      "--no-check-certificates",
      cleanUrl,
    ];

    const child = spawn(ytDlpBinary, args);

    res.setHeader("Content-Type", "audio/mp4");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Access-Control-Allow-Origin", "*");

    // Pipe audio data directly to client
    child.stdout.pipe(res);

    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (err) => {
      console.error("yt-dlp spawn error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to spawn yt-dlp process." });
      }
    });

    child.on("close", (code) => {
      if (code !== 0 && !res.headersSent) {
        console.error("yt-dlp stream failed with code:", code, stderr);
        res.status(500).json({ error: "Failed to download audio from YouTube." });
      }
    });

    // Abort yt-dlp process if client cancels/closes connection early
    req.on("close", () => {
      child.kill("SIGKILL");
    });
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

