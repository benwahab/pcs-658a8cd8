import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

const reportStatuses = [
  "submitted",
  "received",
  "verification",
  "in_progress",
  "resolved",
  "rejected",
] as const;
const missionStatuses = ["assigned", "accepted", "in_progress", "completed", "declined"] as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "GET") return json({ error: "Méthode non autorisée." }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !serviceKey || !anonKey)
    return json({ error: "Configuration serveur incomplète." }, 500);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Authentification CST requise." }, 401);

  const auth = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: authError,
  } = await auth.auth.getUser();
  if (authError || !user) return json({ error: "Session invalide." }, 401);

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: account, error: accountError } = await admin
    .from("cst_accounts")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (accountError) return json({ error: "Vérification CST indisponible." }, 500);
  if (!account) return json({ error: "Accès réservé au CST." }, 403);

  const [orgResult, unitResult, ...reportResults] = await Promise.all([
    admin
      .from("organizations")
      .select("id,name,code,type,is_active")
      .eq("type", "utility")
      .in("code", ["NIGELEC", "NDE"])
      .order("code"),
    admin
      .from("organization_units")
      .select(
        "id,organization_id,name,code,unit_type,region_id,commune_id,is_active,organizations!inner(code)",
      )
      .in(
        "organization_id",
        (
          await admin
            .from("organizations")
            .select("id")
            .eq("type", "utility")
            .in("code", ["NIGELEC", "NDE"])
        ).data?.map((o) => o.id) ?? [],
      ),
    ...reportStatuses.map((status) =>
      admin.from("reports").select("id", { count: "exact", head: true }).eq("status", status),
    ),
  ]);

  if (orgResult.error || unitResult.error)
    return json({ error: "Impossible de charger la gouvernance des organisations." }, 500);

  const organizations = (orgResult.data ?? []).map((o) => ({
    id: o.id,
    name: o.name,
    code: o.code,
    is_active: o.is_active,
  }));
  const units = (unitResult.data ?? []).map((u) => ({
    id: u.id,
    organization_id: u.organization_id,
    name: u.name,
    code: u.code,
    unit_type: u.unit_type,
    region_id: u.region_id,
    commune_id: u.commune_id,
    is_active: u.is_active,
    organization_code: (u.organizations as unknown as { code?: string } | null)?.code ?? null,
  }));

  const reportCounts = Object.fromEntries(
    reportStatuses.map((status, index) => [status, reportResults[index]?.count ?? 0]),
  );
  const activeUnits = units.filter((u) => u.is_active);
  const organizationSummary = organizations.map((org) => ({
    code: org.code,
    name: org.name,
    is_active: org.is_active,
    central_units: activeUnits.filter(
      (u) => u.organization_code === org.code && u.unit_type === "central",
    ).length,
    local_units: activeUnits.filter(
      (u) => u.organization_code === org.code && u.unit_type === "agency",
    ).length,
  }));

  const organizationIds = organizations.map((o) => o.id);
  const missionQueries = missionStatuses.map((status) =>
    admin
      .from("report_unit_assignments")
      .select("id", { count: "exact", head: true })
      .in("organization_id", organizationIds)
      .eq("status", status),
  );
  const missionResults = await Promise.all(missionQueries);
  const missionCounts = Object.fromEntries(
    missionStatuses.map((status, index) => [status, missionResults[index]?.count ?? 0]),
  );

  const activeMissions =
    (missionCounts.assigned ?? 0) +
    (missionCounts.accepted ?? 0) +
    (missionCounts.in_progress ?? 0);
  const completedMissions = missionCounts.completed ?? 0;

  return json({
    checked_at: new Date().toISOString(),
    organizations: organizationSummary,
    totals: {
      organizations_active: organizations.filter((o) => o.is_active).length,
      units_active: activeUnits.length,
      central_units_active: activeUnits.filter((u) => u.unit_type === "central").length,
      local_units_active: activeUnits.filter((u) => u.unit_type === "agency").length,
    },
    reports: reportCounts,
    missions: { ...missionCounts, active: activeMissions, completed: completedMissions },
  });
});
