import { XCircle } from "lucide-react";

interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}

export default function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="py-10 flex flex-col items-center text-center">
      <XCircle className="w-12 h-12 text-red-500 mb-4" />
      <h3 className="text-xl font-bold text-red-200 mb-1.5">Processing Failed</h3>
      <p className="text-zinc-500 text-xs mb-5 max-w-[300px]">
        {message || "There was an error separating the stems."}
      </p>
      <button
        onClick={onRetry}
        className="px-6 py-2.5 bg-zinc-800/60 border border-zinc-700 rounded-xl text-zinc-200 text-sm font-medium cursor-pointer hover:bg-zinc-700/80 transition-all"
      >
        Try Again
      </button>
    </div>
  );
}
