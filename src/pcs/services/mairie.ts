import { supabase } from "../lib/supabase";
import type { FunctionInvokeError } from "../types/functions";
import { compressCitizenVideo, uploadResolutionVideo } from "./media";

export type MairieTransmissionTarget = {
  organization_id: string;
  organization_name: string;
  organization_code: string;
  organization_type: string;
  organization_unit_id: string;
  organization_unit_name: string;
  organization_unit_code: string;
  organization_unit_type: string;
  commune_id: string;
  commune_name: string;
};

export async function getMyMairie() {
  if (!supabase) throw new Error("Supabase non configuré.");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("mairies")
    .select(
      "id,name,region_id,commune_id,account_user_id,phone,is_active,approval_status,mayor_name,logo_url,latitude,longitude,location_label,regions!mairies_region_id_fkey(id,name,code,geoname_id),communes!mairies_commune_id_fkey(id,name)",
    )
    .eq("account_user_id", user.id)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}
export async function listCommunes(regionId: string) {
  if (!supabase) throw new Error("Supabase non configuré.");
  const { data, error } = await supabase
    .from("communes")
    .select("id,name,region_id")
    .eq("region_id", regionId)
    .eq("is_active", true)
    .order("name");
  if (error) throw error;
  return data ?? [];
}
export async function listAllCommunes() {
  if (!supabase) throw new Error("Supabase non configuré.");
  const { data, error } = await supabase
    .from("communes")
    .select("id,name,region_id")
    .eq("is_active", true)
    .order("name");
  if (error) throw error;
  return data ?? [];
}
export async function listRegions() {
  if (!supabase) throw new Error("Supabase non configuré.");
  const { data, error } = await supabase.from("regions").select("*").order("name");
  if (error) throw error;
  return data ?? [];
}
export async function listMyAgents() {
  if (!supabase) throw new Error("Supabase non configuré.");
  const { data, error } = await supabase.from("field_agents").select("*").order("last_name");
  if (error) throw error;
  return data ?? [];
}
export async function listMairieReports() {
  if (!supabase) throw new Error("Supabase non configuré.");
  const [{ data: reports, error: reportsError }, { data: transfers, error: transfersError }] =
    await Promise.all([
      supabase
        .from("reports")
        .select("*,categories(name),regions(name)")
        .order("created_at", { ascending: false }),
      // The mairie's RLS scope exposes only its own outgoing transfers.
      // Pending and accepted transfers leave the mairie work queue; declined ones return.
      supabase
        .from("report_organization_transfers")
        .select("report_id,status")
        .in("status", ["pending", "accepted", "completed"]),
    ]);
  if (reportsError) throw reportsError;
  if (transfersError) throw transfersError;
  const transferredIds = new Set((transfers ?? []).map((item) => item.report_id));
  return (reports ?? []).filter((report) => !transferredIds.has(report.id));
}
export async function listMairieTransmissionTargets(): Promise<MairieTransmissionTarget[]> {
  if (!supabase) throw new Error("Supabase non configuré.");
  const { data, error } = await supabase.rpc("list_mairie_transmission_targets");
  if (error) throw error;
  return Array.isArray(data) ? (data as MairieTransmissionTarget[]) : [];
}
export async function transmitReportToOrganization(
  reportId: string,
  organizationId: string,
  organizationUnitId: string,
  note?: string,
) {
  if (!supabase) throw new Error("Supabase non configuré.");
  const { data, error } = await supabase.rpc("mairie_transmit_report", {
    p_report_id: reportId,
    p_organization_id: organizationId,
    p_organization_unit_id: organizationUnitId,
    p_note: note?.trim() || undefined,
  });
  if (error) throw error;
  return data;
}
export async function assignMission(reportId: string, agentId: string, note?: string) {
  if (!supabase) throw new Error("Supabase non configuré.");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Session requise.");
  const { data: agent, error: ae } = await supabase
    .from("field_agents")
    .select("user_id,mairie_id,is_active")
    .eq("id", agentId)
    .single();
  if (ae) throw ae;
  if (!agent.is_active) throw new Error("Cet agent est inactif.");
  const { error } = await supabase.from("report_assignments").insert({
    report_id: reportId,
    agent_id: agent.user_id,
    assigned_by: user.id,
    mission_note: note?.trim() || null,
    assignment_status: "assigned",
  });
  if (error) throw error;
}
export async function listMyMissions() {
  if (!supabase) throw new Error("Supabase non configuré.");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("report_assignments")
    .select(
      "id,report_id,agent_id,assigned_by,assigned_at,unassigned_at,assignment_status,mission_note,unit_assignment_id",
    )
    .eq("agent_id", user.id)
    .is("unassigned_at", null)
    .order("assigned_at", { ascending: false });
  if (error) throw error;
  const rows = data ?? [];
  if (!rows.length) return [];
  const ids = rows.map((x) => x.report_id);
  const { data: reports, error: re } = await supabase
    .from("reports")
    .select(
      "id,reference_code,title,status,priority,latitude,longitude,location_label,created_at,updated_at,resolution_note,resolved_at",
    )
    .in("id", ids);
  if (re) throw re;
  const byId = new Map((reports ?? []).map((r) => [r.id, r] as const));
  return rows
    .map((r) => ({ ...r, reports: byId.get(r.report_id) ?? null }))
    .filter((r): r is typeof r & { reports: NonNullable<typeof r.reports> } => !!r.reports);
}
export async function confirmFieldVerification(
  reportId: string,
  latitude: number,
  longitude: number,
  accuracyM: number | null,
) {
  if (!supabase) throw new Error("Supabase non configuré.");
  if (accuracyM === null) throw new Error("La précision GPS est requise.");
  const { data, error } = await supabase.rpc("agent_confirm_field_verification", {
    p_report_id: reportId,
    p_latitude: latitude,
    p_longitude: longitude,
    p_accuracy_m: accuracyM,
  });
  if (error) throw error;
  return data;
}
export async function resolveMissionWithVideo(
  reportId: string,
  video: File,
  latitude: number,
  longitude: number,
  accuracyM: number | null,
  note?: string,
  onCompressProgress?: (ratio: number) => void,
) {
  if (!supabase) throw new Error("Supabase non configuré.");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Session requise.");
  if (
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  )
    throw new Error("Coordonnées GPS invalides.");
  if (accuracyM === null || !Number.isFinite(accuracyM) || accuracyM < 0 || accuracyM > 20)
    throw new Error("La précision GPS doit être de 20 mètres ou moins.");
  const { data: report, error: reportError } = await supabase
    .from("reports")
    .select("status")
    .eq("id", reportId)
    .maybeSingle();
  if (reportError) throw reportError;
  if (!report) throw new Error("Signalement introuvable.");
  if (report.status === "resolved") return true;
  // Re-encode heavy field videos (720p H.264 MP4) so the upload is faster and
  // the public feed can play them smoothly. Light files, unsupported browsers
  // and any failure keep the original file; GPS data is passed separately and
  // is not read from the video file.
  const optimizedVideo = await compressCitizenVideo(video, onCompressProgress);
  const mediaId = await uploadResolutionVideo(
    reportId,
    optimizedVideo,
    latitude,
    longitude,
    accuracyM,
  );
  const { data, error } = await supabase.rpc("agent_resolve_report", {
    p_report_id: reportId,
    p_media_id: mediaId,
    p_resolution_note: note?.trim() || undefined,
  });
  if (error) throw error;
  return data;
}
export async function signupMairie(input: {
  name: string;
  region_id: string;
  commune_id: string;
  email: string;
  password: string;
  phone?: string;
  mayor_name?: string;
  latitude?: number;
  longitude?: number;
  location_label?: string;
}) {
  if (!supabase) throw new Error("Supabase non configuré.");
  const { data, error } = await supabase.functions.invoke("mairie-signup", { body: input });
  if (error) {
    let message = error.message || "Impossible de joindre le service de création de mairie.";
    const context = (error as FunctionInvokeError).context;
    if (context?.json) {
      try {
        const body = await context.json();
        if (typeof body?.error === "string" && body.error.trim()) message = body.error;
      } catch {
        // The error body could not be parsed: keep the generic message.
      }
    }
    if (/already registered|already exists|user.*exist/i.test(message))
      message =
        "Cette adresse email est déjà utilisée par un compte PCS. Utilisez une autre adresse email pour créer le compte mairie.";
    throw new Error(message);
  }
  if (!data?.mairie) throw new Error(data?.error || "Création impossible.");
  return data.mairie;
}
export async function resetFieldAgentPassword(agentId: string, password: string) {
  if (!supabase) throw new Error("Supabase non configuré.");
  if (password.length < 8 || password.length > 128)
    throw new Error("Le mot de passe doit contenir entre 8 et 128 caractères.");
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session) throw new Error("Session requise. Reconnectez-vous puis réessayez.");
  const { data, error } = await supabase.functions.invoke("mairie-reset-agent-password", {
    body: { agent_id: agentId, password },
    headers: { Authorization: "Bearer " + session.access_token },
  });
  if (error) {
    const context = (error as FunctionInvokeError).context;
    let message = error.message || "La réinitialisation du mot de passe a échoué.";
    if (context instanceof Response) {
      try {
        const payload = await context.clone().json();
        if (typeof payload?.error === "string" && payload.error.trim())
          message = payload.error.trim();
      } catch {
        // The error body could not be parsed: keep the generic message.
      }
    }
    throw new Error(message);
  }
  if (!data?.success)
    throw new Error(data?.error || "Le service n’a pas confirmé la réinitialisation.");
}
export async function createFieldAgent(input: {
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
  const { data, error } = await supabase.functions.invoke("mairie-create-agent", {
    body: input,
    headers: { Authorization: "Bearer " + session.access_token },
  });
  if (error) {
    const context = (error as FunctionInvokeError).context;
    let message = error.message || "La création de l’agent a échoué.";
    if (context instanceof Response) {
      try {
        const payload = await context.clone().json();
        if (typeof payload?.error === "string" && payload.error.trim())
          message = payload.error.trim();
        else if (typeof payload?.message === "string" && payload.message.trim())
          message = payload.message.trim();
      } catch {
        try {
          const raw = await context.clone().text();
          if (raw.trim()) message = raw.trim().slice(0, 300);
        } catch {
          // The error body could not be read as text: keep the generic message.
        }
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
export async function lookupAgentByPhone(phone: string) {
  if (!supabase) throw new Error("Supabase non configuré.");
  const { data, error } = await supabase.functions.invoke("agent-login", {
    body: { step: "identify", phone },
  });
  if (error) {
    const context = (error as FunctionInvokeError).context;
    let message = error.message || "Impossible de joindre le service de connexion agent.";
    if (context instanceof Response) {
      try {
        const payload = await context.clone().json();
        if (typeof payload?.error === "string" && payload.error.trim())
          message = payload.error.trim();
        else if (typeof payload?.message === "string" && payload.message.trim())
          message = payload.message.trim();
      } catch {
        message =
          "Le service de connexion a renvoyé une réponse invalide. Vérifiez la configuration Supabase puis réessayez.";
      }
    }
    throw new Error(message);
  }
  if (!data?.identified || !data?.challenge || !data?.agent)
    throw new Error(data?.error || "Ce numéro n'est pas enregistré comme agent terrain.");
  return { agent: data.agent, challenge: data.challenge };
}
export async function loginAgent(challenge: string, password: string) {
  if (!supabase) throw new Error("Supabase non configuré.");
  const { data, error } = await supabase.functions.invoke("agent-login", {
    body: { challenge, password },
  });
  if (error) {
    const context = (error as FunctionInvokeError).context;
    let message = error.message || "Impossible de joindre le service de connexion agent.";
    if (context instanceof Response) {
      try {
        const payload = await context.clone().json();
        if (typeof payload?.error === "string" && payload.error.trim())
          message = payload.error.trim();
        else if (typeof payload?.message === "string" && payload.message.trim())
          message = payload.message.trim();
      } catch {
        message =
          "Le service de connexion a renvoyé une réponse invalide. Vérifiez la configuration Supabase puis réessayez.";
      }
    }
    throw new Error(message);
  }
  if (!data?.session) throw new Error(data?.error || "Identifiants invalides.");
  const { error: sessionError } = await supabase.auth.setSession(data.session);
  if (sessionError) throw sessionError;
  return data.user;
}
export async function updateMairieProfile(input: { mayor_name: string }) {
  if (!supabase) throw new Error("Supabase non configuré.");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Session requise.");
  const { data, error } = await supabase
    .from("mairies")
    .update({ mayor_name: input.mayor_name.trim() })
    .eq("account_user_id", user.id)
    .select("id,name,mayor_name,region_id")
    .single();
  if (error) throw error;
  return data;
}

export async function uploadMairieLogo(file: File) {
  if (!supabase) throw new Error("Supabase non configuré.");
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("Format accepté : JPG, PNG ou WEBP.");
  if (file.size > 2 * 1024 * 1024) throw new Error("Le logo ne doit pas dépasser 2 Mo.");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Session requise.");
  const { data: mairie, error: mairieError } = await supabase
    .from("mairies")
    .select("id,logo_url")
    .eq("account_user_id", user.id)
    .eq("is_active", true)
    .single();
  if (mairieError) throw mairieError;
  const extension = file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : "webp";
  const path = "mairie/" + mairie.id + "/" + crypto.randomUUID() + "." + extension;
  const { error: uploadError } = await supabase.storage
    .from("organization-logos")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) throw uploadError;
  const { data } = supabase.storage.from("organization-logos").getPublicUrl(path);
  const { error: updateError } = await supabase
    .from("mairies")
    .update({ logo_url: data.publicUrl })
    .eq("id", mairie.id)
    .eq("account_user_id", user.id);
  if (updateError) {
    await supabase.storage.from("organization-logos").remove([path]);
    throw updateError;
  }
  if (mairie.logo_url) {
    const oldPath = mairie.logo_url.split("/organization-logos/")[1]?.split("?")[0];
    if (oldPath)
      await supabase.storage.from("organization-logos").remove([decodeURIComponent(oldPath)]);
  }
  return data.publicUrl;
}

// Shapes returned by the read functions above, derived from them so they always match the queries.
export type MairieRecord = NonNullable<Awaited<ReturnType<typeof getMyMairie>>>;
export type MairieReport = Awaited<ReturnType<typeof listMairieReports>>[number];
export type FieldAgentRow = Awaited<ReturnType<typeof listMyAgents>>[number];
export type AgentMission = Awaited<ReturnType<typeof listMyMissions>>[number];
