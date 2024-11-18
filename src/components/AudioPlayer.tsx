'use client'

import { useState, useRef, useEffect } from 'react'
import { Play, Pause, Volume2, VolumeX } from 'lucide-react'

interface AudioPlayerProps {
  src: string
}

export default function AudioPlayer({ src }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [volume, setVolume] = useState(1)
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    if (!src) {
      console.error("Invalid audio source.");
    }
  }, [src]);

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime)
    const handleLoadedMetadata = () => setDuration(audio.duration)
    const handleEnded = () => setIsPlaying(false)

    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('ended', handleEnded)

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('ended', handleEnded)
    }
  }, [])

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause()
      } else {
        audioRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value)
    if (audioRef.current) {
      audioRef.current.currentTime = time
      setCurrentTime(time)
    }
  }

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted
      setIsMuted(!isMuted)
    }
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value)
    if (audioRef.current) {
      audioRef.current.volume = value
      setVolume(value)
      setIsMuted(value === 0)
    }
  }

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  return (
    <div className="bg-gray-100 rounded-lg p-4">
      <audio ref={audioRef} src={src} />
      
      <div className="space-y-4">
        <div className="flex items-center space-x-4">
          <button
            onClick={togglePlay}
            className="p-2 rounded-full hover:bg-gray-200 transition-colors"
          >
            {isPlaying ? (
              <Pause className="w-6 h-6" />
            ) : (
              <Play className="w-6 h-6" />
            )}
          </button>

          <div className="flex-1 space-y-1">
            <input
              type="range"
              min={0}
              max={duration}
              value={currentTime}
              onChange={handleTimeChange}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-gray-300"
            />
            <div className="flex justify-between text-sm text-gray-500">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={toggleMute}
              className="p-2 rounded-full hover:bg-gray-200 transition-colors"
            >
              {isMuted ? (
                <VolumeX className="w-5 h-5" />
              ) : (
                <Volume2 className="w-5 h-5" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.1}
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-20 h-2 rounded-lg appearance-none cursor-pointer bg-gray-300"
            />
          </div>
        </div>
      </div>
    </div>
  )
}