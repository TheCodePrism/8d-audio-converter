import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

// Base URL of the yt-dlp backend service (Render/Railway)
const BACKEND_URL = process.env.YOUTUBE_BACKEND_URL?.replace(/\/+$/, "");

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

    // Redirect the browser directly to the Render backend stream endpoint.
    // The browser's fetch() follows this 307 redirect automatically,
    // completely eliminating Vercel's 10-second serverless execution timeout!
    const targetUrl = `${BACKEND_URL}/youtube/stream?url=${encodeURIComponent(videoUrl)}`;
    return Response.redirect(targetUrl, 307);
  } catch (error: any) {
    console.error("YouTube stream redirect error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to initialize YouTube audio stream." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
