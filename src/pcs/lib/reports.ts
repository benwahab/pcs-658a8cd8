import { supabase } from "./supabase";
import type { Category, PublicReport, ReportPriority, ReportStatus } from "../types";

import { postFormWithProgress } from "./uploadWithProgress";

const SUBMIT_FAILED_MESSAGE =
  "L’envoi du signalement a échoué. Vérifiez votre connexion et réessayez.";

function randomTraceId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// The shared Supabase client reports every `fetch` request to the CST monitoring.
// XMLHttpRequest bypasses it, so the submission is reported here with the same payload.
function reportSubmitTelemetry(
  baseUrl: string,
  token: string,
  event: { endpoint: string; statusCode: number; latencyMs: number; errorClass?: string },
): void {
  try {
    void fetch(`${baseUrl}/functions/v1/cst-telemetry`, {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        events: [
          {
            trace_id: randomTraceId(),
            occurred_at: Date.now(),
            method: "POST",
            endpoint: event.endpoint,
            status_code: event.statusCode,
            latency_ms: event.latencyMs,
            ...(event.errorClass ? { error_class: event.errorClass } : {}),
          },
        ],
      }),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Monitoring must never break a citizen's submission.
  }
}

export async function listCategories(): Promise<Category[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("categories")
    .select("id,name,slug")
    .eq("is_active", true)
    .order("name");

  if (error) throw error;
  return data ?? [];
}

export async function listPublicReports(): Promise<PublicReport[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("public_reports")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((report) => ({
    ...report,
    status: report.status as ReportStatus,
    priority: report.priority as ReportPriority,
  }));
}

export async function changeStatus(reportId: string, status: ReportStatus): Promise<void> {
  if (!supabase) {
    throw new Error("Supabase n'est pas configuré.");
  }

  const { error } = await supabase.from("reports").update({ status }).eq("id", reportId);

  if (error) throw error;
}

interface CitizenReportInput {
  category_id: string;
  region_id: string;
  commune_id: string;
  title: string;
  location_label?: string | null;
  latitude: number;
  longitude: number;
  gps_accuracy_m: number;
  photos: File[];
  video?: File | null;
}

interface CitizenReportResult {
  success: true;
  reference_code: string;
}

export async function submitCitizenReport(
  input: CitizenReportInput,
  onUploadProgress?: (ratio: number) => void,
): Promise<CitizenReportResult> {
  if (!supabase) {
    throw new Error("Supabase n'est pas configuré.");
  }

  const body = new FormData();

  body.append("category_id", input.category_id);
  body.append("region_id", input.region_id);
  body.append("commune_id", input.commune_id);
  body.append("title", input.title);
  body.append("latitude", String(input.latitude));
  body.append("longitude", String(input.longitude));
  body.append("gps_accuracy_m", String(input.gps_accuracy_m));

  if (input.location_label) {
    body.append("location_label", input.location_label);
  }

  input.photos.slice(0, 5).forEach((file) => body.append("photos", file, file.name));

  if (input.video) {
    body.append("video", input.video, input.video.name);
  }

  // Same endpoint and credentials as `supabase.functions.invoke`, but sent with
  // XMLHttpRequest so the upload progress can be shown to the citizen.
  const baseUrl: string = supabase["supabaseUrl"];
  const apiKey: string = supabase["supabaseKey"];
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token ?? apiKey;
  const endpoint = `${baseUrl}/functions/v1/citizen-report-submit`;
  const started = performance.now();

  let response: Awaited<ReturnType<typeof postFormWithProgress>>;
  try {
    response = await postFormWithProgress({
      url: endpoint,
      headers: { apikey: apiKey, Authorization: `Bearer ${token}` },
      body,
      onProgress: onUploadProgress,
    });
  } catch {
    reportSubmitTelemetry(baseUrl, token, {
      endpoint,
      statusCode: 0,
      latencyMs: Math.round(performance.now() - started),
      errorClass: "NetworkError",
    });
    throw new Error(SUBMIT_FAILED_MESSAGE);
  }
  reportSubmitTelemetry(baseUrl, token, {
    endpoint,
    statusCode: response.status,
    latencyMs: Math.round(performance.now() - started),
  });

  if (response.status < 200 || response.status >= 300) {
    throw new Error(SUBMIT_FAILED_MESSAGE);
  }
  const data = response.data as {
    error?: unknown;
    success?: unknown;
    reference_code?: unknown;
  } | null;
  if (data?.error) {
    const message = typeof data.error === "string" ? data.error : "";
    throw new Error(
      message && /^[A-Za-zÀ-ÿ]/.test(message)
        ? message
        : "Le signalement n’a pas pu être enregistré. Vérifiez les informations et les médias, puis réessayez.",
    );
  }
  if (!data || data.success !== true || typeof data.reference_code !== "string") {
    throw new Error(
      "Le serveur a renvoyé une réponse inattendue. Votre signalement n’est pas confirmé.",
    );
  }

  return data as CitizenReportResult;
}
