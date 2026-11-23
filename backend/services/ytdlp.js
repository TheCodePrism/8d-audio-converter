const { execFile, spawn } = require("child_process");
const { promisify } = require("util");
const { getYtDlpPath } = require("../utils/binaries");
const { getCookieArgs, getProxyArgs } = require("../utils/auth");
const { extractVideoId } = require("../utils/youtube");
const { YTDLP_EXTRACT_TIMEOUT_MS } = require("../config");

const execFileAsync = promisify(execFile);

/**
 * Extracts metadata for a single video or full playlist using yt-dlp,
 * with fast oEmbed pre-check and resilient fallback.
 */
async function extractInfo(cleanUrl) {
  const parsed = new URL(cleanUrl);
  const isPlaylistUrl = parsed.searchParams.has("list");

  // Fast path: Official YouTube oEmbed API for single tracks
  if (!isPlaylistUrl) {
    try {
      const videoId = extractVideoId(cleanUrl);
      if (videoId) {
        const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(cleanUrl)}&format=json`;
        const oembedRes = await fetch(oembedUrl);
        if (oembedRes.ok) {
          const oembedData = await oembedRes.json();
          const bestThumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
          return {
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
          };
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
    "--geo-bypass",
    "--geo-bypass-country",
    "IN",
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
      timeout: YTDLP_EXTRACT_TIMEOUT_MS,
    });
    stdout = res.stdout;
  } catch (cookieErr) {
    const errText = cookieErr.stderr || cookieErr.message || "";
    const isDeletedOrMissing =
      errText.includes("This video is unavailable") ||
      errText.includes("Video unavailable") ||
      errText.includes("The playlist does not exist") ||
      errText.includes("HTTP Error 404");

    if (cookieArgs.length > 0 && !isDeletedOrMissing && errText.includes("Sign in to confirm")) {
      console.warn(
        "[YouTube Auth] Extraction with cookies failed (likely datacenter account checkpoint). Retrying automatically WITHOUT cookies..."
      );
      const res = await execFileAsync(ytDlpBinary, baseArgs, {
        maxBuffer: 15 * 1024 * 1024,
        timeout: YTDLP_EXTRACT_TIMEOUT_MS,
      });
      stdout = res.stdout;
    } else {
      throw cookieErr;
    }
  }

  const data = JSON.parse(stdout);
  const isPlaylist = data._type === "playlist" || Array.isArray(data.entries);
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
            entry.thumbnails && entry.thumbnails.length > 0
              ? entry.thumbnails[entry.thumbnails.length - 1].url
              : `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          author: entry.uploader || entry.channel || undefined,
        };
      });
  } else {
    const videoId = data.id || extractVideoId(cleanUrl);
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

  return {
    isPlaylist,
    title: data.title || (isPlaylist ? "YouTube Playlist" : "YouTube Video"),
    thumbnail: tracks.length > 0 && tracks[0].thumbnail ? tracks[0].thumbnail : undefined,
    tracks,
  };
}

/**
 * Spawns yt-dlp to stream audio directly into the Express response stream.
 */
function streamDirect(cleanUrl, req, res) {
  const ytDlpBinary = getYtDlpPath();
  const cookieArgs = getCookieArgs();
  const proxyArgs = getProxyArgs();

  const getArgs = (withCookies, withProxy = true, client = null) => [
    "--js-runtimes",
    "deno",
    "--remote-components",
    "ejs:github",
    "--geo-bypass",
    "--geo-bypass-country",
    "IN",
    ...(client ? ["--extractor-args", `youtube:player_client=${client}`] : []),
    "--add-header",
    "Referer: https://www.youtube.com/",
    "--add-header",
    "Origin: https://www.youtube.com/",
    "--force-ipv4",
    ...(withProxy ? proxyArgs : []),
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

  const startStream = (useCookies, useProxy = true, client = null) => {
    const child = spawn(ytDlpBinary, getArgs(useCookies, useProxy, client));

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
          `yt-dlp stream failed (useCookies=${useCookies}, useProxy=${useProxy}, client=${client}) with code ${code}:`,
          stderr
        );
        if (!res.headersSent && !hasSentHeaders) {
          const isDeletedOrMissing =
            stderr.includes("This video is unavailable") ||
            stderr.includes("Video unavailable") ||
            stderr.includes("does not exist") ||
            stderr.includes("HTTP Error 404");

          // Only retry without cookies if cookies caused a login block on an existing video
          if (useCookies && cookieArgs.length > 0 && !isDeletedOrMissing && stderr.includes("Sign in to confirm")) {
            console.warn("[YouTube Auth] Stream with cookies failed login check. Retrying WITHOUT cookies...");
            startStream(false, useProxy, client);
            return;
          }
          // If proxy failed or caused bot checkpoint, retry directly without proxy
          if (useProxy && proxyArgs.length > 0) {
            console.warn("[YouTube Proxy] Stream through proxy failed or blocked. Retrying WITHOUT proxy...");
            startStream(false, false, client);
            return;
          }
          let cleanErr =
            stderr
              .split("\n")
              .map((l) => l.trim())
              .filter((l) => l && !l.startsWith("Command failed:"))
              .pop() || "yt-dlp stream exited with error.";

          if (
            cleanErr.includes("HTTP Error 400") ||
            cleanErr.includes("does not exist") ||
            cleanErr.includes("Failed to extract any player response") ||
            cleanErr.includes("This video is unavailable") ||
            cleanErr.includes("Video unavailable") ||
            isDeletedOrMissing
          ) {
            cleanErr = "This video is unavailable, deleted, or region-restricted on YouTube.";
          } else if (cleanErr.includes("Sign in to confirm")) {
            cleanErr = "YouTube anti-bot verification triggered on cloud server. Please upload this track via the 'Upload Files' tab.";
          }
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

  startStream(cookieArgs.length > 0, proxyArgs.length > 0, null);
}

module.exports = {
  extractInfo,
  streamDirect,
};
