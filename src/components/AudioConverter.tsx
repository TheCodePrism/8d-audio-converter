"use client";

import { useState } from "react";
import { Music } from "lucide-react";
import AudioPlayer from "./AudioPlayer";
import UploadForm from "./UploadForm";

export default function AudioConverter() {
  const [originalAudio, setOriginalAudio] = useState<string | null>(null);
  const [convertedAudio, setConvertedAudio] = useState<string | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = async (file: File) => {
    try {
      setError(null);
      setIsConverting(true);

      // Create an AudioContext
      const audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();

      // Read the file
      const arrayBuffer = await file.arrayBuffer();

      // Decode audio data into an AudioBuffer
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      // Store the original audio
      setOriginalAudio(URL.createObjectURL(file));

      // Process the audio to create the 8D effect
      const processedBuffer = await process8DAudio(audioContext, audioBuffer);

      // Convert processed buffer to WAV format and create a Blob URL
      const wavBlob = float32ToWav(processedBuffer, audioContext.sampleRate);
      setConvertedAudio(URL.createObjectURL(wavBlob));
    } catch (err) {
      setError("Error processing audio. Please try again.");
      console.error(err);
    } finally {
      setIsConverting(false);
    }
  };

  // Function to create 8D audio effect with panning
  const process8DAudio = async (
    audioContext: AudioContext,
    audioBuffer: AudioBuffer
  ): Promise<AudioBuffer> => {
    const offlineContext = new OfflineAudioContext(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      audioBuffer.sampleRate
    );

    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;

    const panner = offlineContext.createPanner();
    panner.panningModel = "HRTF";
    panner.distanceModel = "inverse";
    panner.refDistance = 1;
    panner.maxDistance = 10;
    panner.rolloffFactor = 0.8;

    source.connect(panner);
    panner.connect(offlineContext.destination);

    // Animate the panning movement
    const radius = 2;
    const speed = 1;
    for (let t = 0; t < audioBuffer.duration; t += 0.05) {
      const x = radius * Math.cos(speed * t);
      const z = radius * Math.sin(speed * t);
      panner.positionX.setValueAtTime(x, t);
      panner.positionZ.setValueAtTime(z, t);
    }

    source.start();
    return await offlineContext.startRendering();
  };

  // Convert Float32 AudioBuffer to WAV Blob
  function float32ToWav(audioBuffer: AudioBuffer, sampleRate: number) {
    const numChannels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length * numChannels * 2 + 44;
    const wavBuffer = new ArrayBuffer(length);
    const view = new DataView(wavBuffer);

    function writeString(view: DataView, offset: number, string: string) {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    }

    // RIFF/WAVE header
    writeString(view, 0, "RIFF");
    view.setUint32(4, 36 + audioBuffer.length * numChannels * 2, true);
    writeString(view, 8, "WAVE");
    writeString(view, 12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * 2, true);
    view.setUint16(32, numChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, "data");
    view.setUint32(40, audioBuffer.length * numChannels * 2, true);

    let offset = 44;
    for (let i = 0; i < audioBuffer.length; i++) {
      for (let channel = 0; channel < numChannels; channel++) {
        const sample = Math.max(
          -1,
          Math.min(1, audioBuffer.getChannelData(channel)[i])
        );
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
        offset += 2;
      }
    }

    return new Blob([view], { type: "audio/wav" });
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      {!originalAudio && (
        <UploadForm onUpload={handleFileUpload} isConverting={isConverting} />
      )}

      {error && <div className="text-red-500 text-center mt-4">{error}</div>}

      {originalAudio && (
        <div className="space-y-8">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Original Audio</h3>
            <AudioPlayer src={originalAudio} />
          </div>

          {convertedAudio && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">8D Audio (Use Headphones)</h3>
              <AudioPlayer src={convertedAudio} />
            </div>
          )}

          <button
            onClick={() => {
              setOriginalAudio(null);
              setConvertedAudio(null);
              setError(null);
            }}
            className="w-full py-2 px-4 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
          >
            Convert Another File
          </button>
        </div>
      )}
    </div>
  );
}
