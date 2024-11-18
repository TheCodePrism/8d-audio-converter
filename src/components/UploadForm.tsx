'use client'

import { useState, useRef } from 'react'
import { Upload, Loader2 } from 'lucide-react'

interface UploadFormProps {
  onUpload: (file: File) => void
  isConverting: boolean
}

export default function UploadForm({ onUpload, isConverting }: UploadFormProps) {
  const [dragActive, setDragActive] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0])
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault()
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0])
    }
  }

  const handleFile = (file: File) => {
    if (file.type.startsWith('audio/')) {
      onUpload(file)
    } else {
      alert('Please upload an audio file')
    }
  }

  return (
    <div
      className={`border-2 border-dashed rounded-lg p-8 text-center ${
        dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
      }`}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept="audio/*"
        onChange={handleChange}
        disabled={isConverting}
      />

      <div className="space-y-4">
        <div className="flex justify-center">
          {isConverting ? (
            <Loader2 className="h-10 w-10 text-blue-500 animate-spin" />
          ) : (
            <Upload className="h-10 w-10 text-gray-400" />
          )}
        </div>
        
        <div className="space-y-2">
          <p className="text-gray-600">
            {isConverting
              ? 'Converting your audio to 8D...'
              : 'Drag and drop your audio file here, or click to select'}
          </p>
          <p className="text-sm text-gray-500">
            Supports MP3, WAV, and other audio formats
          </p>
        </div>

        {!isConverting && (
          <button
            onClick={() => inputRef.current?.click()}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
          >
            Select File
          </button>
        )}
      </div>
    </div>
  )
}