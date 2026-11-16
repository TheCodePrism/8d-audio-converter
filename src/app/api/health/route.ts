import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BACKEND_URL = process.env.YOUTUBE_BACKEND_URL?.replace(/\/+$/, "") || "http://localhost:3001";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const targetBackend = searchParams.get("backendUrl") || BACKEND_URL;

  const start = Date.now();
  try {
    const res = await fetch(`${targetBackend}/health`, {
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });

    const latencyMs = Date.now() - start;
    if (!res.ok) {
      return NextResponse.json(
        {
          status: "error",
          statusCode: res.status,
          latencyMs,
          backendUrl: targetBackend,
          error: `Backend returned HTTP ${res.status}`,
        },
        { status: 200 } // Return 200 so admin UI can render status card
      );
    }

    const data = await res.json();
    return NextResponse.json({
      status: "connected",
      latencyMs,
      backendUrl: targetBackend,
      configuredBackend: BACKEND_URL,
      details: data,
    });
  } catch (err: any) {
    const latencyMs = Date.now() - start;
    return NextResponse.json(
      {
        status: "unreachable",
        latencyMs,
        backendUrl: targetBackend,
        configuredBackend: BACKEND_URL,
        error: err?.message || "Failed to reach backend",
      },
      { status: 200 }
    );
  }
}
