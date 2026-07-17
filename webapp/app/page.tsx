"use client";

import { useState, useRef, useEffect } from "react";
import { ArrowRight } from "lucide-react";

import Header from "@/components/Header";
import FileDropZone from "@/components/FileDropZone";
import UrlInput from "@/components/UrlInput";
import PipelineProgress from "@/components/PipelineProgress";
import DownloadCards from "@/components/DownloadCards";
import ErrorState from "@/components/ErrorState";
import Footer from "@/components/Footer";
import type { AppStatus, DownloadUrls, PipelineStepKey } from "@/lib/types";
import { processYouTube, processUpload, buildSSEUrl } from "@/lib/api";

export default function Home() {
  const [status, setStatus] = useState<AppStatus>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [pipelineStep, setPipelineStep] = useState<PipelineStepKey>("pending");
  const [downloads, setDownloads] = useState<DownloadUrls | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    return () => {
      esRef.current?.close();
    };
  }, []);

  const connectSSE = (taskId: string) => {
    const es = new EventSource(buildSSEUrl(taskId));
    esRef.current = es;

    es.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        const s = payload.status as string;
        setPipelineStep(s as PipelineStepKey);

        if (s === "completed") {
          setStatus("success");
          setDownloads({
            vocals: payload.vocals_url,
            instrumental: payload.instrumental_url,
          });
          es.close();
        } else if (s === "failed") {
          setStatus("error");
          setErrorMsg("The audio pipeline failed. Please try again.");
          es.close();
        } else if (s === "cancelled" || s === "not_found") {
          setStatus("idle");
          es.close();
        }
      } catch {
        /* ignore parse errors */
      }
    };

    es.onerror = () => {
      es.close();
      setStatus((prev) => (prev === "processing" ? "error" : prev));
      setErrorMsg("Lost connection to the server.");
    };
  };

  const startProcessing = async (type: "file" | "url") => {
    setStatus("processing");
    setPipelineStep("pending");
    setErrorMsg("");
    try {
      const data =
        type === "url"
          ? await processYouTube(url)
          : await processUpload(file!);

      if (data.status === "success" && data.data?.task_id) {
        connectSSE(data.data.task_id);
      } else {
        setStatus("error");
        setErrorMsg("Server returned an unexpected response.");
      }
    } catch {
      setStatus("error");
      setErrorMsg("Could not reach the server. Is the backend running?");
    }
  };

  const handleCancel = () => {
    esRef.current?.close();
    esRef.current = null;
    setStatus("idle");
    setPipelineStep("pending");
  };

  const handleReset = () => {
    setStatus("idle");
    setFile(null);
    setUrl("");
    setDownloads(null);
    setPipelineStep("pending");
    setErrorMsg("");
  };

  const isYouTube = !!url;

  return (
    <div className="min-h-screen bg-[#080b12] text-zinc-300 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute -top-44 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-[radial-gradient(circle,rgba(99,102,241,0.12)_0%,transparent_70%)] pointer-events-none z-0" />

      <div className="max-w-[560px] w-full relative z-1">
        <Header />

        {/* Main Card */}
        <div className="bg-zinc-900/60 backdrop-blur-2xl border border-white/[0.07] rounded-3xl p-8 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.05)] relative overflow-hidden">
          {/* IDLE */}
          {status === "idle" && (
            <div className="flex flex-col gap-0">
              <FileDropZone onFileSelect={(f) => { setFile(f); }} />

              {file && (
                <button
                  onClick={() => startProcessing("file")}
                  className="w-full mt-4 py-3.5 bg-gradient-to-br from-indigo-500 to-indigo-600 text-white border-none rounded-2xl font-semibold text-[15px] cursor-pointer shadow-[0_8px_24px_rgba(99,102,241,0.3)] hover:brightness-110 transition-all flex items-center justify-center gap-2"
                >
                  Separate Stems
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}

              {/* Divider */}
              <div className="flex items-center gap-4 my-6">
                <div className="flex-1 h-px bg-zinc-800" />
                <span className="text-[11px] font-semibold text-zinc-600 uppercase tracking-widest">
                  or
                </span>
                <div className="flex-1 h-px bg-zinc-800" />
              </div>

              <UrlInput
                value={url}
                onChange={setUrl}
                onProcess={() => startProcessing("url")}
              />
            </div>
          )}

          {/* PROCESSING */}
          {status === "processing" && (
            <PipelineProgress
              currentStep={pipelineStep}
              isYouTube={isYouTube}
              onCancel={handleCancel}
            />
          )}

          {/* SUCCESS */}
          {status === "success" && downloads && (
            <DownloadCards
              vocalsUrl={downloads.vocals}
              instrumentalUrl={downloads.instrumental}
              onProcessAnother={handleReset}
            />
          )}

          {/* ERROR */}
          {status === "error" && (
            <ErrorState message={errorMsg} onRetry={handleReset} />
          )}
        </div>

        <Footer />
      </div>
    </div>
  );
}
