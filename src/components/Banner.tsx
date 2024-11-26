// components/Banner.tsx
import { Sparkles } from 'lucide-react';

export default function Banner() {
  return (
    <div className="bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 text-white py-3 relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIyMCIgY3k9IjIwIiByPSIxIiBmaWxsPSJyZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMikiPjxhbmltYXRlIGF0dHJpYnV0ZU5hbWU9InIiIGZyb209IjEiIHRvPSIyMCIgZHVyPSIxLjVzIiByZXBlYXRDb3VudD0iaW5kZWZpbml0ZSIgLz48L2NpcmNsZT48L3N2Zz4=')] opacity-20"></div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-center space-x-2 animate-bounce">
          <Sparkles className="h-5 w-5" />
          <p className="text-lg font-medium">
            New Updates coming Soon. Stay tuned...
          </p>
          <Sparkles className="h-5 w-5" />
        </div>
      </div>
      
      <div className="absolute top-0 left-0 w-full h-full">
        <div className="absolute top-1/2 left-1/4 w-2 h-2 bg-white rounded-full animate-ping"></div>
        <div className="absolute top-1/3 right-1/3 w-2 h-2 bg-white rounded-full animate-ping delay-150"></div>
        <div className="absolute bottom-1/2 right-1/4 w-2 h-2 bg-white rounded-full animate-ping delay-300"></div>
      </div>
    </div>
  );
}