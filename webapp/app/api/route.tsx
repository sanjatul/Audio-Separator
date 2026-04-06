const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface HealthResponse {
  status: string;
  demucs_available: boolean;
  ffmpeg_available: boolean;
}

export interface ExtractResponse {
  vocals_url: string;
  no_vocals_url: string | null;
  vocals_name: string;
  no_vocals_name: string | null;
}

export async function checkHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_URL}/health`);
  if (!res.ok) {
    throw new Error("Server unreachable");
  }

  return res.json();
}

export async function extractVocals(file: File): Promise<ExtractResponse> {
  const formData = new FormData();
  formData.append("audio", file);

  const res = await fetch(`${API_URL}/extract`, {
    method: "POST",
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Extraction failed");
  }
  return data;
}

export function getDownloadUrl(path: string): string {
  return `${API_URL}${path}`;
}