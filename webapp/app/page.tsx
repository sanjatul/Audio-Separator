"use client";

import { useState, useRef, useEffect } from "react";
import {
  UploadCloud,
  Link as LinkIcon,
  Music,
  Loader2,
  XCircle,
  CheckCircle2,
  Download,
  ArrowRight,
  Waves,
  Sparkles,
  Radio,
  Disc3,
} from "lucide-react";

const API_BASE = "http://localhost:8000";

type AppStatus = "idle" | "processing" | "success" | "error";

const PIPELINE_STEPS = [
  { key: "pending", label: "Queued", icon: Radio },
  { key: "downloading", label: "Downloading", icon: Download },
  { key: "converting", label: "Converting Audio", icon: Disc3 },
  { key: "separating", label: "AI Stem Separation", icon: Waves },
  { key: "enhancing", label: "AI Enhancement", icon: Sparkles },
  { key: "completed", label: "Complete", icon: CheckCircle2 },
];

export default function Home() {
  const [dragActive, setDragActive] = useState(false);
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [status, setStatus] = useState<AppStatus>("idle");
  const [pipelineStep, setPipelineStep] = useState("pending");
  const [downloads, setDownloads] = useState<{
    vocals: string;
    instrumental: string;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const eventSourceRef = useRef<EventSource | null>(null);

  // Cleanup SSE on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const connectSSE = (taskId: string) => {
    const es = new EventSource(`${API_BASE}/api/tasks/${taskId}/stream`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        const s = payload.status;

        setPipelineStep(s);

        if (s === "completed") {
          setStatus("success");
          setDownloads({
            vocals: `${API_BASE}${payload.vocals_url}`,
            instrumental: `${API_BASE}${payload.instrumental_url}`,
          });
          es.close();
        } else if (s === "failed") {
          setStatus("error");
          setErrorMsg("The audio pipeline failed. Please try again.");
          es.close();
        } else if (s === "cancelled") {
          setStatus("idle");
          es.close();
        } else if (s === "not_found") {
          setStatus("error");
          setErrorMsg("Task not found.");
          es.close();
        }
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      es.close();
      // Only set error if we're still processing
      setStatus((prev) => (prev === "processing" ? "error" : prev));
      setErrorMsg("Lost connection to the server.");
    };
  };

  const startProcessing = async (type: "file" | "url") => {
    setStatus("processing");
    setPipelineStep("pending");
    setErrorMsg("");
    try {
      let res;
      if (type === "url") {
        res = await fetch(
          `${API_BASE}/api/process/youtube?url=${encodeURIComponent(url)}`,
          { method: "POST" }
        );
      } else if (file) {
        const formData = new FormData();
        formData.append("file", file);
        res = await fetch(`${API_BASE}/api/process/upload`, {
          method: "POST",
          body: formData,
        });
      }

      if (!res || !res.ok) throw new Error("Network error");
      const data = await res.json();

      if (data.status === "success" && data.task_id) {
        connectSSE(data.task_id);
      } else {
        setStatus("error");
        setErrorMsg("Server returned an unexpected response.");
      }
    } catch (err) {
      console.error(err);
      setStatus("error");
      setErrorMsg("Could not reach the server. Is the backend running?");
    }
  };

  const handleCancel = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
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

  // Determine which steps to show (skip "downloading" for file uploads)
  const visibleSteps =
    file && !url
      ? PIPELINE_STEPS.filter((s) => s.key !== "downloading")
      : PIPELINE_STEPS;

  const currentStepIndex = visibleSteps.findIndex(
    (s) => s.key === pipelineStep
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(ellipse 80% 60% at 50% -20%, rgba(99,102,241,0.15), transparent), #080b12",
        color: "#e4e4e7",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Ambient glow */}
      <div
        style={{
          position: "absolute",
          top: "-180px",
          left: "50%",
          transform: "translateX(-50%)",
          width: "600px",
          height: "400px",
          background:
            "radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      <div
        style={{
          maxWidth: "560px",
          width: "100%",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "14px",
              background: "rgba(39,39,42,0.5)",
              borderRadius: "16px",
              marginBottom: "16px",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 0 30px rgba(99,102,241,0.15)",
            }}
          >
            <Music style={{ width: 32, height: 32, color: "#818cf8" }} />
          </div>
          <h1
            style={{
              fontSize: "42px",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              background: "linear-gradient(135deg, #fff 0%, #a1a1aa 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              margin: "0 0 8px 0",
              lineHeight: 1.1,
            }}
          >
            SonicSplit
          </h1>
          <p
            style={{
              color: "#71717a",
              fontSize: "14px",
              margin: 0,
              letterSpacing: "0.01em",
            }}
          >
            Professional AI stem separation — drop a file or paste a YouTube
            link
          </p>
        </div>

        {/* Main Card */}
        <div
          style={{
            background: "rgba(24,24,27,0.6)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: "24px",
            padding: "32px",
            boxShadow:
              "0 25px 50px -12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* ========== IDLE STATE ========== */}
          {status === "idle" && (
            <div>
              {/* Drop zone */}
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                style={{
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  border: `2px dashed ${dragActive ? "#6366f1" : "#3f3f46"}`,
                  borderRadius: "16px",
                  padding: "36px 24px",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  background: dragActive
                    ? "rgba(99,102,241,0.08)"
                    : "transparent",
                }}
              >
                <UploadCloud
                  style={{
                    width: 40,
                    height: 40,
                    marginBottom: 12,
                    color: dragActive ? "#818cf8" : "#52525b",
                    transition: "color 0.2s",
                  }}
                />
                <p
                  style={{
                    fontWeight: 500,
                    fontSize: "14px",
                    color: "#d4d4d8",
                    margin: "0 0 4px 0",
                  }}
                >
                  {file ? file.name : "Drag and drop your audio file"}
                </p>
                <p
                  style={{
                    fontSize: "12px",
                    color: "#52525b",
                    margin: 0,
                  }}
                >
                  WAV, MP3, MP4, FLAC up to 50MB
                </p>

                <input
                  id="file-upload-input"
                  type="file"
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    opacity: 0,
                    cursor: "pointer",
                  }}
                  accept="audio/*,video/*"
                  onChange={(e) => {
                    if (e.target.files?.[0]) setFile(e.target.files[0]);
                  }}
                />
              </div>

              {file && (
                <button
                  id="separate-stems-btn"
                  onClick={() => startProcessing("file")}
                  style={{
                    width: "100%",
                    marginTop: "16px",
                    padding: "14px 16px",
                    background:
                      "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
                    color: "#fff",
                    border: "none",
                    borderRadius: "14px",
                    fontWeight: 600,
                    fontSize: "15px",
                    cursor: "pointer",
                    boxShadow: "0 8px 24px rgba(99,102,241,0.3)",
                    transition: "all 0.2s",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                  }}
                >
                  Separate Stems
                  <ArrowRight style={{ width: 16, height: 16 }} />
                </button>
              )}

              {/* Divider */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "16px",
                  margin: "24px 0",
                }}
              >
                <div
                  style={{ flex: 1, height: "1px", background: "#27272a" }}
                />
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "#52525b",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                  }}
                >
                  or
                </span>
                <div
                  style={{ flex: 1, height: "1px", background: "#27272a" }}
                />
              </div>

              {/* URL Input */}
              <div style={{ display: "flex", gap: "8px" }}>
                <div
                  style={{ position: "relative", flex: 1, display: "flex" }}
                >
                  <LinkIcon
                    style={{
                      position: "absolute",
                      left: 12,
                      top: "50%",
                      transform: "translateY(-50%)",
                      width: 16,
                      height: 16,
                      color: "#52525b",
                    }}
                  />
                  <input
                    id="youtube-url-input"
                    type="url"
                    placeholder="Paste YouTube URL..."
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    style={{
                      width: "100%",
                      background: "#09090b",
                      border: "1px solid #27272a",
                      borderRadius: "12px",
                      padding: "14px 16px 14px 40px",
                      fontSize: "14px",
                      color: "#e4e4e7",
                      outline: "none",
                      transition: "border-color 0.2s",
                    }}
                    onFocus={(e) =>
                      (e.target.style.borderColor = "#6366f1")
                    }
                    onBlur={(e) =>
                      (e.target.style.borderColor = "#27272a")
                    }
                  />
                </div>
                <button
                  id="process-url-btn"
                  onClick={() => startProcessing("url")}
                  disabled={!url}
                  style={{
                    padding: "14px 24px",
                    background: url
                      ? "linear-gradient(135deg, #f4f4f5 0%, #d4d4d8 100%)"
                      : "#27272a",
                    color: url ? "#18181b" : "#52525b",
                    border: "none",
                    borderRadius: "12px",
                    fontWeight: 600,
                    fontSize: "14px",
                    cursor: url ? "pointer" : "not-allowed",
                    transition: "all 0.2s",
                    whiteSpace: "nowrap",
                  }}
                >
                  Process
                </button>
              </div>
            </div>
          )}

          {/* ========== PROCESSING STATE ========== */}
          {status === "processing" && (
            <div
              style={{
                padding: "24px 0",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              {/* Spinner with glow */}
              <div
                style={{
                  position: "relative",
                  marginBottom: "24px",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    inset: "-8px",
                    background: "rgba(99,102,241,0.2)",
                    filter: "blur(20px)",
                    borderRadius: "50%",
                  }}
                />
                <Loader2
                  style={{
                    width: 48,
                    height: 48,
                    color: "#818cf8",
                    animation: "spin 1s linear infinite",
                    position: "relative",
                  }}
                />
              </div>

              <h3
                style={{
                  fontWeight: 700,
                  fontSize: "20px",
                  margin: "0 0 8px 0",
                  color: "#fafafa",
                }}
              >
                Processing Audio
              </h3>
              <p
                style={{
                  color: "#71717a",
                  fontSize: "13px",
                  margin: "0 0 28px 0",
                  textAlign: "center",
                  maxWidth: "280px",
                }}
              >
                Running the AI pipeline. Do not close this tab.
              </p>

              {/* Pipeline Steps */}
              <div
                style={{
                  width: "100%",
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                }}
              >
                {visibleSteps.map((step, idx) => {
                  const isActive = idx === currentStepIndex;
                  const isDone = idx < currentStepIndex;
                  const isPending = idx > currentStepIndex;
                  const Icon = step.icon;

                  return (
                    <div
                      key={step.key}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        padding: "10px 14px",
                        borderRadius: "12px",
                        background: isActive
                          ? "rgba(99,102,241,0.08)"
                          : "transparent",
                        border: isActive
                          ? "1px solid rgba(99,102,241,0.2)"
                          : "1px solid transparent",
                        transition: "all 0.3s ease",
                      }}
                    >
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: "8px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: isDone
                            ? "rgba(34,197,94,0.12)"
                            : isActive
                            ? "rgba(99,102,241,0.15)"
                            : "rgba(39,39,42,0.5)",
                          transition: "all 0.3s",
                          flexShrink: 0,
                        }}
                      >
                        {isDone ? (
                          <CheckCircle2
                            style={{
                              width: 16,
                              height: 16,
                              color: "#22c55e",
                            }}
                          />
                        ) : isActive ? (
                          <Loader2
                            style={{
                              width: 16,
                              height: 16,
                              color: "#818cf8",
                              animation: "spin 1s linear infinite",
                            }}
                          />
                        ) : (
                          <Icon
                            style={{
                              width: 16,
                              height: 16,
                              color: "#52525b",
                            }}
                          />
                        )}
                      </div>
                      <span
                        style={{
                          fontSize: "13px",
                          fontWeight: isActive ? 600 : 400,
                          color: isDone
                            ? "#22c55e"
                            : isActive
                            ? "#c7d2fe"
                            : "#52525b",
                          transition: "color 0.3s",
                        }}
                      >
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Cancel */}
              <button
                id="cancel-processing-btn"
                onClick={handleCancel}
                style={{
                  marginTop: "24px",
                  padding: "8px 20px",
                  background: "transparent",
                  border: "1px solid #27272a",
                  borderRadius: "10px",
                  color: "#71717a",
                  fontSize: "13px",
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                Cancel
              </button>
            </div>
          )}

          {/* ========== SUCCESS STATE ========== */}
          {status === "success" && downloads && (
            <div
              style={{
                padding: "32px 0 16px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  background: "rgba(34,197,94,0.1)",
                  border: "1px solid rgba(34,197,94,0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "20px",
                  boxShadow: "0 0 30px rgba(34,197,94,0.1)",
                }}
              >
                <CheckCircle2
                  style={{ width: 32, height: 32, color: "#22c55e" }}
                />
              </div>

              <h3
                style={{
                  fontSize: "22px",
                  fontWeight: 700,
                  margin: "0 0 6px",
                  color: "#fafafa",
                }}
              >
                Separation Complete
              </h3>
              <p
                style={{
                  color: "#71717a",
                  fontSize: "13px",
                  margin: "0 0 28px",
                }}
              >
                Your enhanced stems are ready to download.
              </p>

              <div
                style={{
                  width: "100%",
                  display: "flex",
                  gap: "12px",
                }}
              >
                <a
                  id="download-vocals-btn"
                  href={downloads.vocals}
                  download
                  style={{
                    flex: 1,
                    padding: "14px 16px",
                    background: "rgba(39,39,42,0.6)",
                    border: "1px solid #3f3f46",
                    borderRadius: "14px",
                    color: "#e4e4e7",
                    textDecoration: "none",
                    fontWeight: 600,
                    fontSize: "14px",
                    textAlign: "center",
                    transition: "all 0.2s",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                  }}
                >
                  <Download style={{ width: 16, height: 16 }} />
                  Vocals
                </a>
                <a
                  id="download-instrumental-btn"
                  href={downloads.instrumental}
                  download
                  style={{
                    flex: 1,
                    padding: "14px 16px",
                    background: "rgba(39,39,42,0.6)",
                    border: "1px solid #3f3f46",
                    borderRadius: "14px",
                    color: "#e4e4e7",
                    textDecoration: "none",
                    fontWeight: 600,
                    fontSize: "14px",
                    textAlign: "center",
                    transition: "all 0.2s",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                  }}
                >
                  <Download style={{ width: 16, height: 16 }} />
                  Instrumental
                </a>
              </div>

              <button
                id="process-another-btn"
                onClick={handleReset}
                style={{
                  marginTop: "20px",
                  background: "transparent",
                  border: "none",
                  color: "#818cf8",
                  fontSize: "13px",
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "color 0.2s",
                }}
              >
                Process another file
              </button>
            </div>
          )}

          {/* ========== ERROR STATE ========== */}
          {status === "error" && (
            <div
              style={{
                padding: "40px 0",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
              }}
            >
              <XCircle
                style={{
                  width: 48,
                  height: 48,
                  color: "#ef4444",
                  marginBottom: "16px",
                }}
              />
              <h3
                style={{
                  fontWeight: 700,
                  fontSize: "20px",
                  color: "#fecaca",
                  margin: "0 0 6px",
                }}
              >
                Processing Failed
              </h3>
              <p
                style={{
                  color: "#71717a",
                  fontSize: "13px",
                  margin: "0 0 20px",
                  maxWidth: "300px",
                }}
              >
                {errorMsg || "There was an error separating the stems."}
              </p>
              <button
                id="try-again-btn"
                onClick={handleReset}
                style={{
                  padding: "10px 24px",
                  background: "rgba(39,39,42,0.6)",
                  border: "1px solid #3f3f46",
                  borderRadius: "10px",
                  color: "#e4e4e7",
                  fontSize: "14px",
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                Try Again
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <p
          style={{
            textAlign: "center",
            marginTop: "24px",
            fontSize: "11px",
            color: "#3f3f46",
            letterSpacing: "0.02em",
          }}
        >
          Powered by Demucs &amp; DeepFilterNet
        </p>
      </div>

      {/* Keyframes for spinner */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        button:hover {
          filter: brightness(1.1);
        }
        a:hover {
          background: rgba(63,63,70,0.8) !important;
          border-color: #52525b !important;
        }
      `}</style>
    </div>
  );
}