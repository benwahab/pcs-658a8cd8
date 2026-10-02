import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-pcs-trace-id, traceparent",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
async function hash(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
function cleanEndpoint(value: unknown) {
  const s = String(value ?? "").slice(0, 240);
  try {
    const u = new URL(s, "https://pcs.local");
    return u.pathname.slice(0, 200) || "/";
  } catch {
    return "/";
  }
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée." }, 405);
  const url = Deno.env.get("SUPABASE_URL")!,
    serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for") ?? "unknown";
  const key = await hash("telemetry:" + ip.split(",")[0].trim());
  const { data: allowed } = await admin.rpc("consume_cst_telemetry_rate", {
    p_key_hash: key,
    p_max_events: 120,
    p_window_seconds: 60,
  });
  if (allowed !== true) return json({ error: "Telemetry rate limit reached." }, 429);
  const body = await req.json().catch(() => ({}));
  const events = Array.isArray(body.events) ? body.events.slice(0, 50) : [];
  const frontendEvents = Array.isArray(body.frontend_events)
    ? body.frontend_events.slice(0, 20)
    : [];
  if (!events.length && !frontendEvents.length) return json({ accepted: 0 });
  const auth = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  let userHash: string | null = null;
  if (auth) {
    const {
      data: { user },
    } = await admin.auth.getUser(auth);
    if (user?.id) userHash = await hash("user:" + user.id);
  }
  const rows = events
    .map((e: any) => ({
      trace_id: String(e.trace_id ?? "")
        .replace(/[^a-zA-Z0-9_-]/g, "")
        .slice(0, 80),
      occurred_at: new Date(Number(e.occurred_at) || Date.now()).toISOString(),
      method: String(e.method ?? "GET").slice(0, 12),
      endpoint: cleanEndpoint(e.endpoint),
      status_code: Number.isFinite(Number(e.status_code)) ? Number(e.status_code) : null,
      latency_ms: Number.isFinite(Number(e.latency_ms))
        ? Math.max(0, Math.min(120000, Number(e.latency_ms)))
        : null,
      source: "frontend",
      user_hash: userHash,
      error_class: e.error_class ? String(e.error_class).slice(0, 120) : null,
      metadata: typeof e.metadata === "object" && e.metadata ? e.metadata : {},
    }))
    .filter((e: any) => e.trace_id.length >= 8);
  if (rows.length) await admin.from("cst_request_events").insert(rows);
  const frontRows = frontendEvents.map((e: any) => ({
    occurred_at: new Date(Number(e.occurred_at) || Date.now()).toISOString(),
    event_type: String(e.event_type ?? "unknown").slice(0, 80),
    message: e.message ? String(e.message).slice(0, 1000) : null,
    page: e.page ? String(e.page).slice(0, 240) : null,
    browser: e.browser ? String(e.browser).slice(0, 120) : null,
    device: e.device ? String(e.device).slice(0, 120) : null,
    trace_id: e.trace_id ? String(e.trace_id).slice(0, 80) : null,
    metadata: typeof e.metadata === "object" && e.metadata ? e.metadata : {},
  }));
  if (frontRows.length) await admin.from("cst_frontend_events").insert(frontRows);
  return json({ accepted: rows.length, frontend_accepted: frontRows.length });
});
