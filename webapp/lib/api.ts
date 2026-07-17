import type { TaskCreatedResponse, TaskRecord } from "./types";
import { getAccessToken } from "./auth";

const API_BASE = "http://localhost:8000";

function authHeaders(): Record<string, string> {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function processYouTube(url: string): Promise<TaskCreatedResponse> {
  const res = await fetch(
    `${API_BASE}/api/process/youtube?url=${encodeURIComponent(url)}`,
    { method: "POST", headers: authHeaders() },
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
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Network error");
  return res.json();
}

export function buildSSEUrl(taskId: string): string {
  return `${API_BASE}/api/tasks/${taskId}/stream`;
}

export function buildDownloadUrl(
  taskId: string,
  stem: "vocals" | "instrumental",
): string {
  return `${API_BASE}/api/download/${taskId}/${stem}`;
}

export async function fetchTasks(): Promise<TaskRecord[]> {
  const res = await fetch(`${API_BASE}/api/tasks`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch tasks");
  const data = await res.json();
  return data.data ?? [];
}
