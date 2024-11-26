// components/Footer.tsx
export default function Footer() {
    return (
      <footer className="bg-white border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-sm font-semibold text-gray-600 tracking-wider uppercase">About</h3>
              <p className="mt-4 text-gray-500">
                Experience music in a new dimension with our 8D audio converter.
                Transform your favorite tracks into immersive spatial audio.
              </p>
            </div>
            
            <div>
              <h3 className="text-sm font-semibold text-gray-600 tracking-wider uppercase">Quick Links</h3>
              <ul className="mt-4 space-y-4">
                <li>
                  <a href="/terms" className="text-gray-500 hover:text-gray-900">Terms of Service</a>
                </li>
                <li>
                  <a href="/privacy" className="text-gray-500 hover:text-gray-900">Privacy Policy</a>
                </li>
                <li>
                  <a href="/faq" className="text-gray-500 hover:text-gray-900">FAQ</a>
                </li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-sm font-semibold text-gray-600 tracking-wider uppercase">Connect</h3>
              <ul className="mt-4 space-y-4">
                <li>
                  <a href="https://twitter.com" className="text-gray-500 hover:text-gray-900">Twitter</a>
                </li>
                <li>
                  <a href="https://github.com" className="text-gray-500 hover:text-gray-900">GitHub</a>
                </li>
                <li>
                  <a href="/contact" className="text-gray-500 hover:text-gray-900">Contact Us</a>
                </li>
              </ul>
            </div>
          </div>
          
          <div className="mt-8 pt-8 border-t border-gray-200">
            <p className="text-center text-gray-400">
              © {new Date().getFullYear()} 8D Audio Converter. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    );
  }