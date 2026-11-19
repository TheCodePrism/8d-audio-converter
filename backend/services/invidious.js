const { Readable } = require("stream");
const { DEFAULT_INVIDIOUS_INSTANCES, INVIDIOUS_POOL_SYNC_MS, INVIDIOUS_RACE_TIMEOUT_MS } = require("../config");

let liveInvidiousInstances = [
  ...(process.env.INVIDIOUS_INSTANCE ? [process.env.INVIDIOUS_INSTANCE.trim()] : []),
  ...(process.env.INVIDIOUS_HOSTS
    ? process.env.INVIDIOUS_HOSTS.split(",").map((s) => s.trim()).filter(Boolean)
    : []),
  ...DEFAULT_INVIDIOUS_INSTANCES,
];

/**
 * Fetches verified healthy Invidious API instances from the official registry.
 */
async function refreshInvidiousPool() {
  try {
    const res = await fetch("https://api.invidious.io/instances.json?sort_by=health", {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) {
      const data = await res.json();
      const healthy = data
        .filter(([, meta]) => meta.type === "https" && meta.api === true && !meta.monitor?.down)
        .map(([host]) => host);
      if (healthy.length > 0) {
        liveInvidiousInstances = Array.from(new Set([...healthy, ...liveInvidiousInstances]));
        console.log(`[Invidious Pool] Live instances synced (${healthy.length} verified live API instances).`);
      }
    }
  } catch {
    // Keep fallback list
  }
}

// Refresh pool periodically
setInterval(refreshInvidiousPool, INVIDIOUS_POOL_SYNC_MS).unref();

function getLiveInstances() {
  return [...liveInvidiousInstances];
}

/**
 * Races Invidious instances in parallel; returns the first one that responds
 * with a valid audio stream, immediately aborting the remaining in-flight requests.
 */
async function getInvidiousAudioInfo(videoId) {
  const controller = new AbortController();
  const overallTimeout = setTimeout(() => controller.abort(), INVIDIOUS_RACE_TIMEOUT_MS);

  const fetchInstance = async (instance) => {
    const apiUrl = `https://${instance}/api/v1/videos/${videoId}`;
    const start = Date.now();
    try {
      const apiRes = await fetch(apiUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        },
      });
      if (!apiRes.ok) {
        throw new Error(`${instance} returned HTTP ${apiRes.status} (${Date.now() - start}ms)`);
      }
      const data = await apiRes.json();
      if (data.error) {
        throw new Error(`${instance} returned error: ${data.error} (${Date.now() - start}ms)`);
      }

      const formats = data.adaptiveFormats || [];
      // Prefer itag 140 (m4a 128kbps), then 251 (opus), then any audio format
      const preferredItags = ["140", "251", "250", "249", "139"];
      let audio = preferredItags
        .map((itag) => formats.find((f) => String(f.itag) === itag && f.url))
        .find(Boolean);
      if (!audio) {
        audio = formats.find((f) => f.type?.startsWith("audio/") && f.url);
      }
      if (!audio?.url) {
        throw new Error(`${instance} has no usable audio format (${Date.now() - start}ms)`);
      }

      const audioUrl = new URL(audio.url);
      const proxyUrl = `https://${instance}/videoplayback${audioUrl.search}`;
      const contentType = audio.type?.split(";")[0] || "audio/mp4";

      return {
        proxyUrl,
        contentType,
        instance,
        itag: audio.itag,
        elapsedMs: Date.now() - start,
      };
    } catch (err) {
      throw err;
    }
  };

  const pool = liveInvidiousInstances.slice(0, 10);
  try {
    console.log(`[Invidious] Racing ${pool.length} instances in parallel for videoId=${videoId}...`);
    const winner = await Promise.any(pool.map((instance) => fetchInstance(instance)));
    clearTimeout(overallTimeout);
    controller.abort(); // Cancel remaining requests

    console.log(
      `[Invidious] ✓ Fastest instance won: ${winner.instance} in ${winner.elapsedMs}ms (itag=${winner.itag}, type=${winner.contentType})`
    );
    return winner;
  } catch {
    clearTimeout(overallTimeout);
    console.warn(`[Invidious] All parallel instances failed or timed out for videoId=${videoId}.`);
    return null;
  }
}

/**
 * Pipes proxied audio stream to Express response.
 */
async function pipeInvidiousStream(proxyUrl, instance, contentType, req, res) {
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    Referer: `https://${instance}/`,
  };
  if (req.headers.range) {
    headers["Range"] = req.headers.range;
  }

  const streamRes = await fetch(proxyUrl, {
    redirect: "follow",
    headers,
    signal: AbortSignal.timeout(30000),
  });

  if (streamRes.status !== 200 && streamRes.status !== 206) {
    throw new Error(`Invidious stream returned HTTP ${streamRes.status}`);
  }

  const resType = streamRes.headers.get("content-type") || "";
  if (
    !resType.includes("audio") &&
    !resType.includes("video") &&
    !resType.includes("octet-stream")
  ) {
    throw new Error(`Invidious stream returned non-audio Content-Type: ${resType}`);
  }

  res.setHeader("Content-Type", resType || contentType || "audio/mp4");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Access-Control-Allow-Origin", "*");
  const cl = streamRes.headers.get("content-length");
  if (cl) res.setHeader("Content-Length", cl);
  const cr = streamRes.headers.get("content-range");
  if (cr) res.setHeader("Content-Range", cr);

  res.status(streamRes.status);

  const nodeStream = Readable.fromWeb(streamRes.body);
  nodeStream.pipe(res);

  return new Promise((resolve, reject) => {
    nodeStream.on("end", () => resolve(true));
    nodeStream.on("error", (err) => {
      console.error("[Invidious Stream Error]:", err);
      reject(err);
    });
    req.on("close", () => {
      nodeStream.destroy();
    });
  });
}

module.exports = {
  getLiveInstances,
  refreshInvidiousPool,
  getInvidiousAudioInfo,
  pipeInvidiousStream,
};
