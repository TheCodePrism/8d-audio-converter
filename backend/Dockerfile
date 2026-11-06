# ---- Build stage (install deps) ----
FROM node:20-bookworm-slim AS builder

WORKDIR /app
COPY package.json ./
RUN npm install --production

# ---- Runtime stage ----
FROM node:20-bookworm-slim AS runner

# Install ffmpeg, yt-dlp, python3
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ffmpeg \
    ca-certificates \
    python3 \
    && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
       -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY . .

ENV PORT=3001
ENV NODE_ENV=production

EXPOSE 3001

CMD ["node", "server.js"]

