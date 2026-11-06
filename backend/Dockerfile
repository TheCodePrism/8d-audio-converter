# ---- Build stage (install deps) ----
FROM node:20-bookworm-slim AS builder

WORKDIR /app
COPY package.json ./
RUN npm install --production

# ---- Runtime stage ----
FROM node:20-bookworm-slim AS runner

# Install ffmpeg, ca-certificates, python3, deno, and latest nightly yt-dlp with curl-cffi for Chrome TLS impersonation
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    unzip \
    ffmpeg \
    ca-certificates \
    python3 \
    python3-pip \
    && curl -fsSL https://deno.land/install.sh | sh \
    && mv /root/.deno/bin/deno /usr/local/bin/deno \
    && chmod a+rx /usr/local/bin/deno \
    && pip3 install --no-cache-dir --break-system-packages -U --pre "yt-dlp[default,curl-cffi]" \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY . .

ENV PORT=3001
ENV NODE_ENV=production

EXPOSE 3001

CMD ["node", "server.js"]

