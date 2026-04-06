"use client";

import { useEffect, useRef, useState } from "react";
import { checkHealth, extractVocals, getDownloadUrl, ExtractResponse } from "./api/route";

type Status =
  | { type: "idle" }
  | { type: "loading" }
  | { type: "success"; data: ExtractResponse }
  | { type: "error"; message: string };

type Health = {
  demucs: boolean;
  ffmpeg: boolean;
  checked: boolean;
};

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<Status>({ type: "idle" });
  const [health, setHealth] = useState<Health>({ demucs: false, ffmpeg: false, checked: false });
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    checkHealth()
      .then((h) => setHealth({ demucs: h.demucs_available, ffmpeg: h.ffmpeg_available, checked: true }))
      .catch(() => setHealth({ demucs: false, ffmpeg: false, checked: true }));
  }, []);

  function formatBytes(bytes: number) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
  }

  function handleFileChange(f: File) {
    setFile(f);
    setStatus({ type: "idle" });
  }

  async function handleExtract() {
    if (!file) return;
    setStatus({ type: "loading" });
    try {
      const data = await extractVocals(file);
      setStatus({ type: "success", data });
    } catch (e: unknown) {
      setStatus({ type: "error", message: e instanceof Error ? e.message : "Unknown error" });
    }
  }

  const healthOk = health.demucs && health.ffmpeg;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@400;600;800&display=swap');

        :root {
          --bg: #080b12;
          --surface: #0f1420;
          --surface2: #161d2e;
          --border: #1e2a42;
          --accent: #00e5ff;
          --accent2: #7c3aed;
          --accent3: #f0abfc;
          --text: #e2e8f0;
          --muted: #64748b;
          --success: #22d3ee;
          --error: #f87171;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          background: var(--bg);
          color: var(--text);
          font-family: 'Syne', sans-serif;
          min-height: 100vh;
        }

        .page-bg::before {
          content: '';
          position: fixed;
          inset: 0;
          background:
            radial-gradient(ellipse 80% 50% at 20% 20%, rgba(0,229,255,0.07) 0%, transparent 60%),
            radial-gradient(ellipse 60% 40% at 80% 80%, rgba(124,58,237,0.08) 0%, transparent 60%),
            radial-gradient(ellipse 40% 60% at 50% 50%, rgba(240,171,252,0.03) 0%, transparent 70%);
          pointer-events: none;
          z-index: 0;
        }
        .page-bg::after {
          content: '';
          position: fixed;
          inset: 0;
          background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 4px);
          pointer-events: none;
          z-index: 0;
          opacity: 0.4;
        }

        @keyframes wave {
          0%,100% { transform: scaleY(1); opacity: .5; }
          50% { transform: scaleY(1.5); opacity: 1; }
        }
        @keyframes fadeDown {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes blink {
          0%,80%,100% { opacity: .2; transform: scale(.8); }
          40% { opacity: 1; transform: scale(1); }
        }
        @keyframes progress {
          0% { width: 0%; margin-left: 0; }
          50% { width: 70%; margin-left: 15%; }
          100% { width: 0%; margin-left: 100%; }
        }
      `}</style>

      <div className="page-bg" style={{ position: "relative", zIndex: 1, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem 1.5rem" }}>
        <div style={{ width: "100%", maxWidth: 640 }}>

          {/* Header */}
          <header style={{ textAlign: "center", marginBottom: "3rem", animation: "fadeDown 0.8s ease both" }}>
            <div style={{ display: "inline-block", fontFamily: "'Space Mono', monospace", fontSize: "0.7rem", letterSpacing: "0.25em", color: "var(--accent)", border: "1px solid rgba(0,229,255,0.3)", padding: "0.3rem 0.8rem", marginBottom: "1.2rem", textTransform: "uppercase" }}>
              AI-Powered · Demucs htdemucs
            </div>
            <h1 style={{ fontSize: "clamp(2.4rem, 8vw, 3.8rem)", fontWeight: 800, lineHeight: 1, letterSpacing: "-0.03em", background: "linear-gradient(135deg, #fff 30%, var(--accent3) 70%, var(--accent) 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              VocalLift
            </h1>
            <p style={{ marginTop: "0.8rem", color: "var(--muted)", fontSize: "0.95rem", fontFamily: "'Space Mono', monospace", letterSpacing: "0.05em" }}>
              // isolate vocals with neural source separation
            </p>
            {/* Waveform */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 3, margin: "1.5rem 0" }}>
              {[8,20,32,24,40,28,16,36,22,12,30,18,8].map((h, i) => (
                <span key={i} style={{ display: "block", width: 3, height: h, borderRadius: 999, background: "var(--accent)", opacity: 0.6, animation: `wave 1.2s ease-in-out ${[0,.1,.2,.3,.15,.25,.05,.35,.1,.2,.3,.4,.15][i]}s infinite` }} />
              ))}
            </div>
          </header>

          {/* Card */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 2, padding: "2rem", animation: "fadeUp 0.8s ease 0.2s both", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, var(--accent2), var(--accent), var(--accent3))" }} />

            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFileChange(f); }}
              onClick={() => inputRef.current?.click()}
              style={{ border: `2px dashed ${dragging ? "var(--accent)" : "var(--border)"}`, borderRadius: 2, padding: "2.5rem 1.5rem", textAlign: "center", cursor: "pointer", background: dragging ? "rgba(0,229,255,0.04)" : "var(--surface2)", transition: "all 0.2s ease", position: "relative" }}
            >
              <input ref={inputRef} type="file" accept=".wav,.mp3,.flac,.ogg,.m4a,.aac,.mp4,.wma" style={{ display: "none" }} onChange={(e) => { if (e.target.files?.[0]) handleFileChange(e.target.files[0]); }} />
              <div style={{ fontSize: "2.5rem", marginBottom: "0.8rem" }}>🎵</div>
              <div style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text)", marginBottom: "0.4rem" }}>Drop your audio file here</div>
              <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "0.72rem", color: "var(--muted)", letterSpacing: "0.05em" }}>WAV · MP3 · FLAC · OGG · M4A · AAC</div>
            </div>

            {/* File preview */}
            {file && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.8rem", marginTop: "1rem", padding: "0.8rem 1rem", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 2 }}>
                <span style={{ fontSize: "1.5rem", flexShrink: 0 }}>🎧</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "0.82rem", color: "var(--accent)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{file.name}</div>
                  <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "0.7rem", color: "var(--muted)", marginTop: "0.2rem" }}>{formatBytes(file.size)}</div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); setFile(null); setStatus({ type: "idle" }); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: "1rem", padding: "0.2rem" }}>✕</button>
              </div>
            )}

            {/* Extract button */}
            <button
              onClick={handleExtract}
              disabled={!file || status.type === "loading"}
              style={{ display: "block", width: "100%", marginTop: "1.2rem", padding: "0.9rem 1.5rem", background: (!file || status.type === "loading") ? "var(--border)" : "var(--accent)", color: (!file || status.type === "loading") ? "var(--muted)" : "#000", fontFamily: "'Syne', sans-serif", fontSize: "1rem", fontWeight: 700, letterSpacing: "0.05em", border: "none", borderRadius: 2, cursor: (!file || status.type === "loading") ? "not-allowed" : "pointer", transition: "all 0.2s ease" }}
            >
              {status.type === "loading" ? "Extracting…" : "Extract Vocals"}
            </button>

            {/* Progress bar */}
            {status.type === "loading" && (
              <div style={{ height: 2, background: "var(--border)", marginTop: "0.8rem", borderRadius: 999, overflow: "hidden" }}>
                <div style={{ height: "100%", background: "linear-gradient(90deg, var(--accent2), var(--accent))", borderRadius: 999, animation: "progress 2.5s ease-in-out infinite" }} />
              </div>
            )}

            {/* Status messages */}
            {status.type === "loading" && (
              <div style={{ marginTop: "1.2rem", padding: "1rem 1.2rem", borderRadius: 2, fontFamily: "'Space Mono', monospace", fontSize: "0.82rem", lineHeight: 1.6, background: "rgba(0,229,255,0.06)", border: "1px solid rgba(0,229,255,0.2)", color: "var(--accent)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, marginRight: "0.6rem" }}>
                    {[0,.2,.4].map((d,i) => <span key={i} style={{ display: "inline-block", width: 4, height: 4, borderRadius: "50%", background: "var(--accent)", animation: `blink 1.2s ${d}s infinite` }} />)}
                  </span>
                  Running Demucs htdemucs · this may take 1–3 minutes…
                </div>
                <div style={{ marginTop: "0.5rem", opacity: 0.7 }}>Neural source separation in progress. Please keep this tab open.</div>
              </div>
            )}

            {status.type === "error" && (
              <div style={{ marginTop: "1.2rem", padding: "1rem 1.2rem", borderRadius: 2, fontFamily: "'Space Mono', monospace", fontSize: "0.82rem", lineHeight: 1.6, background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.2)", color: "var(--error)", whiteSpace: "pre-wrap" }}>
                ✗ {status.message}
              </div>
            )}

            {status.type === "success" && (
              <div style={{ marginTop: "1.2rem", padding: "1rem 1.2rem", borderRadius: 2, fontFamily: "'Space Mono', monospace", fontSize: "0.82rem", lineHeight: 1.6, background: "rgba(34,211,238,0.06)", border: "1px solid rgba(34,211,238,0.2)", color: "var(--success)" }}>
                <div>✓ Extraction complete · two stems ready</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginTop: "1rem" }}>
                  <a
                    href={getDownloadUrl(status.data.vocals_url)}
                    download={status.data.vocals_name}
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", width: "100%", padding: "0.7rem 1rem", background: "transparent", color: "var(--success)", fontFamily: "'Space Mono', monospace", fontSize: "0.78rem", fontWeight: 700, letterSpacing: "0.04em", border: "1px solid var(--success)", borderRadius: 2, textDecoration: "none", transition: "all 0.2s ease" }}
                  >
                    🎤 Vocals — {status.data.vocals_name}
                  </a>
                  {status.data.no_vocals_url && (
                    <a
                      href={getDownloadUrl(status.data.no_vocals_url)}
                      download={status.data.no_vocals_name ?? ""}
                      style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", width: "100%", padding: "0.7rem 1rem", background: "transparent", color: "var(--accent3)", fontFamily: "'Space Mono', monospace", fontSize: "0.78rem", fontWeight: 700, letterSpacing: "0.04em", border: "1px solid var(--accent3)", borderRadius: 2, textDecoration: "none", transition: "all 0.2s ease" }}
                    >
                      🎸 Instrumental — {status.data.no_vocals_name}
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Info strip */}
          <div style={{ display: "flex", gap: "1rem", marginTop: "1.5rem", animation: "fadeUp 0.8s ease 0.4s both" }}>
            {[["Model","htdemucs"],["Mode","two-stems"],["Output","WAV 44.1k"],["Backend","FastAPI"]].map(([label, value]) => (
              <div key={label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "0.3rem", padding: "0.8rem 0.5rem", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 2, textAlign: "center" }}>
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "0.65rem", letterSpacing: "0.12em", color: "var(--muted)", textTransform: "uppercase" }}>{label}</span>
                <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text)" }}>{value}</span>
              </div>
            ))}
          </div>

          {/* Health row */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "1.2rem", fontFamily: "'Space Mono', monospace", fontSize: "0.7rem", color: "var(--muted)", animation: "fadeUp 0.8s ease 0.6s both" }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", flexShrink: 0, background: !health.checked ? "var(--muted)" : healthOk ? "var(--success)" : "var(--error)", boxShadow: !health.checked ? "none" : healthOk ? "0 0 6px var(--success)" : "0 0 6px var(--error)" }} />
            <span>
              {!health.checked
                ? "Checking Demucs…"
                : healthOk
                ? "Demucs ready · ffmpeg backend active"
                : !health.ffmpeg
                ? "⚠ ffmpeg not found — install ffmpeg and add it to PATH"
                : "Demucs not found — run: pip install demucs"}
            </span>
          </div>

        </div>
      </div>
    </>
  );
}