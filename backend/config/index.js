module.exports = {
  PORT: process.env.PORT || 3001,
  DEFAULT_INVIDIOUS_INSTANCES: [
    "inv.tux.pizza",
    "invidious.drgns.space",
    "invidious.asir.dev",
    "yewtu.be",
    "invidious.lunar.icu",
    "invidious.private.coffee",
    "invidious.jing.rocks",
    "invidious.privacydev.net",
    "iv.melmac.space",
    "yt.chocolatemoo53.com",
    "invidious.nerdvpn.de",
    "inv.nadeko.net",
  ],
  INVIDIOUS_POOL_SYNC_MS: 20 * 60 * 1000, // 20 minutes
  INVIDIOUS_RACE_TIMEOUT_MS: 10000,
  YTDLP_EXTRACT_TIMEOUT_MS: 60000,
};
