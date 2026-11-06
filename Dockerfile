# Production Dockerfile for 8D Audio Converter with yt-dlp & FFmpeg
FROM node:20-bookworm-slim AS base

# Install system dependencies: ffmpeg, Python3, and the latest yt-dlp binary
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ffmpeg \
    ca-certificates \
    python3 \
    && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies based on package-lock.json
COPY package*.json ./
RUN npm ci

# Copy application source code
COPY . .

# Set environment variables for production build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build the Next.js application
RUN npm run build

# Expose default port (Railway automatically injects and maps $PORT)
EXPOSE 3000

# Start the Next.js production server
CMD ["npm", "run", "start"]

