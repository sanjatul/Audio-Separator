"use client";

import { useEffect, useState } from "react";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Music2,
  Download,
  ExternalLink,
} from "lucide-react";
import { fetchTasks } from "@/lib/api";
import type { TaskRecord } from "@/lib/types";

interface TaskHistoryProps {
  visible: boolean;
  onClose: () => void;
}

const STATUS_CONFIG: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; color: string; label: string }
> = {
  completed: { icon: CheckCircle2, color: "text-emerald-500", label: "Completed" },
  failed: { icon: XCircle, color: "text-red-400", label: "Failed" },
  cancelled: { icon: XCircle, color: "text-zinc-500", label: "Cancelled" },
  processing: { icon: Loader2, color: "text-indigo-400", label: "Processing" },
  pending: { icon: Clock, color: "text-zinc-500", label: "Pending" },
  downloading: { icon: Loader2, color: "text-indigo-400", label: "Downloading" },
  converting: { icon: Loader2, color: "text-indigo-400", label: "Converting" },
  separating: { icon: Loader2, color: "text-indigo-400", label: "Separating" },
  enhancing: { icon: Loader2, color: "text-indigo-400", label: "Enhancing" },
  converting_to_mp3: { icon: Loader2, color: "text-indigo-400", label: "Encoding" },
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TaskHistory({ visible, onClose }: TaskHistoryProps) {
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    fetchTasks()
      .then(setTasks)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="w-full max-w-[560px] mb-8">
      <div className="bg-zinc-900/60 backdrop-blur-2xl border border-white/[0.07] rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <h3 className="text-sm font-semibold text-white">Task History</h3>
          <button
            onClick={onClose}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors bg-transparent border-none cursor-pointer"
          >
            Close
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 text-zinc-500 animate-spin" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-12">
            <Music2 className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
            <p className="text-zinc-500 text-sm">No tasks yet</p>
            <p className="text-zinc-600 text-xs mt-1">
              Process an audio file to see it here
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/50 max-h-[400px] overflow-y-auto">
            {tasks.map((task) => {
              const cfg = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.pending;
              const Icon = cfg.icon;
              const isRunning = [
                "pending",
                "processing",
                "downloading",
                "converting",
                "separating",
                "enhancing",
                "converting_to_mp3",
              ].includes(task.status);

              return (
                <div
                  key={task.task_id}
                  className="flex items-center gap-4 px-6 py-3.5 hover:bg-zinc-800/30 transition-colors"
                >
                  <div className="flex-shrink-0">
                    <Icon
                      className={`w-4 h-4 ${cfg.color} ${isRunning ? "animate-spin" : ""}`}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-zinc-300 truncate">
                      {task.source_url ?? task.source_type}
                    </p>
                    <p className="text-[11px] text-zinc-600 mt-0.5">
                      {task.source_type === "youtube" ? "YouTube" : "Upload"} ·{" "}
                      {formatDate(task.created_at)}
                    </p>
                  </div>

                  <span
                    className={`text-[11px] font-medium ${cfg.color} flex-shrink-0`}
                  >
                    {cfg.label}
                  </span>

                  {task.status === "completed" && (
                    <div className="flex gap-1.5 flex-shrink-0">
                      {task.vocals_available && (
                        <a
                          href={`/api/download/${task.task_id}/vocals`}
                          download
                          className="p-1.5 rounded-lg bg-zinc-800/60 border border-zinc-700/50 text-zinc-400 hover:text-indigo-400 hover:border-indigo-500/30 transition-all"
                          title="Download Vocals"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      )}
                      {task.instrumental_available && (
                        <a
                          href={`/api/download/${task.task_id}/instrumental`}
                          download
                          className="p-1.5 rounded-lg bg-zinc-800/60 border border-zinc-700/50 text-zinc-400 hover:text-indigo-400 hover:border-indigo-500/30 transition-all"
                          title="Download Instrumental"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
