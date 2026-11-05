import { NextRequest } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import { getYtDlpPath } from "@/lib/ytDlp";

const execFileAsync = promisify(execFile);

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

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const videoUrl = searchParams.get("url");

  if (!videoUrl || !isValidYouTubeUrl(videoUrl)) {
    return new Response(
      JSON.stringify({ error: "Invalid YouTube URL provided." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const ytDlpBinary = getYtDlpPath();

    // Use yt-dlp to extract the direct signed audio stream URL
    const { stdout } = await execFileAsync(
      ytDlpBinary,
      [
        "-f",
        "ba[ext=m4a]/ba/b",
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

    // Fetch the raw audio stream from YouTube's media CDN
    const mediaResponse = await fetch(streamUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!mediaResponse.ok || !mediaResponse.body) {
      throw new Error(`Media fetch failed with status: ${mediaResponse.status}`);
    }

    const contentType =
      mediaResponse.headers.get("content-type") || "audio/mp4";
    const contentLength = mediaResponse.headers.get("content-length");

    const responseHeaders: Record<string, string> = {
      "Content-Type": contentType,
      "Cache-Control": "no-cache",
      "Access-Control-Allow-Origin": "*",
    };

    if (contentLength) {
      responseHeaders["Content-Length"] = contentLength;
    }

    return new Response(mediaResponse.body, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (err: any) {
    console.error("YouTube streaming error:", err);
    return new Response(
      JSON.stringify({
        error:
          err?.message || "Failed to download and stream YouTube audio.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
