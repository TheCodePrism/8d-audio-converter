# ---- Build stage (install deps) ----
FROM node:20-bookworm-slim AS builder

WORKDIR /app
COPY package.json ./
RUN npm install --production

# ---- Runtime stage ----
FROM node:20-bookworm-slim AS runner

# Install ffmpeg, ca-certificates, python3, curl, and unzip
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    unzip \
    ffmpeg \
    ca-certificates \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Install Deno (Official recommended JS challenge solver runtime for yt-dlp)
ENV DENO_INSTALL="/usr/local"
ENV PATH="${DENO_INSTALL}/bin:${PATH}"
RUN curl -fsSL https://deno.land/install.sh | sh

# Install yt-dlp-ejs challenge solver package & latest yt-dlp with curl-cffi
RUN npm install -g yt-dlp-ejs \
    && pip3 install --no-cache-dir --break-system-packages -U --pre "yt-dlp[default,curl-cffi]"

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY . .

ENV PORT=3001
ENV NODE_ENV=production

EXPOSE 3001

CMD ["node", "server.js"]

