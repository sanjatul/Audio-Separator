"use client";

import { Link as LinkIcon } from "lucide-react";

interface UrlInputProps {
  value: string;
  onChange: (value: string) => void;
  onProcess: () => void;
  disabled?: boolean;
}

export default function UrlInput({ value, onChange, onProcess, disabled }: UrlInputProps) {
  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
        <input
          type="url"
          placeholder="Paste YouTube URL..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3.5 pl-10 pr-4 text-sm text-zinc-200 outline-none transition-colors focus:border-indigo-500 placeholder:text-zinc-600"
        />
      </div>
      <button
        onClick={onProcess}
        disabled={!value || disabled}
        className={`px-6 py-3.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
          value && !disabled
            ? "bg-gradient-to-br from-zinc-100 to-zinc-300 text-zinc-900 cursor-pointer hover:brightness-110"
            : "bg-zinc-800 text-zinc-600 cursor-not-allowed"
        }`}
      >
        Process
      </button>
    </div>
  );
}
