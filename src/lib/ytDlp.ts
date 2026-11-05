import path from "path";
import fs from "fs";

/**
 * Returns the path to the yt-dlp executable.
 * Prioritizes local project bin directory before falling back to system PATH.
 */
export function getYtDlpPath(): string {
  const isWindows = process.platform === "win32";
  const binaryName = isWindows ? "yt-dlp.exe" : "yt-dlp";

  // Check project root /bin
  const localBin = path.join(process.cwd(), "bin", binaryName);
  if (fs.existsSync(localBin)) {
    return localBin;
  }

  // Fallback to system PATH
  return "yt-dlp";
}

