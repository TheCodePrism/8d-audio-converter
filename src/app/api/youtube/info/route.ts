import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60; // Allow sufficient time for Render backend cold-start & yt-dlp extraction
export const dynamic = "force-dynamic";

// Proxy to the yt-dlp backend (Render/Railway)
// Set YOUTUBE_BACKEND_URL in Vercel environment variables
const BACKEND_URL = process.env.YOUTUBE_BACKEND_URL?.replace(/\/+$/, "");

export async function POST(req: NextRequest) {
  if (!BACKEND_URL) {
    return NextResponse.json(
      { error: "YouTube backend service is not configured." },
      { status: 503 }
    );
  }

  try {
    const body = await req.json();
    const response = await fetch(`${BACKEND_URL}/youtube/info`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    console.error("YouTube info proxy error:", error);
    return NextResponse.json(
      { error: "Failed to reach the YouTube backend service." },
      { status: 502 }
    );
  }
}
