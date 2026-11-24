export interface AudioProcessingOptions {
  rotationSpeed: number; // Seconds per full 360-degree rotation (e.g. 8 to 24s)
  reverbLevel: number; // 0.0 to 0.5 (wet mix ratio)
  bassBoost: number; // dB boost at low frequencies (0 to 10 dB)
  direction: "clockwise" | "counter-clockwise";
  spatialRadius: number; // Virtual distance from listener (1 to 4)
  verticalOrbit?: boolean; // 16D Helical 3D elevation movement (over head / under chin)
  centerAnchor?: number; // 0.0 to 0.4 (Center vocal/kick anchor level to keep vocals solid)
  stereoWidth?: number; // 0.0 to 0.6 (angular stereo spread in radians, default 0.28)
  orbitPattern?: "circle" | "figure8" | "spiral" | "pendulum"; // 8D trajectory path
  reverbRoom?: "studio" | "club" | "hall" | "cathedral"; // Acoustic room environment
  exportQuality?: "192" | "320" | "wav"; // "192" = Compact MP3 (~5MB), "320" = Hi-Fi MP3 (~9MB), "wav" = Studio Lossless WAV (~40MB)
  concurrency?: 1 | 2 | 3; // Number of parallel conversions (default: 2)
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

export interface AudioFileItem {
  id: string;
  name: string;
  artist?: string;
  thumbnail?: string;
  size?: number;
  file?: File;
  originalUrl: string;
  convertedUrl?: string;
  status: "pending" | "converting" | "complete" | "error";
  progress?: number;
  stage?: string;
  error?: string;
  errorDetails?: string;
  sourceType: "upload" | "youtube" | "demo";
  sourceUrl?: string;
  addedAt?: number;
  retryCount?: number;
  rawBuffer?: AudioBuffer;
}
