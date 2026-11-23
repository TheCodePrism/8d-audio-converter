/**
 * YouTube URL helper functions: validation, canonicalization, and ID extraction.
 */

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

function extractVideoId(urlStr) {
  try {
    const parsed = new URL(urlStr);
    if (parsed.hostname === "youtu.be") {
      return parsed.pathname.slice(1).split("/")[0].split("?")[0];
    }
    if (parsed.pathname.startsWith("/shorts/")) {
      return parsed.pathname.split("/shorts/")[1]?.split("/")[0]?.split("?")[0] || "";
    }
    return parsed.searchParams.get("v") || "";
  } catch {
    return "";
  }
}

function extractPlaylistId(urlStr) {
  try {
    const parsed = new URL(urlStr);
    return parsed.searchParams.get("list") || "";
  } catch {
    return "";
  }
}

function isValidPlaylistId(listId) {
  if (!listId || typeof listId !== "string") return false;
  const trimmed = listId.trim();
  // Valid YouTube playlist IDs can be 2 chars (WL, LL), 12 chars (legacy/custom), or 34+ chars
  return trimmed.length >= 2 && /^[a-zA-Z0-9_-]+$/.test(trimmed);
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

    // Canonicalize video URLs (standard, music, shorts, youtu.be) to standard watch URL
    if (videoId) {
      if (listId && (listId.startsWith("PL") || listId.startsWith("OLAK5uy_") || listId.startsWith("RD"))) {
        return `https://www.youtube.com/watch?v=${videoId}&list=${listId}`;
      }
      return `https://www.youtube.com/watch?v=${videoId}`;
    }

    // Canonicalize playlist URLs (including music.youtube.com/playlist?list=...) to standard playlist URL
    if (listId) {
      return `https://www.youtube.com/playlist?list=${listId}`;
    }

    parsed.searchParams.delete("si");
    parsed.searchParams.delete("feature");
    return parsed.toString();
  } catch {
    return urlStr;
  }
}

module.exports = {
  isValidYouTubeUrl,
  extractVideoId,
  extractPlaylistId,
  isValidPlaylistId,
  cleanYouTubeUrl,
};
