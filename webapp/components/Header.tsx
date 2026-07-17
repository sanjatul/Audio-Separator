import { Music } from "lucide-react";

export default function Header() {
  return (
    <div className="text-center mb-8">
      <div className="inline-flex items-center justify-center p-3.5 rounded-2xl bg-zinc-800/50 border border-white/[0.08] shadow-[0_0_30px_rgba(99,102,241,0.15)] mb-4">
        <Music className="w-8 h-8 text-indigo-400" />
      </div>
      <h1 className="text-5xl font-extrabold tracking-tight bg-gradient-to-br from-white to-zinc-400 bg-clip-text text-transparent leading-tight">
        SonicSplit
      </h1>
      <p className="text-zinc-500 text-sm mt-2 tracking-wide">
        Professional AI stem separation — drop a file or paste a YouTube link
      </p>
    </div>
  );
}
