import { NextRequest, NextResponse } from "next/server";

const ADMIN_SECRET = process.env.ADMIN_SECRET_KEY ?? "sphere8d-admin-2025";

export async function POST(req: NextRequest) {
  // Auth check
  const key = req.headers.get("x-admin-key");
  if (!key || key !== ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const instances: string[] = Array.isArray(body.instances) ? body.instances : [];

  if (instances.length === 0) {
    return NextResponse.json({ error: "No instances provided" }, { status: 400 });
  }

  // Ping all instances in parallel from the server (no CORS restrictions)
  const results = await Promise.all(
    instances.map(async (inst: string) => {
      const start = Date.now();
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const res = await fetch(`https://${inst}/api/v1/stats`, {
          signal: controller.signal,
          headers: { "User-Agent": "Sphere8D-Admin-Probe/1.0" },
        });

        clearTimeout(timeout);
        const latency = Date.now() - start;

        return {
          instance: inst,
          status: res.status,
          latency,
          ok: res.status === 200,
        };
      } catch (err: any) {
        return {
          instance: inst,
          status: 0,
          latency: Date.now() - start,
          ok: false,
          error: err?.name === "AbortError" ? "timeout" : "unreachable",
        };
      }
    })
  );

  return NextResponse.json({ results });
}
