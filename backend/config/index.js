module.exports = {
  PORT: process.env.PORT || 3001,
  DEFAULT_INVIDIOUS_INSTANCES: [
    "yt.chocolatemoo53.com",
    "invidious.projectsegfau.lt",
    "invidious.drgns.space",
    "invidious.schenkl.is",
    "invidious.f5.si",
    "invidious.protokolla.fi",
    "invidious.jing.rocks",
  ],
  INVIDIOUS_POOL_SYNC_MS: 30 * 60 * 1000, // 30 minutes
  INVIDIOUS_RACE_TIMEOUT_MS: 12000,
  YTDLP_EXTRACT_TIMEOUT_MS: 60000,
};
