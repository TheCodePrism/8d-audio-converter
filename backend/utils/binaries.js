const path = require("path");
const { existsSync } = require("fs");

/**
 * Resolves the path to the yt-dlp binary across various environments
 * (local project /bin, system PATH, or Docker /usr/local/bin).
 */
function getYtDlpPath() {
  const candidates = [
    path.join(__dirname, "..", "..", "bin", "yt-dlp.exe"),
    path.join(__dirname, "..", "..", "bin", "yt-dlp"),
    path.join(process.cwd(), "bin", "yt-dlp.exe"),
    path.join(process.cwd(), "bin", "yt-dlp"),
    "/usr/local/bin/yt-dlp",
    "/usr/bin/yt-dlp",
  ];

  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return "yt-dlp"; // Fallback to PATH
}

module.exports = {
  getYtDlpPath,
};
