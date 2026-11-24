import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://sphere8d.vercel.app"),
  title: "Sphere8D — Free Online 360° Spatial Sound & 8D Audio Studio",
  description:
    "Transform any music or audio track into an immersive 8D spatial audio experience with 360-degree binaural HRTF rotation, deep bass enhancement, and concert reverb.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Sphere8D",
  },
  openGraph: {
    title: "Sphere8D — 360° Binaural Spatial Music Studio",
    description: "Immersive 8D audio converter and 360° spatial music player.",
    url: "https://sphere8d.vercel.app",
    siteName: "Sphere8D",
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#07090E",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#07090E] text-slate-100 min-h-screen flex flex-col`}
      >
        <ServiceWorkerRegistration />
        {children}
      </body>
    </html>
  );
}
