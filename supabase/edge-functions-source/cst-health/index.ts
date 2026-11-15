import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-pcs-trace-id, traceparent",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "GET") return json({ error: "Méthode non autorisée." }, 405);
  const auth = req.headers.get("Authorization");
  if (!auth) return json({ error: "Authentification requise." }, 401);
  const url = Deno.env.get("SUPABASE_URL")!,
    serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    token = auth.replace(/^Bearer\s+/i, "");
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const {
    data: { user },
    error: userError,
  } = await admin.auth.getUser(token);
  if (userError || !user) return json({ error: "Session invalide." }, 401);
  const { data: account } = await admin
    .from("cst_accounts")
    .select("id,email")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!account) return json({ error: "Accès CST refusé." }, 403);
  const started = performance.now();
  const { error: dbError } = await admin.from("regions").select("id").limit(1);
  const dbLatency = Math.round(performance.now() - started);
  const { data: databaseMetrics } = await admin.rpc("cst_database_metrics");
  const since = new Date(Date.now() - 60000).toISOString();
  const recentSince = new Date(Date.now() - 900000).toISOString();
  const [
    { data: events },
    { data: frontends },
    { count: recentCount },
    { data: activeUsers },
    { data: endpoints },
  ] = await Promise.all([
    admin
      .from("cst_request_events")
      .select("id,trace_id,occurred_at,method,endpoint,status_code,latency_ms,source,error_class")
      .gte("occurred_at", recentSince)
      .order("occurred_at", { ascending: false })
      .limit(100),
    admin
      .from("cst_frontend_events")
      .select("id,occurred_at,event_type,message,page,browser,device,trace_id")
      .gte("occurred_at", recentSince)
      .order("occurred_at", { ascending: false })
      .limit(100),
    admin
      .from("cst_request_events")
      .select("id", { count: "exact", head: true })
      .gte("occurred_at", since),
    admin
      .from("cst_request_events")
      .select("user_hash")
      .gte("occurred_at", recentSince)
      .not("user_hash", "is", null)
      .limit(1000),
    admin
      .from("cst_request_events")
      .select("method,endpoint,status_code,latency_ms,occurred_at")
      .gte("occurred_at", recentSince)
      .order("occurred_at", { ascending: false })
      .limit(500),
  ]);
  const windowEvents = (events ?? []).filter((e) => new Date(e.occurred_at) >= new Date(since));
  const lat = windowEvents.map((e) => e.latency_ms).filter((v) => Number.isFinite(v));
  const avg = lat.length
    ? Math.round(lat.reduce((a: number, b: number) => a + b, 0) / lat.length)
    : null;
  const uniqueUsers = new Set((activeUsers ?? []).map((x) => x.user_hash).filter(Boolean));
  const errors = windowEvents.filter((e) => Number(e.status_code) >= 500).length;
  const errorRate = windowEvents.length
    ? Number(((errors / windowEvents.length) * 100).toFixed(2))
    : 0;
  const apiMap = new Map<
    string,
    {
      method: string;
      endpoint: string;
      requests: number;
      errors: number;
      totalLatency: number;
      last_activity: string;
    }
  >();
  for (const e of endpoints ?? []) {
    const k = e.method + " " + e.endpoint;
    const x = apiMap.get(k) ?? {
      method: e.method,
      endpoint: e.endpoint,
      requests: 0,
      errors: 0,
      totalLatency: 0,
      last_activity: e.occurred_at,
    };
    x.requests++;
    if (Number(e.status_code) >= 400) x.errors++;
    if (Number.isFinite(e.latency_ms)) x.totalLatency += e.latency_ms;
    if (e.occurred_at > x.last_activity) x.last_activity = e.occurred_at;
    apiMap.set(k, x);
  }
  const apiMonitoring = [...apiMap.values()].slice(0, 30).map((x) => ({
    ...x,
    avg_latency_ms: x.requests ? Math.round(x.totalLatency / x.requests) : null,
    error_rate: x.requests ? Number(((x.errors / x.requests) * 100).toFixed(2)) : 0,
  }));
  return json({
    environment: "PRODUCTION",
    checked_at: new Date().toISOString(),
    database: {
      status: dbError ? "degraded" : "healthy",
      latency_ms: dbLatency,
      ...(databaseMetrics ?? {}),
    },
    metrics: {
      requests_per_minute: recentCount ?? 0,
      average_latency_ms: avg,
      error_rate_percent: errorRate,
      active_users: uniqueUsers.size,
    },
    live_requests: events ?? [],
    frontend_events: frontends ?? [],
    api_monitoring: apiMonitoring,
    connected_sources: {
      database: true,
      authentication: true,
      frontend_telemetry: true,
      request_traces: true,
      backend_metrics: false,
      external_services: false,
      platform_logs: false,
    },
  });
});
