import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "VocalLift — AI Vocal Extractor",
  description: "Isolate vocals from any audio file using Demucs htdemucs neural source separation.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#080b12" }}>{children}</body>
    </html>
  );
}