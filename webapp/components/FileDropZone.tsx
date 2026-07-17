"use client";

import { useCallback, useState } from "react";
import { UploadCloud } from "lucide-react";

interface FileDropZoneProps {
  onFileSelect: (file: File) => void;
}

export default function FileDropZone({ onFileSelect }: FileDropZoneProps) {
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      const dropped = e.dataTransfer.files?.[0];
      if (dropped) {
        setFileName(dropped.name);
        onFileSelect(dropped);
      }
    },
    [onFileSelect],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files?.[0];
      if (selected) {
        setFileName(selected.name);
        onFileSelect(selected);
      }
    },
    [onFileSelect],
  );

  return (
    <div
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-9 cursor-pointer transition-all duration-200 ${
        dragActive
          ? "border-indigo-500 bg-indigo-500/[0.08]"
          : "border-zinc-700 hover:border-zinc-500"
      }`}
    >
      <UploadCloud
        className={`w-10 h-10 mb-3 transition-colors ${
          dragActive ? "text-indigo-400" : "text-zinc-600"
        }`}
      />
      <p className="text-sm font-medium text-zinc-300">
        {fileName ?? "Drag and drop your audio file"}
      </p>
      <p className="text-xs text-zinc-600 mt-1">
        WAV, MP3, MP4, FLAC, OGG, M4A, AAC, MKV
      </p>
      <input
        type="file"
        accept="audio/*,video/*"
        onChange={handleChange}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
    </div>
  );
}
