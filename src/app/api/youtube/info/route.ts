import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import { YouTubeInfoResponse, YouTubeTrack } from "@/types";
import { getYtDlpPath } from "@/lib/ytDlp";

const execFileAsync = promisify(execFile);

// Helper to sanitize and check for valid YouTube URLs
function isValidYouTubeUrl(urlStr: string): boolean {
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url } = body;

    if (!url || typeof url !== "string" || !isValidYouTubeUrl(url)) {
      return NextResponse.json(
        { error: "Please provide a valid YouTube video or playlist URL." },
        { status: 400 }
      );
    }

    // Call yt-dlp to extract metadata in JSON format without downloading media
    // --flat-playlist ensures playlists return immediately with list of items
    const args = [
      "--dump-single-json",
      "--flat-playlist",
      "--no-warnings",
      "--no-check-certificates",
      url,
    ];

    const ytDlpBinary = getYtDlpPath();
    const { stdout } = await execFileAsync(ytDlpBinary, args, {
      maxBuffer: 10 * 1024 * 1024,
      timeout: 30000,
    });

    const data = JSON.parse(stdout);
    const isPlaylist =
      data._type === "playlist" || Array.isArray(data.entries);

    let tracks: YouTubeTrack[] = [];

    if (isPlaylist && Array.isArray(data.entries)) {
      tracks = data.entries
        .filter((entry: any) => entry && (entry.id || entry.url))
        .map((entry: any) => {
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
            author: entry.uploader || entry.channel || data.uploader || undefined,
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

    const response: YouTubeInfoResponse = {
      isPlaylist,
      title: data.title || (isPlaylist ? "YouTube Playlist" : "YouTube Video"),
      thumbnail:
        tracks.length > 0 && tracks[0].thumbnail ? tracks[0].thumbnail : undefined,
      tracks,
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("YouTube metadata extraction failed:", error);

    let message = "Failed to load YouTube video or playlist info.";
    if (error.code === "ENOENT") {
      message = "yt-dlp is not installed or not available on the server system PATH.";
    } else if (error.stderr) {
      message = error.stderr.split("\n")[0] || message;
    } else if (error.message) {
      message = error.message;
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
