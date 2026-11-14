import { supabase } from "../lib/supabase";
import type {
  AgencyAgent,
  AgencyMission,
  MembershipUnitRow,
  OrganizationLookupRow,
  OrganizationTransfer,
  OrganizationUnitAssignment,
  OrganizationUnitListItem,
  PublicReportSummary,
  UnitSummary,
} from "../types/organization";

export type OrganizationMembership = {
  organization_id: string;
  unit_id: string | null;
  role: "admin" | "supervisor" | "operator";
  organization: { id: string; name: string; code: string; type: string; logo_url: string | null };
  unit: { id: string; name: string; code: string; unit_type: "central" | "agency" } | null;
};

export async function getMyOrganizationMembership(): Promise<OrganizationMembership | null> {
  if (!supabase) return null;
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) return null;

  const { data: memberships, error } = await supabase
    .from("organization_users")
    .select("organization_id,unit_id,role,created_at")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  if (error) throw error;
  if (!memberships?.length) return null;

  const organizationIds = [...new Set(memberships.map((m) => m.organization_id).filter(Boolean))];
  const unitIds = [...new Set(memberships.map((m) => m.unit_id).filter(Boolean))] as string[];
  const [{ data: organizations, error: orgError }, { data: linkedUnits, error: unitError }] =
    await Promise.all([
      supabase
        .from("organizations")
        .select("id,name,code,type,is_active,logo_url")
        .in("id", organizationIds),
      unitIds.length
        ? supabase
            .from("organization_units")
            .select("id,organization_id,name,code,unit_type,is_active")
            .in("id", unitIds)
        : Promise.resolve({ data: [], error: null } as { data: MembershipUnitRow[]; error: null }),
    ]);
  if (orgError) throw orgError;
  if (unitError) throw unitError;

  const organizationById = new Map<string, OrganizationLookupRow>(
    (organizations ?? []).map((o) => [o.id, o]),
  );
  const unitById = new Map<string, MembershipUnitRow>((linkedUnits ?? []).map((u) => [u.id, u]));
  const hydrated = memberships
    .map((m) => ({
      membership: m,
      organization: organizationById.get(m.organization_id) ?? null,
      unit: m.unit_id ? (unitById.get(m.unit_id) ?? null) : null,
    }))
    .filter((x) => x.organization?.is_active !== false);

  for (const item of hydrated) {
    if (item.unit || item.membership.unit_id) continue;
    const { data: centralUnits, error: centralError } = await supabase
      .from("organization_units")
      .select("id,organization_id,name,code,unit_type,is_active")
      .eq("organization_id", item.membership.organization_id)
      .eq("unit_type", "central")
      .eq("is_active", true);
    if (centralError) throw centralError;
    if (centralUnits?.length === 1) item.unit = centralUnits[0];
  }

  hydrated.sort((a, b) => Number(Boolean(b.unit)) - Number(Boolean(a.unit)));
  const selected = hydrated[0];
  if (!selected?.organization) return null;
  return {
    organization_id: selected.membership.organization_id,
    unit_id: selected.unit?.id ?? selected.membership.unit_id ?? null,
    role: selected.membership.role as OrganizationMembership["role"],
    organization: selected.organization,
    // unit_type is a plain string column in the generated types; the union is enforced by the app.
    unit: selected.unit as OrganizationMembership["unit"],
  };
}

export async function listOrganizationTransfers(): Promise<OrganizationTransfer[]> {
  if (!supabase) throw new Error("Supabase non configuré.");
  const { data, error } = await supabase
    .from("report_organization_transfers")
    .select("id,report_id,organization_id,from_mairie_id,status,transmitted_at,response_note")
    .order("transmitted_at", { ascending: false });
  if (error) throw error;
  const rows = data ?? [],
    ids = rows.map((x) => x.report_id);
  if (!ids.length) return rows;
  const { data: reports, error: re } = await supabase
    .from("public_reports")
    .select("id,reference_code,title,status,priority,latitude,longitude,location_label,created_at")
    .in("id", ids);
  if (re) throw re;
  // The generated public_reports view type has no latitude/longitude, so Supabase types this select as an error type.
  const byId = new Map<string | null, PublicReportSummary>(
    ((reports ?? []) as unknown as PublicReportSummary[]).map((r) => [r.id, r]),
  );
  return rows.map((r) => ({ ...r, reports: byId.get(r.report_id) ?? null }));
}

export async function acceptOrganizationTransfer(id: string, note?: string) {
  if (!supabase) throw new Error("Supabase non configuré.");
  const { data, error } = await supabase.rpc("organization_accept_transfer", {
    p_transfer_id: id,
    p_note: note?.trim() || undefined,
  });
  if (error) throw error;
  return data;
}
export async function declineOrganizationTransfer(id: string, note: string) {
  if (!supabase) throw new Error("Supabase non configuré.");
  const { data, error } = await supabase.rpc("organization_decline_transfer", {
    p_transfer_id: id,
    p_note: note,
  });
  if (error) throw error;
  return data;
}
export async function listOrganizationUnits(
  organizationId: string,
  centralUnitId?: string | null,
): Promise<OrganizationUnitListItem[]> {
  if (!supabase) throw new Error("Supabase non configuré.");
  let query = supabase
    .from("organization_units")
    .select("id,name,code,unit_type,region_id,commune_id,parent_unit_id,is_active")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("unit_type")
    .order("name");
  if (centralUnitId) query = query.eq("parent_unit_id", centralUnitId);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}
export async function assignOrganizationAgency(transferId: string, unitId: string, note?: string) {
  if (!supabase) throw new Error("Supabase non configuré.");
  const { data, error } = await supabase.rpc("organization_assign_agency", {
    p_transfer_id: transferId,
    p_agency_unit_id: unitId,
    p_note: note?.trim() || undefined,
  });
  if (error) throw error;
  return data;
}
export async function listOrganizationUnitAssignments(
  organizationId: string,
): Promise<OrganizationUnitAssignment[]> {
  if (!supabase) throw new Error("Supabase non configuré.");
  const { data, error } = await supabase
    .from("report_unit_assignments")
    .select(
      "id,report_id,organization_id,unit_id,status,assigned_at,started_at,completed_at,mission_note",
    )
    .eq("organization_id", organizationId)
    .order("assigned_at", { ascending: false });
  if (error) throw error;
  const rows = data ?? [],
    ids = rows.map((x) => x.report_id),
    unitIds = [...new Set(rows.map((x) => x.unit_id).filter(Boolean))];
  if (!ids.length) return [];
  const [{ data: reports, error: re }, { data: units, error: ue }] = await Promise.all([
    supabase
      .from("public_reports")
      .select("id,reference_code,title,status,priority,location_label,created_at")
      .in("id", ids),
    unitIds.length
      ? supabase.from("organization_units").select("id,name,code").in("id", unitIds)
      : Promise.resolve({ data: [], error: null } as { data: UnitSummary[]; error: null }),
  ]);
  if (re) throw re;
  if (ue) throw ue;
  const byReport = new Map<string | null, PublicReportSummary>(
    (reports ?? []).map((r) => [r.id, r]),
  );
  const byUnit = new Map<string, UnitSummary>((units ?? []).map((u) => [u.id, u]));
  return rows.map((r) => ({
    ...r,
    reports: byReport.get(r.report_id) ?? null,
    unit: byUnit.get(r.unit_id) ?? null,
  }));
}
export async function listAgencyMissions(unitId: string): Promise<AgencyMission[]> {
  if (!supabase) throw new Error("Supabase non configuré.");
  const { data, error } = await supabase
    .from("report_unit_assignments")
    .select("id,report_id,organization_id,unit_id,status,assigned_at,mission_note")
    .eq("unit_id", unitId)
    .order("assigned_at", { ascending: false });
  if (error) throw error;
  const rows = data ?? [],
    ids = rows.map((x) => x.report_id);
  if (!ids.length) return rows;
  const { data: reports, error: re } = await supabase
    .from("public_reports")
    .select("id,reference_code,title,status,priority,latitude,longitude,location_label,created_at")
    .in("id", ids);
  if (re) throw re;
  // The generated public_reports view type has no latitude/longitude, so Supabase types this select as an error type.
  const byId = new Map<string | null, PublicReportSummary>(
    ((reports ?? []) as unknown as PublicReportSummary[]).map((r) => [r.id, r]),
  );
  return rows.map((r) => ({ ...r, reports: byId.get(r.report_id) ?? null }));
}
export async function assignAgencyMissionToAgent(
  missionId: string,
  agentId: string,
  note?: string,
) {
  if (!supabase) throw new Error("Supabase non configuré.");
  const { data, error } = await supabase.rpc("agency_assign_report_to_agent", {
    p_unit_assignment_id: missionId,
    p_agent_id: agentId,
    p_mission_note: note?.trim() || undefined,
  });
  if (error) throw error;
  return data;
}
export async function listAgencyAgents(
  organizationId: string,
  unitId: string,
): Promise<AgencyAgent[]> {
  if (!supabase) throw new Error("Supabase non configuré.");
  const { data, error } = await supabase
    .from("field_agents")
    .select(
      "id,first_name,last_name,matricule,qualification,phone,is_active,organization_id,organization_unit_id",
    )
    .eq("organization_id", organizationId)
    .eq("organization_unit_id", unitId)
    .eq("is_active", true)
    .order("last_name");
  if (error) throw error;
  return data ?? [];
}

export async function createAgencyAgent(input: {
  first_name: string;
  last_name: string;
  matricule: string;
  qualification: string;
  phone?: string;
  password: string;
}) {
  if (!supabase) throw new Error("Supabase non configuré.");
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  if (sessionError) throw new Error("Impossible de vérifier la session : " + sessionError.message);
  if (!session) throw new Error("Session requise. Reconnectez-vous puis réessayez.");
  const { data, error } = await supabase.functions.invoke("agency-create-agent", {
    body: input,
    headers: { Authorization: "Bearer " + session.access_token },
  });
  if (error) {
    const context = error.context;
    let message = error.message || "La création de l’agent a échoué.";
    if (context instanceof Response) {
      try {
        const payload = await context.clone().json();
        if (typeof payload?.error === "string" && payload.error.trim())
          message = payload.error.trim();
        else if (typeof payload?.message === "string" && payload.message.trim())
          message = payload.message.trim();
      } catch {
        message =
          "Le service de création d’agent a renvoyé une réponse inattendue. Vérifiez la configuration Supabase puis réessayez.";
      }
    }
    throw new Error(message);
  }
  if (!data?.agent)
    throw new Error(
      typeof data?.error === "string"
        ? data.error
        : "Le service n’a pas confirmé la création de l’agent.",
    );
  return data.agent;
}

export async function createOrganizationAgency(input: {
  organization_id: string;
  name: string;
  code: string;
  admin_password: string;
}) {
  if (!supabase) throw new Error("Supabase non configuré.");
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  if (sessionError) throw new Error("Impossible de vérifier la session : " + sessionError.message);
  if (!session) throw new Error("Session requise. Reconnectez-vous puis réessayez.");
  const { data, error } = await supabase.functions.invoke("organization-create-agency", {
    body: {
      organization_id: input.organization_id,
      name: input.name,
      code: input.code,
      admin_password: input.admin_password,
    },
    headers: { Authorization: "Bearer " + session.access_token },
  });
  if (error) {
    const context = error.context;
    let message = error.message || "La création du compte d’agence a échoué.";
    if (context instanceof Response) {
      try {
        const payload = await context.clone().json();
        if (typeof payload?.error === "string" && payload.error.trim())
          message = payload.error.trim();
      } catch {
        message = "Le service de création d’agence a renvoyé une réponse inattendue.";
      }
    }
    throw new Error(message);
  }
  if (!data?.agency || !data?.admin_user_id)
    throw new Error(
      typeof data?.error === "string"
        ? data.error
        : "Le service n’a pas confirmé la création du compte d’agence.",
    );
  return data;
}

export async function uploadOrganizationLogo(organizationId: string, file: File) {
  if (!supabase) throw new Error("Supabase non configuré.");
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("Format accepté : JPG, PNG ou WEBP.");
  if (file.size > 2 * 1024 * 1024) throw new Error("Le logo ne doit pas dépasser 2 Mo.");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Session requise.");
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("id,logo_url")
    .eq("id", organizationId)
    .single();
  if (orgError) throw orgError;
  const extension = file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : "webp";
  const path = "organization/" + organizationId + "/" + crypto.randomUUID() + "." + extension;
  const { error: uploadError } = await supabase.storage
    .from("organization-logos")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) throw uploadError;
  const { data } = supabase.storage.from("organization-logos").getPublicUrl(path);
  const { error: updateError } = await supabase
    .from("organizations")
    .update({ logo_url: data.publicUrl })
    .eq("id", organizationId);
  if (updateError) {
    await supabase.storage.from("organization-logos").remove([path]);
    throw updateError;
  }
  if (org.logo_url) {
    const oldPath = org.logo_url.split("/organization-logos/")[1]?.split("?")[0];
    if (oldPath)
      await supabase.storage.from("organization-logos").remove([decodeURIComponent(oldPath)]);
  }
  return data.publicUrl;
}
