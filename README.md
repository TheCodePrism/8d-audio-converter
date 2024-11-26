# 8D Audio Converter

Transform your audio into an immersive 8D experience with our web-based converter. This application creates a spatial audio effect that makes sound appear to rotate around your head, providing a unique and engaging listening experience.

![8D Audio Converter](public/preview.png)

## Features

- 🎧 Convert regular audio files to 8D audio
- 🔄 Real-time audio processing
- 🎵 Support for multiple audio formats (MP3, WAV, OGG)
- 💫 Advanced spatial and bass enhancement effects
- 📱 Responsive design for all devices
- ⬇️ Easy download of converted files

## Getting Started

First, install the dependencies:

```bash
npm install
# or
yarn install
# or
pnpm install
```

Then, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

## How It Works

The 8D Audio Converter uses the Web Audio API to create an immersive audio experience by:
1. Applying dynamic stereo panning
2. Enhancing spatial audio effects
3. Adding bass boost and compression
4. Creating a rotating sound effect

## Technical Stack

- [Next.js 14](https://nextjs.org/) - React Framework
- [TypeScript](https://www.typescriptlang.org/) - Programming Language
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) - Audio Processing
- [Lucide React](https://lucide.dev/) - Icons

## Best Practices

- 🎧 Use headphones for the best experience
- 🔊 Keep volume at a moderate level
- ⏱️ Processing time depends on file size
- 💾 Supported file size up to 50MB

## Development

You can start editing the application by modifying the files in the `app` directory. The application auto-updates as you edit the files.

Key files:
- `app/page.tsx` - Main page component
- `components/AudioConverter.tsx` - Core conversion logic
- `components/AudioPlayer.tsx` - Custom audio player
- `components/UploadForm.tsx` - File upload handling

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a custom font family from Vercel.

## Deployment

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme).

Check out the [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Learn More

To learn more about the technologies used in this project:

- [Next.js Documentation](https://nextjs.org/docs) - Next.js features and API
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) - Audio processing capabilities
- [Tailwind CSS](https://tailwindcss.com/docs) - Styling framework
- [TypeScript](https://www.typescriptlang.org/docs/) - TypeScript documentation

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.