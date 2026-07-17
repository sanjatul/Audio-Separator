"use client";

import {
  Loader2,
  CheckCircle2,
  Download,
  Radio,
  Disc3,
  Waves,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import type { PipelineStep, PipelineStepKey } from "@/lib/types";

const PIPELINE_STEPS: PipelineStep[] = [
  { key: "pending", label: "Queued" },
  { key: "downloading", label: "Downloading" },
  { key: "converting", label: "Converting Audio" },
  { key: "separating", label: "AI Stem Separation" },
  { key: "enhancing", label: "AI Enhancement" },
  { key: "converting_to_mp3", label: "Encoding MP3" },
  { key: "completed", label: "Complete" },
];

const STEP_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  pending: Radio,
  downloading: Download,
  converting: Disc3,
  separating: Waves,
  enhancing: Sparkles,
  converting_to_mp3: Disc3,
  completed: CheckCircle2,
};

interface PipelineProgressProps {
  currentStep: PipelineStepKey;
  isYouTube: boolean;
  onCancel: () => void;
}

export default function PipelineProgress({
  currentStep,
  isYouTube,
  onCancel,
}: PipelineProgressProps) {
  const visibleSteps = isYouTube
    ? PIPELINE_STEPS
    : PIPELINE_STEPS.filter((s) => s.key !== "downloading");

  const currentIndex = visibleSteps.findIndex((s) => s.key === currentStep);

  return (
    <div className="py-6 flex flex-col items-center">
      {/* Spinner */}
      <div className="relative mb-6">
        <div className="absolute -inset-2 bg-indigo-500/20 blur-2xl rounded-full" />
        <Loader2 className="w-12 h-12 text-indigo-400 animate-spin relative" />
      </div>

      <h3 className="text-xl font-bold text-white mb-2">Processing Audio</h3>
      <p className="text-zinc-500 text-xs mb-7 text-center max-w-[280px]">
        Running the AI pipeline. Do not close this tab.
      </p>

      {/* Steps */}
      <div className="w-full flex flex-col gap-1">
        {visibleSteps.map((step, idx) => {
          const isDone = idx < currentIndex;
          const isActive = idx === currentIndex;
          const Icon = STEP_ICONS[step.key] ?? ArrowRight;

          return (
            <div
              key={step.key}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-300 ${
                isActive
                  ? "bg-indigo-500/[0.08] border border-indigo-500/20"
                  : "border border-transparent"
              }`}
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${
                  isDone
                    ? "bg-emerald-500/[0.12]"
                    : isActive
                      ? "bg-indigo-500/[0.15]"
                      : "bg-zinc-800/50"
                }`}
              >
                {isDone ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                ) : isActive ? (
                  <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                ) : (
                  <Icon className="w-4 h-4 text-zinc-600" />
                )}
              </div>
              <span
                className={`text-[13px] transition-colors ${
                  isDone
                    ? "text-emerald-500"
                    : isActive
                      ? "text-indigo-200 font-semibold"
                      : "text-zinc-600"
                }`}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      <button
        onClick={onCancel}
        className="mt-6 px-5 py-2 bg-transparent border border-zinc-800 rounded-xl text-zinc-500 text-[13px] font-medium cursor-pointer hover:border-zinc-600 hover:text-zinc-400 transition-all"
      >
        Cancel
      </button>
    </div>
  );
}
