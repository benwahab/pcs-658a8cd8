// Type-only shapes for the CST console (src/pcs/pages/CST.tsx).
// Each type mirrors the JSON returned by the matching edge function in
// supabase/edge-functions-source/*; row types reuse the generated Supabase types.
import type { Database, Tables } from "@/integrations/supabase/types";

export type OrganizationSignupRequest =
  Database["public"]["Functions"]["list_organization_signup_requests"]["Returns"][number];
export type MairieSignupRequest =
  Database["public"]["Functions"]["list_pending_mairie_requests"]["Returns"][number];

// cst-health: "id,trace_id,occurred_at,method,endpoint,status_code,latency_ms,source,error_class"
export type CstRequestEvent = Pick<
  Tables<"cst_request_events">,
  | "id"
  | "trace_id"
  | "occurred_at"
  | "method"
  | "endpoint"
  | "status_code"
  | "latency_ms"
  | "source"
  | "error_class"
>;

// cst-health: "id,occurred_at,event_type,message,page,browser,device,trace_id"
export type CstFrontendEvent = Pick<
  Tables<"cst_frontend_events">,
  "id" | "occurred_at" | "event_type" | "message" | "page" | "browser" | "device" | "trace_id"
>;

export type CstApiEndpoint = {
  method: string;
  endpoint: string;
  requests: number;
  errors: number;
  last_activity: string;
  avg_latency_ms: number | null;
  error_rate: number;
};

export type CstHealth = {
  environment: string;
  checked_at: string;
  database: {
    status: string;
    latency_ms?: number | null;
    connection_utilization_percent?: number | null;
    database_size_bytes?: number | null;
    connections?: number | null;
    max_connections?: number | null;
  };
  metrics: {
    requests_per_minute: number;
    average_latency_ms: number | null;
    error_rate_percent: number;
    active_users: number;
  };
  live_requests: CstRequestEvent[];
  frontend_events: CstFrontendEvent[];
  api_monitoring: CstApiEndpoint[];
  connected_sources: Record<string, boolean>;
};

// cst-operations
export type CstOperations = {
  checked_at: string;
  organizations: {
    code: string;
    name: string;
    is_active: boolean;
    central_units: number;
    local_units: number;
  }[];
  totals: {
    organizations_active: number;
    units_active: number;
    central_units_active: number;
    local_units_active: number;
  };
  reports: Record<string, number>;
  missions: Record<string, number>;
};

// cst-auth `list_professional_accounts`
export type CstProfessionalAccount = {
  key: string;
  type: string;
  entity_id: string;
  user_id: string;
  name: string;
  structure: string;
  region: string;
  email: string;
  phone: string;
  is_active: boolean;
  approval_status: string;
};

// cst-media-moderation `list`: report_media row + embedded report + signed preview URL.
export type CstMediaItem = Pick<
  Tables<"report_media">,
  | "id"
  | "report_id"
  | "storage_path"
  | "media_type"
  | "media_role"
  | "file_size"
  | "created_at"
  | "captured_latitude"
  | "captured_longitude"
  | "uploaded_by"
  | "moderation_status"
> & {
  report: Pick<
    Tables<"reports">,
    | "id"
    | "reference_code"
    | "title"
    | "status"
    | "priority"
    | "location_label"
    | "created_at"
    | "is_public"
    | "region_id"
  > | null;
  preview_url: string | null;
};

// cst-video-archives `list`
export type CstArchiveItem = Pick<
  Tables<"cst_video_archives">,
  "id" | "media_id" | "report_id" | "archived_at" | "expires_at" | "hold_reason" | "deleted_at"
> & {
  media_type: string;
  file_size: number | null;
  media_created_at: string;
  preview_url: string | null;
  report: Pick<
    Tables<"reports">,
    "id" | "reference_code" | "title" | "location_label" | "status" | "created_at" | "region_id"
  >;
};

// cst-report-management `list`
export type CstReportRow = Pick<
  Tables<"reports">,
  | "id"
  | "reference_code"
  | "title"
  | "status"
  | "priority"
  | "location_label"
  | "region_id"
  | "created_at"
  | "archived_at"
  | "is_public"
> & { regions: { name: string } | null };

// Statistics query: select "id,created_at,status,categories(name),regions(name)"
export type CstStatRow = Pick<Tables<"reports">, "id" | "created_at" | "status"> & {
  categories: { name: string } | null;
  regions: { name: string } | null;
};

export type CstAlert = { severity: "critical" | "warning"; title: string; detail: string };

// cst-auth `list_moderators`: "user_id,email,full_name,region_id,is_active,created_at,updated_at,regions(id,name,code)"
export type CstModerator = Tables<"moderator_profiles"> & {
  regions: Pick<Tables<"regions">, "id" | "name" | "code"> | null;
};
