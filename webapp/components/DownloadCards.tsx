import { CheckCircle2, Download } from "lucide-react";

interface DownloadCardsProps {
  vocalsUrl: string;
  instrumentalUrl: string;
  onProcessAnother: () => void;
}

export default function DownloadCards({
  vocalsUrl,
  instrumentalUrl,
  onProcessAnother,
}: DownloadCardsProps) {
  return (
    <div className="py-8 flex flex-col items-center text-center">
      <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-5 shadow-[0_0_30px_rgba(34,197,94,0.1)]">
        <CheckCircle2 className="w-8 h-8 text-emerald-500" />
      </div>

      <h3 className="text-2xl font-bold text-white mb-1.5">Separation Complete</h3>
      <p className="text-zinc-500 text-xs mb-7">Your enhanced stems are ready to download.</p>

      <div className="flex gap-3 w-full">
        <a
          href={vocalsUrl}
          download
          className="flex-1 py-3.5 px-4 bg-zinc-800/60 border border-zinc-700 rounded-2xl text-zinc-200 no-underline font-semibold text-sm text-center transition-all hover:bg-zinc-700/80 hover:border-zinc-500 flex items-center justify-center gap-2"
        >
          <Download className="w-4 h-4" />
          Vocals
        </a>
        <a
          href={instrumentalUrl}
          download
          className="flex-1 py-3.5 px-4 bg-zinc-800/60 border border-zinc-700 rounded-2xl text-zinc-200 no-underline font-semibold text-sm text-center transition-all hover:bg-zinc-700/80 hover:border-zinc-500 flex items-center justify-center gap-2"
        >
          <Download className="w-4 h-4" />
          Instrumental
        </a>
      </div>

      <button
        onClick={onProcessAnother}
        className="mt-5 bg-transparent border-none text-indigo-400 text-[13px] font-medium cursor-pointer hover:text-indigo-300 transition-colors"
      >
        Process another file
      </button>
    </div>
  );
}
