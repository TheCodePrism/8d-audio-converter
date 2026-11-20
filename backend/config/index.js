module.exports = {
  PORT: process.env.PORT || 3001,
  DEFAULT_INVIDIOUS_INSTANCES: [
    "yt.chocolatemoo53.com",
    "invidious.nerdvpn.de",
    "inv.nadeko.net",
  ],
  INVIDIOUS_POOL_SYNC_MS: 30 * 60 * 1000, // 30 minutes
  INVIDIOUS_RACE_TIMEOUT_MS: 10000,
  YTDLP_EXTRACT_TIMEOUT_MS: 60000,
};
