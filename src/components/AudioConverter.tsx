"use client";

import { useState, useEffect } from "react";
import { Download, AlertCircle, X } from "lucide-react";
import AudioPlayer from "./AudioPlayer";
import UploadForm from "./UploadForm";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Constants
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const SUPPORTED_FORMATS = ["audio/mp3", "audio/wav", "audio/mpeg", "audio/ogg"];

interface ConversionProgress {
  status: "preparing" | "processing" | "encoding" | "complete";
  percent: number;
}

interface AudioFile {
  file: File;
  originalUrl: string;
  convertedUrl?: string;
  status: "pending" | "converting" | "complete" | "error";
  error?: string;
}

export default function AudioConverter() {
  const [audioFiles, setAudioFiles] = useState<AudioFile[]>([]);
  const [progress, setProgress] = useState<ConversionProgress>({
    status: "preparing",
    percent: 0,
  });
  const [error, setError] = useState<string | null>(null);

  const validateFile = (file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) {
      return `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`;
    }
    if (!SUPPORTED_FORMATS.includes(file.type)) {
      return "Unsupported file format. Please use MP3, WAV, or OGG files";
    }
    return null;
  };

  const handleFileUpload = async (files: File[]) => {
    const newFiles = files.map((file) => ({
      file,
      originalUrl: URL.createObjectURL(file),
      status: "pending" as const,
    }));

    setAudioFiles((prev) => [...prev, ...newFiles]);

    for (let i = 0; i < newFiles.length; i++) {
      const currentFile = newFiles[i];
      const validationError = validateFile(currentFile.file);

      if (validationError) {
        setAudioFiles((prev) =>
          prev.map((f) =>
            f === currentFile
              ? { ...f, status: "error", error: validationError }
              : f
          )
        );
        continue;
      }

      try {
        await processAudioFile(currentFile, i);
      } catch (err) {
        setAudioFiles((prev) =>
          prev.map((f) =>
            f === currentFile
              ? {
                  ...f,
                  status: "error",
                  error: "Conversion failed. Please try again.",
                }
              : f
          )
        );
      }
    }
  };

  const processAudioFile = async (audioFile: AudioFile, index: number) => {
    setAudioFiles((prev) =>
      prev.map((f, i) => (i === index ? { ...f, status: "converting" } : f))
    );

    try {
      setProgress({ status: "preparing", percent: 0 });

      // Check for AudioContext support
      if (!window.AudioContext) {
        window.AudioContext = (window as any).webkitAudioContext;
      }

      const audioContext = new window.AudioContext();

      // Safely load array buffer
      let arrayBuffer: ArrayBuffer;
      try {
        arrayBuffer = await audioFile.file.arrayBuffer();
      } catch (err) {
        throw new Error("Failed to read audio file");
      }
      setProgress({ status: "processing", percent: 30 });

      // Safely decode audio data
      let audioBuffer: AudioBuffer;
      try {
        audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      } catch (err) {
        throw new Error("Failed to decode audio file");
      }
      setProgress({ status: "processing", percent: 60 });

      const processedBuffer = await process8DAudio(audioContext, audioBuffer);
      setProgress({ status: "encoding", percent: 90 });

      const wavBlob = float32ToWav(processedBuffer, audioContext.sampleRate);
      const convertedUrl = URL.createObjectURL(wavBlob);
      console.log("Converted URL:", convertedUrl);

      setAudioFiles((prev) =>
        prev.map((f, i) =>
          i === index ? { ...f, convertedUrl, status: "complete" } : f
        )
      );
      setProgress({ status: "complete", percent: 100 });

      // Clean up AudioContext
      await audioContext.close();
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Conversion failed. Please try again.";
      setAudioFiles((prev) =>
        prev.map((f, i) =>
          i === index ? { ...f, status: "error", error: errorMessage } : f
        )
      );
      setError(errorMessage);
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
  const float32ToWav = (audioBuffer: AudioBuffer, sampleRate: number): Blob => {
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
        view.setInt16(
          offset,
          sample < 0 ? sample * 0x8000 : sample * 0x7fff,
          true
        );
        offset += 2;
      }
    }

    return new Blob([view], { type: "audio/wav" });
  };

  // Also update the handleDownload function to ensure it works properly:
  const handleDownload = (convertedUrl: string, originalFileName: string) => {
    try {
      const link = document.createElement("a");
      link.href = convertedUrl;
      link.download = `8D_${originalFileName.replace(/\.[^/.]+$/, "")}.wav`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Download error:", error);
      setError("Failed to download the converted file. Please try again.");
    }
  };

  const removeFile = (index: number) => {
    setAudioFiles((prev) => {
      const newFiles = [...prev];
      if (newFiles[index].originalUrl) {
        URL.revokeObjectURL(newFiles[index].originalUrl);
      }
      if (newFiles[index].convertedUrl) {
        URL.revokeObjectURL(newFiles[index].convertedUrl);
      }
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          8D Audio Converter
        </h2>
        <p className="text-gray-600">
          Convert your audio files to immersive 8D audio
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!audioFiles.length && (
        <UploadForm
          onUpload={handleFileUpload}
          isConverting={false}
          maxFileSize={MAX_FILE_SIZE}
          supportedFormats={SUPPORTED_FORMATS}
        />
      )}

      {audioFiles.length > 0 && (
        <div className="space-y-6">
          {audioFiles.map((audioFile, index) => (
            <div key={index} className="bg-gray-50 rounded-lg p-4 relative">
              <button
                onClick={() => removeFile(index)}
                className="absolute top-2 right-2 p-1 hover:bg-gray-200 rounded-full"
              >
                <X className="h-4 w-4 text-gray-500" />
              </button>

              <div className="mb-4">
                <h3 className="font-semibold text-gray-800">
                  {audioFile.file.name}
                </h3>
                <p className="text-sm text-gray-500">
                  {(audioFile.file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>

              {audioFile.status === "converting" && (
                <div className="mb-4">
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all duration-300"
                      style={{ width: `${progress.percent}%` }}
                    />
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {progress.status === "preparing" && "Preparing audio..."}
                    {progress.status === "processing" &&
                      "Processing 8D effect..."}
                    {progress.status === "encoding" &&
                      "Encoding final audio..."}
                  </p>
                </div>
              )}

              {audioFile.status === "error" && (
                <Alert variant="destructive" className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{audioFile.error}</AlertDescription>
                </Alert>
              )}

              {audioFile.originalUrl && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">
                    Original Audio
                  </h4>
                  <AudioPlayer src={audioFile.originalUrl} />
                </div>
              )}

              {audioFile.convertedUrl && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-gray-700">
                      8D Audio (Use Headphones)
                    </h4>
                    <button
                      onClick={() =>
                        handleDownload(
                          audioFile.convertedUrl!,
                          audioFile.file.name
                        )
                      }
                      className="flex items-center gap-2 px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                    >
                      <Download className="h-4 w-4" />
                      <span>Download</span>
                    </button>
                  </div>
                  <AudioPlayer src={audioFile.convertedUrl} />
                </div>
              )}
            </div>
          ))}

          <button
            onClick={() => setAudioFiles([])}
            className="w-full py-2 px-4 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
          >
            Convert More Files
          </button>
        </div>
      )}
    </div>
  );
}
