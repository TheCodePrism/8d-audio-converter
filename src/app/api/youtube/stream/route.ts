import { NextRequest } from "next/server";

// Proxy to the yt-dlp backend (Render/Railway)
// Set YOUTUBE_BACKEND_URL in Vercel environment variables
const BACKEND_URL = process.env.YOUTUBE_BACKEND_URL;

export async function GET(req: NextRequest) {
  if (!BACKEND_URL) {
    return new Response(
      JSON.stringify({ error: "YouTube backend service is not configured." }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const videoUrl = searchParams.get("url");

    if (!videoUrl) {
      return new Response(
        JSON.stringify({ error: "Missing url parameter." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const backendRes = await fetch(
      `${BACKEND_URL}/youtube/stream?url=${encodeURIComponent(videoUrl)}`,
      { headers: { "User-Agent": "8d-audio-converter-proxy/1.0" } }
    );

    if (!backendRes.ok || !backendRes.body) {
      const err = await backendRes.text();
      return new Response(err, {
        status: backendRes.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    const contentType = backendRes.headers.get("content-type") || "audio/mp4";
    const contentLength = backendRes.headers.get("content-length");

    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "Cache-Control": "no-cache",
      "Access-Control-Allow-Origin": "*",
    };
    if (contentLength) headers["Content-Length"] = contentLength;

    return new Response(backendRes.body, { status: 200, headers });
  } catch (error: any) {
    console.error("YouTube stream proxy error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to reach the YouTube backend service." }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
}
