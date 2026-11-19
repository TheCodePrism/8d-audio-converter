const express = require("express");
const cors = require("cors");
const { PORT } = require("./config");
const { getYtDlpPath } = require("./utils/binaries");
const { getProxyArgs, getCookieArgs } = require("./utils/auth");
const { refreshInvidiousPool } = require("./services/invidious");
const healthRoutes = require("./routes/health");
const youtubeRoutes = require("./routes/youtube");

const app = express();

app.use(cors());
app.use(express.json());

// Mount modular routes
app.use(healthRoutes);
app.use(youtubeRoutes);

// Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✓ 8D Audio backend running on port ${PORT}`);
  console.log(`✓ yt-dlp binary: ${getYtDlpPath()}`);
  console.log(`✓ Proxy configured: ${getProxyArgs().length > 0 ? "YES" : "NO"}`);
  console.log(`✓ YouTube cookies: ${getCookieArgs().length > 0 ? "YES" : "NO"}`);

  // Fetch verified healthy Invidious instances on boot
  refreshInvidiousPool().catch(() => {});
});
