# 8D Audio Converter 🎧

Transform standard stereo or mono audio tracks into an immersive 8D spatial audio experience with client-side 360° binaural rotation, bass boost, and room reverberation.

This web application operates **100% in the user's browser** via the Web Audio API (`OfflineAudioContext`) with zero server uploads—ensuring complete privacy and fast processing.

---

## ✨ Features

- 🎧 **True 360° HRTF Binaural Spatialization**: Simulates realistic head-related acoustic filtering so sound travels continuously in front, behind, and around your head.
- 🎛️ **Audio Presets & Custom Sliders**:
  - **Presets**: Classic 8D, Slow Ambient, Fast & Dynamic, and Deep Bass Orbit.
  - **Customizable Controls**: Orbit speed (seconds/rev), Low-end bass boost (dB), Spatial reverb room depth (%), and Orbit direction (Clockwise / Counter-Clockwise).
- 📡 **Interactive 3D Orbit Radar Visualizer**: Real-time canvas radar showing the exact 360° position of the audio source orbiting the listener's head.
- 🔄 **Live A/B Audio Comparison**: Compare the original flat audio track side-by-side with the converted 8D track before downloading.
- 🔒 **100% Client-Side & Private**: No audio files are uploaded to remote servers. All DSP rendering is performed locally in browser memory.
- ⬇️ **Lossless 16-bit PCM WAV Export**: Download full fidelity, uncompressed stereo WAV audio.

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ (tested on Node v22)
- npm, yarn, or pnpm

### Installation

```bash
git clone https://github.com/TheCodePrism/8d-audio-converter.git
cd 8d-audio-converter
npm install
```

### Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

### Build for Production

```bash
npm run build
npm run start
```

---

## 🛠️ Technical Stack

- **Framework**: [Next.js 15 (App Router)](https://nextjs.org/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Audio DSP Engine**: [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) (`OfflineAudioContext`, `PannerNode` with HRTF, `ConvolverNode`, `BiquadFilterNode`, `DynamicsCompressorNode`)
- **Icons**: [Lucide React](https://lucide.dev/)

---

## 🎧 Best Practices for Listening

1. **Always wear headphones or earbuds** — 8D audio relies on independent stereo channels delivered directly to each ear. Playing through external speakers mixes the stereo channels acoustically in the room and diminishes the effect.
2. Keep your volume at a comfortable, moderate level.

---

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).
