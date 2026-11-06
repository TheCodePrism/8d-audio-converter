# 8D Audio Studio & Spatial Music Player 🎧⚡

Transform standard stereo or mono songs into an immersive **8D spatial audio experience** with real-time 360° binaural rotation, room reverberation, sub-bass enhancement, and a dedicated music player deck.

Built with Next.js, Web Audio API (HRTF model), Tailwind CSS, and a standalone Express + `yt-dlp` backend service for YouTube streaming.

---

## ✨ Key Features

### 🎵 1. Spatial Music Player Deck
- **360° HRTF Radar HUD**: Canvas-driven visualizer displaying real-time azimuth coordinates ($0^\circ - 360^\circ$), L/R ear balance meters, and acoustic ripple pulses synced to the audio playback.
- **Spinning Vinyl Record**: Realistic vinyl groove animation with album artwork that responds dynamically to playback state.
- **Instant A/B Spatial Switch**: Toggle seamlessly between **8D Spatial Audio** and the **Original Stereo Mix** during playback to immediately evaluate the acoustic difference without losing track progress.
- **Full Player Transport**:
  - Scrub bar with gradient progress tracking
  - Shuffle, Repeat/Loop, Rewind 10s, Forward 10s, Previous, Next
  - Center glowing Play/Pause button
  - Volume slider with one-click Mute/Unmute toggle

### 🎛️ 2. 8D Spatial Audio Engine (DSP)
- **True 360° HRTF Binaural Spatialization**: Uses Web Audio API's `PannerNode` configured with the **HRTF** (Head-Related Transfer Function) panning model, simulating real-world Interaural Time Difference (ITD) and Interaural Level Difference (ILD) ear delays.
- **Concert Room Reverb**: Parallel dry/wet gain routing with a synthetic stereo impulse response simulating early wall reflections and diffuse decay.
- **Low-End Sub-Bass Boost**: Symmetric `lowshelf` biquad filter boosting deep sub-bass frequencies (20Hz - 160Hz) up to +12 dB.
- **Instant Presets**:
  - **Classic 8D**: Balanced 12s orbit with natural acoustic room reverb.
  - **Slow Ambient**: Relaxed 20s orbit with concert-hall reverberation.
  - **Fast & Dynamic**: Energetic 7s orbit with punchy bass.
  - **Deep Bass Orbit**: Counter-clockwise 10s rotation with heavy +8dB low-end emphasis.

### 📥 3. Flexible Music Importer & Queue
- **Local Audio Upload**: Drag-and-drop support for MP3, WAV, OGG, M4A, and FLAC (up to 50MB).
- **YouTube URL & Playlist Converter**: Paste any YouTube song or playlist link. The server proxies the audio stream and imports it directly into your queue.
- **✨ Instant In-Browser Demo Synthesizer**: Generates a rich stereo ambient synthwave track in 0.5s via Web Audio API—allowing instant testing without uploading files.
- **Track Queue Manager**: Play any track, batch convert, re-convert with updated parameters, and download 16-bit PCM WAV masters.

### 🔒 4. 100% Client-Side Privacy
- All audio processing, decoding, and WAV encoding are executed locally inside the browser memory via `OfflineAudioContext`.
- Local audio files **never leave the user's device**.

---

## 🏛️ System Architecture

The project is structured into a lightweight Next.js frontend (deployed on Vercel) and an optional containerized backend (deployed on Render or Railway) for YouTube stream extraction:

```
┌─────────────────────────────────┐        ┌──────────────────────────────────┐
│  VERCEL (Frontend)              │        │  RENDER / RAILWAY (Backend)      │
│                                 │        │                                  │
│  Next.js 15 App                 │───────▶│  Express + yt-dlp + ffmpeg       │
│  ├─ UI & 3D Radar Visualizer    │  HTTP  │  ├─ POST /youtube/info           │
│  ├─ In-Browser DSP Engine       │ Proxy  │  └─ GET  /youtube/stream         │
│  ├─ /api/youtube/info (proxy)   │        │                                  │
│  └─ /api/youtube/stream (proxy) │        │  Runs in Linux Docker container  │
└─────────────────────────────────┘        └──────────────────────────────────┘
```

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- [Node.js](https://nodejs.org/) v20 or v22
- [Git](https://git-scm.com/)

### 1. Clone the Repository
```bash
git clone https://github.com/TheCodePrism/8d-audio-converter.git
cd 8d-audio-converter
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Run the Next.js Frontend
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📦 Backend Setup (for YouTube Features)

If you wish to use the YouTube video/playlist import functionality locally or in production:

### Running Backend Locally
```bash
cd backend
npm install
node server.js
```
The backend will start on port `3001`.

### Configure Frontend Environment Variable
In the root project directory, create a `.env.local` file:
```env
YOUTUBE_BACKEND_URL=http://localhost:3001
```

---

## 🌐 Production Deployment

### Option A: Frontend on Vercel
1. Import this repository in [Vercel](https://vercel.com).
2. Set **Node.js Version** to `22.x` in Project Settings.
3. Add the Environment Variable:
   - `YOUTUBE_BACKEND_URL`: `https://your-backend.onrender.com`
4. Click **Deploy**.

### Option B: Backend on Render
1. Create a new **Web Service** on [Render](https://render.com).
2. Connect this repository and set:
   - **Root Directory**: `backend`
   - **Environment**: `Docker`
   - **Instance Type**: `Free`
3. Click **Create Web Service** and copy the assigned URL into your Vercel `YOUTUBE_BACKEND_URL`.

---

## 🛠️ Technology Stack

| Category | Technologies |
|---|---|
| **Frontend Framework** | Next.js 15 (App Router), React 19, TypeScript |
| **Styling** | Tailwind CSS, Radix UI, Lucide Icons |
| **Audio DSP** | Web Audio API (`OfflineAudioContext`, `PannerNode` HRTF, `ConvolverNode`, `BiquadFilterNode`) |
| **Backend Service** | Node.js, Express, `yt-dlp`, FFmpeg |
| **Containers** | Docker multi-stage build |

---

## 🎧 Best Practices for Listening

1. **Always wear headphones or earbuds** — 8D audio relies on independent stereo channels delivered directly to each ear. External speakers mix the stereo channels acoustically in the room and diminish the binaural illusion.
2. Keep the volume at a comfortable listening level.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
