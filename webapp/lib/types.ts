export type AppStatus = "idle" | "processing" | "success" | "error";

export type PipelineStepKey =
  | "pending"
  | "downloading"
  | "converting"
  | "separating"
  | "enhancing"
  | "converting_to_mp3"
  | "completed";

export interface PipelineStep {
  key: PipelineStepKey;
  label: string;
}

export interface DownloadUrls {
  vocals: string;
  instrumental: string;
}

export interface TaskCreatedResponse {
  status: "success";
  data: { task_id: string };
  message: string;
}

export interface SSEPayload {
  status: PipelineStepKey | "failed" | "cancelled" | "not_found";
  vocals_url?: string;
  instrumental_url?: string;
}
