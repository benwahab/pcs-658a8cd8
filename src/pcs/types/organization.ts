// Type-only shapes used by the organization service and pages.
// Row types come from the generated Supabase types (src/integrations/supabase/types.ts);
// each alias below mirrors the exact `.select("...")` string of the query that returns it.
import type { Tables } from "@/integrations/supabase/types";

// organization_users: select "organization_id,unit_id,role,created_at".
export type OrganizationMemberRow = Pick<
  Tables<"organization_users">,
  "organization_id" | "unit_id" | "role" | "created_at"
>;

// organizations: select "id,name,code,type,is_active,logo_url".
export type OrganizationLookupRow = Pick<
  Tables<"organizations">,
  "id" | "name" | "code" | "type" | "is_active" | "logo_url"
>;

// organization_units: select "id,organization_id,name,code,unit_type,is_active".
// `unit_type` is a plain string column in the database.
export type MembershipUnitRow = Pick<
  Tables<"organization_units">,
  "id" | "organization_id" | "name" | "code" | "unit_type" | "is_active"
>;

// organization_units: select "id,name,code,unit_type,region_id,commune_id,parent_unit_id,is_active".
export type OrganizationUnitListItem = Pick<
  Tables<"organization_units">,
  "id" | "name" | "code" | "unit_type" | "region_id" | "commune_id" | "parent_unit_id" | "is_active"
>;

// organization_units: select "id,name,code" (unit joined onto an assignment).
export type UnitSummary = Pick<Tables<"organization_units">, "id" | "name" | "code">;

// public_reports view: the columns the services select. The generated view type has no
// latitude/longitude columns, so they are declared optional here (they are requested by
// the select string but not described by the generated types).
export type PublicReportSummary = Pick<
  Tables<"public_reports">,
  "id" | "reference_code" | "title" | "status" | "priority" | "location_label" | "created_at"
> & {
  latitude?: number | null;
  longitude?: number | null;
};

// report_organization_transfers: select
// "id,report_id,organization_id,from_mairie_id,status,transmitted_at,response_note",
// optionally with the matching public report attached as `reports`.
export type OrganizationTransfer = Pick<
  Tables<"report_organization_transfers">,
  | "id"
  | "report_id"
  | "organization_id"
  | "organization_unit_id"
  | "from_mairie_id"
  | "status"
  | "transmitted_at"
  | "response_note"
> & {
  reports?: PublicReportSummary | null;
};

// report_unit_assignments: select
// "id,report_id,organization_id,unit_id,status,assigned_at,started_at,completed_at,mission_note",
// with the matching public report and unit attached.
export type OrganizationUnitAssignment = Pick<
  Tables<"report_unit_assignments">,
  | "id"
  | "report_id"
  | "organization_id"
  | "unit_id"
  | "status"
  | "assigned_at"
  | "started_at"
  | "completed_at"
  | "mission_note"
> & {
  reports: PublicReportSummary | null;
  unit: UnitSummary | null;
};

// report_unit_assignments: select "id,report_id,organization_id,unit_id,status,assigned_at,mission_note",
// optionally with the matching public report attached as `reports`.
export type AgencyMission = Pick<
  Tables<"report_unit_assignments">,
  "id" | "report_id" | "organization_id" | "unit_id" | "status" | "assigned_at" | "mission_note"
> & {
  reports?: PublicReportSummary | null;
};

// field_agents: select
// "id,first_name,last_name,matricule,qualification,phone,is_active,organization_id,organization_unit_id".
export type AgencyAgent = Pick<
  Tables<"field_agents">,
  | "id"
  | "first_name"
  | "last_name"
  | "matricule"
  | "qualification"
  | "phone"
  | "is_active"
  | "organization_id"
  | "organization_unit_id"
>;

// regions / communes options shown in the organization signup form (only id and name are read).
export type RegionOption = Pick<Tables<"regions">, "id" | "name">;
export type CommuneOption = Pick<Tables<"communes">, "id" | "name">;
