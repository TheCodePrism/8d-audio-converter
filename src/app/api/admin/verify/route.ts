import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const ADMIN_SECRET = process.env.ADMIN_SECRET_KEY || "sphere8d-admin-2025";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { key } = body || {};

    if (!key || typeof key !== "string") {
      return NextResponse.json(
        { success: false, error: "Passphrase is required." },
        { status: 400 }
      );
    }

    if (key.trim() === ADMIN_SECRET.trim()) {
      return NextResponse.json({ success: true, message: "Authorized" });
    }

    return NextResponse.json(
      { success: false, error: "Invalid administrative passphrase. Access denied." },
      { status: 401 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Verification failed." },
      { status: 500 }
    );
  }
}
