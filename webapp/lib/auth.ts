const API_BASE = "http://localhost:8000";

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

export interface UserProfile {
  id: number;
  name: string;
  email: string;
  is_active: boolean;
}

// ---------------------------------------------------------------------------
// Token persistence (localStorage)
// ---------------------------------------------------------------------------
const STORAGE_KEY = "sonicsplit_auth";

export function loadTokens(): AuthTokens | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveTokens(tokens: AuthTokens) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
}

export function clearTokens() {
  localStorage.removeItem(STORAGE_KEY);
}

export function getAccessToken(): string | null {
  return loadTokens()?.access_token ?? null;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------
async function authFetch(path: string, opts: RequestInit = {}) {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((opts.headers as Record<string, string>) ?? {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });
  const body = await res.json();

  if (!res.ok) {
    throw new Error(body.detail ?? "Request failed");
  }
  return body;
}

export async function register(
  name: string,
  email: string,
  password: string,
): Promise<void> {
  await authFetch("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ name, email, password }),
  });
}

export async function login(
  email: string,
  password: string,
): Promise<AuthTokens> {
  const data = await authFetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  const tokens: AuthTokens = {
    access_token: data.data.access_token,
    refresh_token: data.data.refresh_token,
  };
  saveTokens(tokens);
  return tokens;
}

export async function refreshAccessToken(): Promise<AuthTokens> {
  const current = loadTokens();
  if (!current?.refresh_token) throw new Error("No refresh token");

  const data = await authFetch("/api/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refresh_token: current.refresh_token }),
  });
  const tokens: AuthTokens = {
    access_token: data.data.access_token,
    refresh_token: data.data.refresh_token,
  };
  saveTokens(tokens);
  return tokens;
}

export async function getProfile(): Promise<UserProfile> {
  const data = await authFetch("/api/auth/profile");
  return data.data;
}

export function logout() {
  clearTokens();
}
