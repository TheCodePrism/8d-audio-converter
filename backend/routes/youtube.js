const express = require("express");
const {
  isValidYouTubeUrl,
  cleanYouTubeUrl,
  extractVideoId,
  extractPlaylistId,
  isValidPlaylistId,
} = require("../utils/youtube");
const { getInvidiousAudioInfo, pipeInvidiousStream } = require("../services/invidious");
const { extractInfo, streamDirect } = require("../services/ytdlp");

const router = express.Router();

// ── POST /youtube/info ────────────────────────────────────────────────────────
// Extracts video or playlist metadata
router.post("/youtube/info", async (req, res) => {
  const { url } = req.body;

  if (!url || typeof url !== "string" || !isValidYouTubeUrl(url)) {
    return res
      .status(400)
      .json({ error: "Please provide a valid YouTube video or playlist URL." });
  }

  const cleanUrl = cleanYouTubeUrl(url);
  const listId = extractPlaylistId(cleanUrl);

  // Validate playlist parameter if present without a video ID
  const videoId = extractVideoId(cleanUrl);
  if (listId && !videoId && !isValidPlaylistId(listId)) {
    return res.status(400).json({
      error: `The playlist ID '${listId}' appears incomplete or cut off. Please paste the full playlist link from YouTube or YouTube Music.`,
    });
  }

  try {
    const data = await extractInfo(cleanUrl);
    return res.json(data);
  } catch (error) {
    console.error("[YouTube Info] Metadata extraction failed:", error.message || error);

    let message = "Failed to load YouTube video or playlist info.";
    const fullText = (error.stderr || error.message || "").trim();

    if (
      fullText.includes("HTTP Error 400") ||
      fullText.includes("The playlist does not exist") ||
      fullText.includes("Unable to download API page")
    ) {
      message = "This playlist does not exist, is private, or the link is incomplete. Please check the URL.";
    } else if (fullText.includes("Video unavailable")) {
      message = "This YouTube video is unavailable or private.";
    } else if (fullText.includes("Sign in to confirm")) {
      message = "YouTube is requesting sign-in verification for this content.";
    } else if (error.code === "ENOENT") {
      message = "yt-dlp binary is not installed or not found on the server.";
    } else {
      const meaningfulLines = fullText
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("Command failed:"));
      if (meaningfulLines.length > 0) {
        message = meaningfulLines[meaningfulLines.length - 1];
      }
    }

    return res.status(500).json({ error: message });
  }
});

// ── GET /youtube/stream?url=... ───────────────────────────────────────────────
// Streams audio: Invidious proxy (primary) -> yt-dlp fallback
router.get("/youtube/stream", async (req, res) => {
  const { url: videoUrl } = req.query;

  if (!videoUrl || !isValidYouTubeUrl(videoUrl)) {
    return res.status(400).json({ error: "Invalid YouTube URL provided." });
  }

  const cleanUrl = cleanYouTubeUrl(videoUrl);
  const videoId = extractVideoId(cleanUrl);

  // ── Primary: Invidious proxy (bypasses Render datacenter IP block) ───────────
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
        return; // Success
      }
    } catch (invErr) {
      console.error("[Invidious] All instances failed or stream error:", invErr.message);
    }
  }

  // ── Fallback: Direct yt-dlp stream ─────────────────────────────────────────
  if (res.headersSent) return;

  console.warn("[Stream] Invidious unavailable, falling back to yt-dlp...");
  try {
    streamDirect(cleanUrl, req, res);
  } catch (err) {
    console.error("YouTube streaming error:", err);
    if (!res.headersSent) {
      res.status(500).json({
        error: err?.message || "Failed to stream YouTube audio.",
      });
    }
  }
});

module.exports = router;
