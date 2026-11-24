import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BACKEND_URL = process.env.YOUTUBE_BACKEND_URL?.replace(/\/+$/, "") || "http://localhost:3001";
const ADMIN_SECRET = process.env.ADMIN_SECRET_KEY || "sphere8d-admin-2025";

export async function POST(req: NextRequest) {
  try {
    const adminKey = req.headers.get("x-admin-key");
    if (adminKey !== ADMIN_SECRET) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Invalid or missing admin access key." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { url, backendUrl } = body;
    const targetBackend = (backendUrl || BACKEND_URL).replace(/\/+$/, "");

    const probeRes = await fetch(`${targetBackend}/admin/probe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-key": adminKey,
      },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(20000),
    });

    const data = await probeRes.json();
    return NextResponse.json(data, { status: probeRes.status });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err?.message || "Failed to reach backend for probe diagnostics",
        logs: [`[Exception] ${err?.message}`],
      },
      { status: 500 }
    );
  }
}
