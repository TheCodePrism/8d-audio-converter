export interface AudioProcessingOptions {
    panningSpeed?: number
    reverbLevel?: number
    delayTime?: number
  }
  
  export interface ProcessedAudio {
    buffer: AudioBuffer
    url: string
  }
  
  export interface AudioPlayerState {
    isPlaying: boolean
    currentTime: number
    duration: number
    volume: number
    isMuted: boolean
  }