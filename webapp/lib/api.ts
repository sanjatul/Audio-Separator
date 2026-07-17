import type { TaskCreatedResponse } from "./types";

const API_BASE = "http://localhost:8000";

export async function processYouTube(url: string): Promise<TaskCreatedResponse> {
  const res = await fetch(
    `${API_BASE}/api/process/youtube?url=${encodeURIComponent(url)}`,
    { method: "POST" },
  );
  if (!res.ok) throw new Error("Network error");
  return res.json();
}

export async function processUpload(file: File): Promise<TaskCreatedResponse> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/api/process/upload`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error("Network error");
  return res.json();
}

export function buildSSEUrl(taskId: string): string {
  return `${API_BASE}/api/tasks/${taskId}/stream`;
}

export function buildDownloadUrl(taskId: string, stem: "vocals" | "instrumental"): string {
  return `${API_BASE}/api/download/${taskId}/${stem}`;
}
