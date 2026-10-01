import { supabase } from "./supabase";
import type {
  Category,
  PublicReport,
  ReportPriority,
  ReportStatus,
} from "../types";

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

export async function changeStatus(
  reportId: string,
  status: ReportStatus,
): Promise<void> {
  if (!supabase) {
    throw new Error("Supabase n'est pas configuré.");
  }

  const { error } = await supabase
    .from("reports")
    .update({ status })
    .eq("id", reportId);

  if (error) throw error;
}

interface CitizenReportInput {
  category_id: string;
  region_id: string;
  commune_id: string;
  title: string;
  description: string;
  location_label?: string | null;
  latitude: number;
  longitude: number;
  photos: File[];
  video?: File | null;
}

interface CitizenReportResult {
  success: true;
  reference_code: string;
}

export async function submitCitizenReport(
  input: CitizenReportInput,
): Promise<CitizenReportResult> {
  if (!supabase) {
    throw new Error("Supabase n'est pas configuré.");
  }

  const body = new FormData();

  body.append("category_id", input.category_id);
  body.append("region_id", input.region_id);
  body.append("commune_id", input.commune_id);
  body.append("title", input.title);
  body.append("description", input.description);
  body.append("latitude", String(input.latitude));
  body.append("longitude", String(input.longitude));

  if (input.location_label) {
    body.append("location_label", input.location_label);
  }

  input.photos
    .slice(0, 5)
    .forEach((file) => body.append("photos", file, file.name));

  if (input.video) {
    body.append("video", input.video, input.video.name);
  }

  const { data, error } = await supabase.functions.invoke(
    "citizen-report-submit",
    { body },
  );

  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));

  return data as CitizenReportResult;
}
