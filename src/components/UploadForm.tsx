'use client';

import { useState, useRef } from 'react';
import { Upload, Loader2, File } from 'lucide-react';

interface UploadFormProps {
  onUpload: (files: File[]) => void;
  isConverting: boolean;
  maxFileSize: number;
  supportedFormats: string[];
}

export default function UploadForm({ 
  onUpload, 
  isConverting, 
  maxFileSize,
  supportedFormats 
}: UploadFormProps) {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files).filter(file => 
      file.type.startsWith('audio/')
    );
    
    if (files.length > 0) {
      onUpload(files);
    } else {
      alert('Please upload audio files only');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      onUpload(files);
    }
  };

  return (
    <div
      className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors duration-200 ${
        dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
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
        multiple
      />

      <div className="space-y-4">
        <div className="flex justify-center">
          {isConverting ? (
            <Loader2 className="h-12 w-12 text-blue-500 animate-spin" />
          ) : (
            <div className="p-3 bg-blue-50 rounded-full">
              <Upload className="h-10 w-10 text-blue-500" />
            </div>
          )}
        </div>
        
        <div className="space-y-2">
          <h3 className="text-lg font-medium text-gray-800">
            {isConverting
              ? 'Converting your audio to 8D...'
              : 'Upload Your Audio Files'}
          </h3>
          <p className="text-gray-600">
            Drag and drop your audio files here, or click to select
          </p>
          <div className="text-sm text-gray-500 space-y-1">
            <p>Supported formats: {supportedFormats.map(format => 
              format.split('/')[1].toUpperCase()
            ).join(', ')}</p>
            <p>Maximum file size: {maxFileSize / 1024 / 1024}MB</p>
            <p>You can upload multiple files at once</p>
          </div>
        </div>

        {!isConverting && (
          <div className="space-y-3">
            <button
              onClick={() => inputRef.current?.click()}
              className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors inline-flex items-center gap-2"
            >
              <File className="h-5 w-5" />
              Select Files
            </button>
          </div>
        )}
      </div>
    </div>
  );
}