import { Metadata } from 'next'
import AudioConverter from '@/components/AudioConverter'

export const metadata: Metadata = {
  title: '8D Audio Converter',
  description: 'Convert normal audio to 8D audio effect',
}

export default function Home() {
  return (
    <main className="min-h-screen p-4 md:p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-bold text-center mb-8">
          8D Audio Converter
        </h1>
        <p className="text-gray-600 text-center mb-8">
          Upload an audio file to convert it to 8D audio. The 8D effect creates an immersive experience
          where the sound appears to rotate around your head. Use headphones for the best experience!
        </p>
        <AudioConverter />
      </div>
    </main>
  )
}