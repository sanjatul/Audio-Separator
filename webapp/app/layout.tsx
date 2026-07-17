import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "VocalLift — AI Vocal Extractor",
  description: "Isolate vocals from any audio file using Demucs htdemucs neural source separation.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className} style={{ margin: 0, background: "#080b12" }}>{children}</body>
    </html>
  );
}