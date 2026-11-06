import { AudioProcessingOptions, Preset } from "@/types";

export const DEFAULT_OPTIONS: AudioProcessingOptions = {
  rotationSpeed: 12, // 12 seconds per full revolution
  reverbLevel: 0.15, // 15% wet reverb
  bassBoost: 4, // +4 dB bass boost
  direction: "clockwise",
  spatialRadius: 2.5,
};

export const PRESETS: Preset[] = [
  {
    id: "classic-8d",
    name: "Classic 8D",
    description: "Balanced rotation speed with immersive spatial reverb and moderate bass boost.",
    options: {
      rotationSpeed: 12,
      reverbLevel: 0.15,
      bassBoost: 4,
      direction: "clockwise",
      spatialRadius: 2.5,
    },
  },
  {
    id: "slow-ambient",
    name: "Slow Ambient",
    description: "Relaxed 20s orbit with spacious concert-hall reverberation.",
    options: {
      rotationSpeed: 20,
      reverbLevel: 0.28,
      bassBoost: 3,
      direction: "clockwise",
      spatialRadius: 3.2,
    },
  },
  {
    id: "fast-intense",
    name: "Fast & Dynamic",
    description: "Fast 7s orbit with tight room reverb and punchy bass.",
    options: {
      rotationSpeed: 7,
      reverbLevel: 0.12,
      bassBoost: 6,
      direction: "clockwise",
      spatialRadius: 2.2,
    },
  },
  {
    id: "bass-heavy",
    name: "Deep Bass Orbit",
    description: "Heavy low-end emphasis (+8dB) with counter-clockwise rotation.",
    options: {
      rotationSpeed: 10,
      reverbLevel: 0.10,
      bassBoost: 8,
      direction: "counter-clockwise",
      spatialRadius: 2.0,
    },
  },
];

/**
 * Generate a synthetic stereo impulse response for spatial room simulation.
 */
function createSpatialImpulseResponse(
  context: BaseAudioContext,
  durationSeconds = 1.6,
  decayFactor = 2.4
): AudioBuffer {
  const sampleRate = context.sampleRate;
  const length = Math.floor(sampleRate * durationSeconds);
  const impulse = context.createBuffer(2, length, sampleRate);

  const leftChannel = impulse.getChannelData(0);
  const rightChannel = impulse.getChannelData(1);

  // Early reflection points (simulates acoustic reflections from nearby room surfaces)
  const reflections = [
    { delay: Math.floor(sampleRate * 0.012), gain: 0.65 },
    { delay: Math.floor(sampleRate * 0.024), gain: -0.45 },
    { delay: Math.floor(sampleRate * 0.041), gain: 0.35 },
    { delay: Math.floor(sampleRate * 0.063), gain: -0.25 },
  ];

  for (let i = 0; i < length; i++) {
    const t = i / length;
    const env = Math.exp(-decayFactor * t);

    // Diffuse reverberation tail
    leftChannel[i] = (Math.random() * 2 - 1) * env * 0.4;
    rightChannel[i] = (Math.random() * 2 - 1) * env * 0.4;
  }

  // Inject early reflections
  for (const { delay, gain } of reflections) {
    if (delay < length) {
      leftChannel[delay] += gain;
      rightChannel[delay + 16] += gain * 0.9;
    }
  }

  return impulse;
}

/**
 * Process audio buffer through the 8D spatial audio DSP pipeline using OfflineAudioContext.
 */
export async function process8DAudio(
  audioBuffer: AudioBuffer,
  options: AudioProcessingOptions = DEFAULT_OPTIONS
): Promise<AudioBuffer> {
  const sampleRate = audioBuffer.sampleRate;
  const duration = audioBuffer.duration;
  const length = audioBuffer.length;

  // Initialize offline rendering context for 2-channel stereo output
  const offlineContext = new OfflineAudioContext(2, length, sampleRate);

  // 1. Source node
  const source = offlineContext.createBufferSource();
  source.buffer = audioBuffer;

  // 2. Symmetric Bass Booster (Lowshelf Filter)
  const bassFilter = offlineContext.createBiquadFilter();
  bassFilter.type = "lowshelf";
  bassFilter.frequency.value = 95;
  bassFilter.gain.value = Math.max(0, Math.min(12, options.bassBoost));

  // 3. 3D Spatial Panning Node (HRTF)
  const panner = offlineContext.createPanner();
  panner.panningModel = "HRTF";
  panner.distanceModel = "inverse";
  panner.refDistance = 1;
  panner.maxDistance = 10000;
  panner.rolloffFactor = 1;
  panner.coneInnerAngle = 360;

  // 4. Parallel Dry & Wet (Reverb) Routing
  const dryGain = offlineContext.createGain();
  const wetGain = offlineContext.createGain();
  const reverbMixer = offlineContext.createGain();

  const wetLevel = Math.max(0, Math.min(0.5, options.reverbLevel));
  dryGain.gain.value = 1.0 - wetLevel * 0.4; // Maintain direct signal clarity
  wetGain.gain.value = wetLevel * 0.9;

  // Convolver for spatial reverb
  const convolver = offlineContext.createConvolver();
  convolver.buffer = createSpatialImpulseResponse(offlineContext);

  // 5. Dynamics Compressor (Prevents distortion and keeps volume level balanced)
  const compressor = offlineContext.createDynamicsCompressor();
  compressor.threshold.value = -18;
  compressor.knee.value = 30;
  compressor.ratio.value = 8;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.2;

  // --- Graph Connections ---
  // source -> bassFilter
  source.connect(bassFilter);

  // bassFilter -> panner (audio rotates in space)
  bassFilter.connect(panner);

  // panner -> dry branch
  panner.connect(dryGain);
  dryGain.connect(compressor);

  // panner -> wet branch (reverb)
  panner.connect(wetGain);
  wetGain.connect(convolver);
  convolver.connect(compressor);

  // compressor -> destination
  compressor.connect(offlineContext.destination);

  // --- Dynamic 360-Degree Circular Orbit Automation ---
  const speed = Math.max(3, options.rotationSpeed);
  const radius = Math.max(1, options.spatialRadius);
  const dirMultiplier = options.direction === "counter-clockwise" ? -1 : 1;

  // Schedule smooth HRTF orbit coordinates using linear ramps
  const stepInterval = 0.05; // 20 trajectory updates per second
  const hasAudioParamPosition =
    panner.positionX && typeof panner.positionX.setValueAtTime === "function";

  if (hasAudioParamPosition) {
    panner.positionY.setValueAtTime(0, 0);

    for (let t = 0; t < duration; t += stepInterval) {
      const angle = dirMultiplier * ((2 * Math.PI * t) / speed);
      const x = radius * Math.sin(angle);
      const z = -radius * Math.cos(angle);

      if (t === 0) {
        panner.positionX.setValueAtTime(x, 0);
        panner.positionZ.setValueAtTime(z, 0);
      } else {
        panner.positionX.linearRampToValueAtTime(x, t);
        panner.positionZ.linearRampToValueAtTime(z, t);
      }
    }
  } else {
    // Fallback for older Web Audio implementations
    for (let t = 0; t < duration; t += stepInterval) {
      const angle = dirMultiplier * ((2 * Math.PI * t) / speed);
      const x = radius * Math.sin(angle);
      const z = -radius * Math.cos(angle);
      (panner as any).setPosition(x, 0, z);
    }
  }

  // Start playback and render offline
  source.start(0);
  return await offlineContext.startRendering();
}

/**
 * Converts a Float32 AudioBuffer to a valid standard 16-bit PCM stereo WAV Blob.
 */
export function float32ToWav(audioBuffer: AudioBuffer): Blob {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const length = audioBuffer.length;
  const bytesPerSample = 2; // 16-bit PCM
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataByteCount = length * blockAlign;
  const totalBufferSize = 44 + dataByteCount;

  const arrayBuffer = new ArrayBuffer(totalBufferSize);
  const view = new DataView(arrayBuffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  // RIFF Chunk Descriptor
  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataByteCount, true);
  writeString(8, "WAVE");

  // "fmt " Sub-chunk
  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // BitsPerSample

  // "data" Sub-chunk
  writeString(36, "data");
  view.setUint32(40, dataByteCount, true);

  // Write Interleaved 16-bit PCM Audio Samples
  const channelData: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channelData.push(audioBuffer.getChannelData(ch));
  }

  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      // Soft-clip and scale float sample [-1.0, 1.0] to 16-bit signed integer [-32768, 32767]
      const sample = Math.max(-1, Math.min(1, channelData[ch][i]));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, Math.floor(intSample), true);
      offset += 2;
    }
  }

  return new Blob([view], { type: "audio/wav" });
}

/**
 * Synthesizes a demo ambient synthwave track directly in the browser
 * so users can test 8D audio immediately without uploading a file.
 */
export function generateDemoAudioBuffer(sampleRate = 44100, duration = 16): AudioBuffer {
  // Use OfflineAudioContext to synthesize a rich stereo track
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({
    sampleRate,
  });
  const numSamples = Math.floor(sampleRate * duration);
  const buffer = ctx.createBuffer(2, numSamples, sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  // Chord progression frequencies (Hz): Cmaj7, Am7, Fmaj7, G6
  const chords = [
    [261.63, 329.63, 392.00, 493.88], // C, E, G, B
    [220.00, 261.63, 329.63, 392.00], // A, C, E, G
    [174.61, 220.00, 261.63, 329.63], // F, A, C, E
    [196.00, 246.94, 293.66, 392.00], // G, B, D, G
  ];
  const bassNotes = [130.81, 110.00, 87.31, 98.00];

  const chordDuration = duration / chords.length;

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const chordIndex = Math.min(chords.length - 1, Math.floor(t / chordDuration));
    const chordTime = t % chordDuration;
    const chord = chords[chordIndex];
    const bass = bassNotes[chordIndex];

    // Envelope for chords
    const chordEnv = Math.min(1, chordTime * 3) * Math.exp(-chordTime * 0.4);

    // Warm bass tone
    const bassTone = Math.sin(2 * Math.PI * bass * t) * 0.25 * (1 + 0.5 * Math.sin(2 * Math.PI * (bass * 0.5) * t));

    // Pad chords with subtle detune
    let padL = 0;
    let padR = 0;
    for (let c = 0; c < chord.length; c++) {
      const freq = chord[c];
      const osc1 = Math.sin(2 * Math.PI * freq * t);
      const osc2 = Math.sin(2 * Math.PI * (freq * 1.003) * t);
      padL += osc1 * 0.08 * chordEnv;
      padR += osc2 * 0.08 * chordEnv;
    }

    // Gentle arpeggio pulse
    const arpRate = 4; // 4 notes per second
    const arpIndex = Math.floor(t * arpRate) % chord.length;
    const arpFreq = chord[arpIndex] * 2;
    const arpTime = (t * arpRate) % 1;
    const arpEnv = Math.exp(-arpTime * 8);
    const arpValue = Math.sin(2 * Math.PI * arpFreq * t) * 0.12 * arpEnv;
    const arpPan = Math.sin(2 * Math.PI * 0.5 * t); // sweeps L/R

    // Mix stereo channels
    left[i] = padL + bassTone * 0.5 + arpValue * (0.5 - arpPan * 0.4);
    right[i] = padR + bassTone * 0.5 + arpValue * (0.5 + arpPan * 0.4);

    // Overall fade in and fade out
    const fadeIn = Math.min(1, t / 1.5);
    const fadeOut = Math.min(1, (duration - t) / 2.0);
    const masterEnv = fadeIn * fadeOut;

    left[i] *= masterEnv;
    right[i] *= masterEnv;
  }

  return buffer;
}


