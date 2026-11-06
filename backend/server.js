const express = require("express");
const cors = require("cors");
const { execFile } = require("child_process");
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
    path.join(process.cwd(), "bin", "yt-dlp"),
    "/usr/local/bin/yt-dlp",
    "/usr/bin/yt-dlp",
    "yt-dlp",
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return "yt-dlp"; // fallback: rely on PATH
}

// ── URL validation ────────────────────────────────────────────────────────────
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
    const ytDlpBinary = getYtDlpPath();
    const args = [
      "--dump-single-json",
      "--flat-playlist",
      "--no-warnings",
      "--no-check-certificates",
      url,
    ];

    const { stdout } = await execFileAsync(ytDlpBinary, args, {
      maxBuffer: 10 * 1024 * 1024,
      timeout: 30000,
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
    } else if (error.stderr) {
      message = error.stderr.split("\n")[0] || message;
    } else if (error.message) {
      message = error.message;
    }
    res.status(500).json({ error: message });
  }
});

// ── GET /youtube/stream?url=... ───────────────────────────────────────────────
// Extracts signed CDN URL via yt-dlp and proxies the audio stream
app.get("/youtube/stream", async (req, res) => {
  const { url: videoUrl } = req.query;

  if (!videoUrl || !isValidYouTubeUrl(videoUrl)) {
    return res.status(400).json({ error: "Invalid YouTube URL provided." });
  }

  try {
    const ytDlpBinary = getYtDlpPath();

    const { stdout } = await execFileAsync(
      ytDlpBinary,
      [
        "-f", "ba[ext=m4a]/ba/b",
        "--get-url",
        "--no-playlist",
        "--no-warnings",
        "--no-check-certificates",
        videoUrl,
      ],
      { timeout: 25000 }
    );

    const streamUrl = stdout.trim().split("\n")[0];
    if (!streamUrl || !streamUrl.startsWith("http")) {
      throw new Error("Could not extract a valid audio stream URL.");
    }

    // Fetch the CDN stream and pipe it to the client
    const mediaResponse = await fetch(streamUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!mediaResponse.ok || !mediaResponse.body) {
      throw new Error(`Media fetch failed with status: ${mediaResponse.status}`);
    }

    const contentType = mediaResponse.headers.get("content-type") || "audio/mp4";
    const contentLength = mediaResponse.headers.get("content-length");

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Access-Control-Allow-Origin", "*");
    if (contentLength) res.setHeader("Content-Length", contentLength);

    // Stream the response body
    const { Readable } = require("stream");
    const nodeStream = Readable.fromWeb(mediaResponse.body);
    nodeStream.pipe(res);
  } catch (err) {
    console.error("YouTube streaming error:", err);
    res.status(500).json({
      error: err?.message || "Failed to stream YouTube audio.",
    });
  }
});

// ── Start server ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`8D Audio backend running on port ${PORT}`);
});

