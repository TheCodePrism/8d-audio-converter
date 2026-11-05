export interface AudioProcessingOptions {
  rotationSpeed: number; // Seconds per full 360-degree rotation (e.g. 8 to 24s)
  reverbLevel: number; // 0.0 to 0.5 (wet mix ratio)
  bassBoost: number; // dB boost at low frequencies (0 to 10 dB)
  direction: "clockwise" | "counter-clockwise";
  spatialRadius: number; // Virtual distance from listener (1 to 4)
}

export interface Preset {
  id: string;
  name: string;
  description: string;
  options: AudioProcessingOptions;
}

export interface ProcessedAudio {
  buffer: AudioBuffer;
  url: string;
}

export interface AudioPlayerState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
}

export interface YouTubeTrack {
  id: string;
  title: string;
  duration?: number;
  url: string;
  thumbnail?: string;
  author?: string;
}

export interface YouTubeInfoResponse {
  isPlaylist: boolean;
  title: string;
  thumbnail?: string;
  tracks: YouTubeTrack[];
}
