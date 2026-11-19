const path = require("path");
const fs = require("fs");

/**
 * Parses and verifies YouTube cookies provided via environment variables.
 * Writes verified Netscape format cookies to a temporary file.
 */
function getCookieArgs() {
  const envCookie =
    process.env.YOUTUBE_COOKIES ||
    process.env.COOKIES ||
    process.env.YT_COOKIES;

  if (envCookie) {
    const tmpCookies = path.join(process.env.TEMP || "/tmp", "yt_cookies.txt");
    try {
      let raw = envCookie.trim();
      // Strip outer quotes if pasted with quotes
      if (
        (raw.startsWith('"') && raw.endsWith('"')) ||
        (raw.startsWith("'") && raw.endsWith("'"))
      ) {
        raw = raw.slice(1, -1);
      }

      // Support base64 encoded cookies.txt
      if (raw.startsWith("I05ldHNjYXBl")) {
        try {
          raw = Buffer.from(raw, "base64").toString("utf8");
        } catch {}
      }

      // Handle literal escaped newlines (\n) from env var entry
      const cookieData =
        raw.includes("\\n") && !raw.includes("\n")
          ? raw.replace(/\\n/g, "\n")
          : raw;

      // Only pass cookies if it contains legitimate Netscape cookie lines
      if (
        cookieData.length > 50 &&
        (cookieData.includes(".youtube.com") || cookieData.includes("# Netscape"))
      ) {
        fs.writeFileSync(tmpCookies, cookieData, "utf8");
        console.log("[YouTube Auth] Successfully wrote temporary cookies to", tmpCookies);
        return ["--cookies", tmpCookies];
      } else {
        console.warn(
          "[YouTube Auth] Environment cookie detected but failed validation checks (too short or missing Netscape/youtube headers). Ignoring."
        );
      }
    } catch (err) {
      console.error("[YouTube Auth] Failed to write temporary cookies file:", err);
    }
  }

  return [];
}

/**
 * Returns proxy arguments for yt-dlp if configured via environment variables.
 */
function getProxyArgs() {
  const proxy =
    process.env.YT_PROXY ||
    process.env.YOUTUBE_PROXY ||
    process.env.HTTP_PROXY ||
    process.env.HTTPS_PROXY ||
    process.env.ALL_PROXY;

  if (proxy && proxy.trim().length > 4) {
    return ["--proxy", proxy.trim()];
  }
  return [];
}

module.exports = {
  getCookieArgs,
  getProxyArgs,
};
