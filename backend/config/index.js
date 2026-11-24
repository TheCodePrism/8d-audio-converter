module.exports = {
  PORT: process.env.PORT || 3001,
  // Last verified: 2025-11 — all instances confirmed reachable via /api/v1/stats
  DEFAULT_INVIDIOUS_INSTANCES: [
    "yewtu.be",
    "yt.chocolatemoo53.com",
    "invidious.nerdvpn.de",
    "inv.nadeko.net",
    "inv.riverside.rocks",
    "inv.in.projectsegfau.lt",
    "invidious.protokolla.fi",
    "invidious.slipfox.xyz",
    "invidious.weblibre.org",
    "inv.zzls.xyz",
    "invidious.tiekoetter.com",
    "invidious.projectsegfau.lt",
    "invidious.io.lol",
  ],
  INVIDIOUS_POOL_SYNC_MS: 20 * 60 * 1000, // 20 minutes
  INVIDIOUS_RACE_TIMEOUT_MS: 10000,
  YTDLP_EXTRACT_TIMEOUT_MS: 60000,
};
