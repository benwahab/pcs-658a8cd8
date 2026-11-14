import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
const MAX_VIDEO_SIZE = 100 * 1024 * 1024;
const MAX_PHOTOS = 5;

const ALLOWED_IMAGES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_VIDEOS = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const EXTENSIONS: Record<string, string[]> = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
  "video/mp4": ["mp4", "m4v"],
  "video/webm": ["webm"],
  "video/quicktime": ["mov", "qt"],
};
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-retry-count, x-pcs-trace-id, traceparent, tracestate, baggage",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

const recentByIp = new Map<string, number[]>();
function localRateFallback(key: string) {
  const now = Date.now(),
    windowStart = now - 10 * 60 * 1000;
  // Bound memory and discard expired windows so random IPs cannot grow this map forever.
  for (const [stored, times] of recentByIp) {
    const fresh = times.filter((t) => t > windowStart);
    if (fresh.length) recentByIp.set(stored, fresh);
    else recentByIp.delete(stored);
  }
  const current = (recentByIp.get(key) || []).filter((t) => t > windowStart);
  if (current.length >= 5) return false;
  current.push(now);
  recentByIp.set(key, current);
  return true;
}
async function allowedByRate(
  req: Request,
  admin: ReturnType<typeof createClient>,
  serviceKey: string,
) {
  // Prefer the platform-provided client IP; use the first forwarded IP only as a fallback.
  const ip =
    req.headers.get("cf-connecting-ip")?.trim() ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(ip + "|" + serviceKey),
  );
  const keyHash = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const { data, error } = await admin.rpc("consume_citizen_report_rate_limit", {
    p_key_hash: keyHash,
    p_max_events: 5,
    p_window_seconds: 600,
  });
  if (!error && typeof data === "boolean") return data;
  // Compatibility fallback keeps submissions working before the new SQL migration is applied.
  // It is process-local and therefore not a distributed limit; logs make the missing migration visible.
  console.error(
    "citizen-report-submit shared rate limiter unavailable; using temporary local fallback",
    error?.message || "unexpected RPC result",
  );
  return localRateFallback(keyHash);
}
function extOf(name: string) {
  return name.split(".").pop()?.toLowerCase() || "";
}
function validExt(file: File) {
  return (EXTENSIONS[file.type] ?? []).includes(extOf(file.name));
}

function u32(b: Uint8Array, o: number) {
  return (((b[o] << 24) >>> 0) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
}
function u64(b: Uint8Array, o: number) {
  let n = 0;
  for (let i = 0; i < 8; i++) n = n * 256 + b[o + i];
  return n;
}
function typeAt(b: Uint8Array, o: number) {
  return String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);
}
function findMvhdDuration(b: Uint8Array, start: number, end: number): number | null {
  let p = start;
  while (p + 8 <= end) {
    let size = u32(b, p),
      header = 8;
    if (size === 1) {
      if (p + 16 > end) return null;
      size = u64(b, p + 8);
      header = 16;
    }
    if (size === 0) size = end - p;
    if (size < header || p + size > end) return null;
    const t = typeAt(b, p + 4);
    if (t === "mvhd") {
      const base = p + header;
      if (base + 20 > p + size) return null;
      const version = b[base];
      if (version === 0) {
        const timescale = u32(b, base + 12),
          duration = u32(b, base + 16);
        return timescale > 0 ? duration / timescale : null;
      }
      if (version === 1) {
        if (base + 32 > p + size) return null;
        const timescale = u32(b, base + 20),
          duration = u64(b, base + 24);
        return timescale > 0 ? duration / timescale : null;
      }
      return null;
    }
    if (t === "moov") return findMvhdDuration(b, p + header, p + size);
    p += size;
  }
  return null;
}
function parseMp4Duration(b: Uint8Array) {
  return findMvhdDuration(b, 0, b.length);
}
function ebmlVint(b: Uint8Array, o: number) {
  if (o >= b.length) return null;
  const first = b[o];
  let mask = 0x80,
    len = 1;
  while (len <= 8 && (first & mask) === 0) {
    mask >>= 1;
    len++;
  }
  if (len > 8 || o + len > b.length) return null;
  let value = first & ~mask;
  for (let i = 1; i < len; i++) value = value * 256 + b[o + i];
  return { value, length: len };
}
function ebmlIdLength(first: number) {
  if (first & 0x80) return 1;
  if (first & 0x40) return 2;
  if (first & 0x20) return 3;
  if (first & 0x10) return 4;
  return 0;
}
function ebmlId(b: Uint8Array, o: number, len: number) {
  let id = 0;
  for (let i = 0; i < len; i++) id = id * 256 + b[o + i];
  return id;
}
function ebmlUint(b: Uint8Array, o: number, len: number) {
  let value = 0;
  for (let i = 0; i < len; i++) value = value * 256 + b[o + i];
  return value;
}
function findWebmDuration(b: Uint8Array) {
  let scale = 1000000,
    duration: number | null = null;
  for (let i = 0; i < b.length - 4; i++) {
    if (b[i] === 0x2a && b[i + 1] === 0xd7 && b[i + 2] === 0xb1) {
      const s = ebmlVint(b, i + 3);
      if (s && s.value > 0 && s.value <= 8 && i + 3 + s.length + s.value <= b.length) {
        const v = ebmlUint(b, i + 3 + s.length, s.value);
        if (v > 0) scale = v;
      }
    }
    if (i < b.length - 2 && b[i] === 0x44 && b[i + 1] === 0x89) {
      const s = ebmlVint(b, i + 2);
      if (s && s.value > 0 && s.value <= 8 && i + 2 + s.length + s.value <= b.length) {
        const o = i + 2 + s.length;
        if (s.value === 4)
          duration = new DataView(b.buffer, b.byteOffset + o, 4).getFloat32(0, false);
        else if (s.value === 8)
          duration = new DataView(b.buffer, b.byteOffset + o, 8).getFloat64(0, false);
      }
    }
  }
  if (duration != null && Number.isFinite(duration) && duration > 0)
    return (duration * scale) / 1e9;

  // MediaRecorder may emit a valid WebM without Info/Duration metadata.
  // Recover the real timeline from Cluster timecodes + SimpleBlock timestamps.
  let maxTicks = -Infinity,
    foundBlock = false;
  const CLUSTER = 0x1f43b675,
    SIMPLE_BLOCK = 0xa3,
    TIMECODE = 0xe7;
  for (let i = 0; i + 5 < b.length;) {
    if (b[i] !== 0x1f || b[i + 1] !== 0x43 || b[i + 2] !== 0xb6 || b[i + 3] !== 0x75) {
      i++;
      continue;
    }
    const clusterSize = ebmlVint(b, i + 4);
    if (!clusterSize) break;
    const clusterStart = i + 4 + clusterSize.length;
    const unknownSize = 2 ** (7 * clusterSize.length) - 1;
    const clusterEnd = Math.min(
      b.length,
      clusterStart + (clusterSize.value === unknownSize ? b.length : clusterSize.value),
    );
    if (clusterEnd <= clusterStart) {
      i++;
      continue;
    }
    let clusterTimecode = 0,
      p = clusterStart;
    while (p + 2 <= clusterEnd) {
      const idLen = ebmlIdLength(b[p]);
      if (!idLen || p + idLen >= clusterEnd) break;
      const id = ebmlId(b, p, idLen),
        size = ebmlVint(b, p + idLen);
      if (!size) break;
      const dataStart = p + idLen + size.length;
      const unknown = 2 ** (7 * size.length) - 1;
      const dataEnd = Math.min(
        clusterEnd,
        dataStart + (size.value === unknown ? clusterEnd - dataStart : size.value),
      );
      if (dataEnd < dataStart) break;
      if (id === TIMECODE) {
        if (size.value > 0 && size.value <= 8) clusterTimecode = ebmlUint(b, dataStart, size.value);
      } else if (id === SIMPLE_BLOCK) {
        const track = ebmlVint(b, dataStart);
        const tcOffset = dataStart + (track?.length ?? 0);
        if (track && tcOffset + 3 <= dataEnd) {
          const raw = (b[tcOffset] << 8) | b[tcOffset + 1];
          const relative = raw & 0x8000 ? raw - 0x10000 : raw;
          const timestamp = clusterTimecode + relative;
          if (Number.isFinite(timestamp)) {
            maxTicks = Math.max(maxTicks, timestamp);
            foundBlock = true;
          }
        }
      }
      p = dataEnd;
    }
    i = clusterEnd;
  }
  if (foundBlock && Number.isFinite(maxTicks) && maxTicks >= 0) return (maxTicks * scale) / 1e9;
  return null;
}
async function validateVideo(file: File) {
  if (!ALLOWED_VIDEOS.has(file.type)) throw new Error("Type vidéo non autorisé.");
  if (file.size <= 0 || file.size > MAX_VIDEO_SIZE)
    throw new Error("La vidéo ne doit pas dépasser 100 Mo.");
  if (!validExt(file)) throw new Error("L’extension de la vidéo ne correspond pas à son type.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  let container: "mp4" | "webm" | null = null;
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x1a &&
    bytes[1] === 0x45 &&
    bytes[2] === 0xdf &&
    bytes[3] === 0xa3
  )
    container = "webm";
  else if (
    bytes.length >= 12 &&
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70
  )
    container = "mp4";
  if (!container) throw new Error("Format vidéo réel non reconnu.");
  if (
    (file.type === "video/webm" && container !== "webm") ||
    (file.type !== "video/webm" && container !== "mp4")
  )
    throw new Error("Le contenu réel ne correspond pas au type déclaré.");
  // La durée n'est pas limitée : on valide le conteneur et le poids, pas la durée.
  return container;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée." }, 405);
  const url = Deno.env.get("SUPABASE_URL")!,
    serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  if (!(await allowedByRate(req, admin, serviceKey)))
    return json(
      { error: "Trop de signalements depuis cette connexion. Réessayez plus tard." },
      429,
    );
  try {
    const form = await req.formData();
    const categoryId = String(form.get("category_id") ?? "").trim(),
      regionId = String(form.get("region_id") ?? "").trim(),
      communeId = String(form.get("commune_id") ?? "").trim();
    const title = String(form.get("title") ?? "").trim();
    const locationLabel = String(form.get("location_label") ?? "").trim() || null;
    const latitude = Number(form.get("latitude")),
      longitude = Number(form.get("longitude"));
    const gpsAccuracyM = Number(form.get("gps_accuracy_m"));
    if (
      !categoryId ||
      !regionId ||
      !communeId ||
      title.length < 5 ||
      title.length > 120 ||
      (locationLabel !== null && locationLabel.length > 250) ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180 ||
      !Number.isFinite(gpsAccuracyM) ||
      gpsAccuracyM <= 0 ||
      gpsAccuracyM > 100
    )
      return json(
        {
          error:
            "Position GPS invalide ou trop imprécise. Reprenez votre position à proximité du problème (précision maximale : 100 mètres).",
        },
        400,
      );
    const { data: category } = await admin
      .from("categories")
      .select("id")
      .eq("id", categoryId)
      .eq("is_active", true)
      .maybeSingle();
    if (!category) return json({ error: "Catégorie invalide." }, 400);
    const { data: commune } = await admin
      .from("communes")
      .select("id,region_id,is_active")
      .eq("id", communeId)
      .eq("region_id", regionId)
      .eq("is_active", true)
      .maybeSingle();
    if (!commune) return json({ error: "Localité invalide pour cette région." }, 400);
    const { data: gpsMatches, error: gpsMatchError } = await admin.rpc(
      "match_citizen_gps_commune",
      { p_latitude: latitude, p_longitude: longitude },
    );
    if (gpsMatchError) {
      console.error("citizen-report-submit GPS territory check", gpsMatchError);
      return json({ error: "Impossible de vérifier la localité avec le GPS. Réessayez." }, 503);
    }
    const matches = Array.isArray(gpsMatches) ? gpsMatches : [];
    if (matches.length !== 1)
      return json(
        {
          error:
            matches.length > 1
              ? "La position GPS est trop proche d’une limite entre plusieurs localités. Reprenez votre position un peu plus à l’intérieur de la localité."
              : "La position GPS ne correspond à aucune localité reconnue. Vérifiez votre position et réessayez.",
        },
        400,
      );
    const gpsCommune = matches[0] as {
      commune_id: string;
      commune_name: string;
      region_id: string;
      region_name: string;
    };
    if (gpsCommune.commune_id !== communeId || gpsCommune.region_id !== regionId) {
      return json(
        {
          error:
            "Votre GPS vous situe à " +
            gpsCommune.commune_name +
            " (région de " +
            gpsCommune.region_name +
            "), et non dans la localité choisie. Corrigez votre choix ou reprenez le GPS à proximité du problème.",
        },
        400,
      );
    }
    const photoFiles = form.getAll("photos").filter((v): v is File => v instanceof File);
    const videoValue = form.get("video");
    const videoFile = videoValue instanceof File ? videoValue : null;
    if (photoFiles.length > MAX_PHOTOS)
      return json({ error: "Maximum 5 photos par signalement." }, 400);
    for (const file of photoFiles) {
      if (
        !ALLOWED_IMAGES.has(file.type) ||
        file.size <= 0 ||
        file.size > MAX_IMAGE_SIZE ||
        !validExt(file)
      )
        return json({ error: "Une photo est invalide ou dépasse 8 Mo." }, 400);
    }
    if (videoFile) await validateVideo(videoFile);
    const referenceCode =
      "PCS-" +
      new Date().toISOString().slice(0, 10).replace(/-/g, "") +
      "-" +
      crypto.randomUUID().slice(0, 8).toUpperCase();
    const { data: report, error: reportError } = await admin
      .from("reports")
      .insert({
        reference_code: referenceCode,
        category_id: categoryId,
        title,
        location_label: locationLabel,
        latitude,
        longitude,
        region_id: regionId,
        commune_id: communeId,
        status: "submitted",
        is_public: false,
      })
      .select("id,reference_code")
      .single();
    if (reportError) {
      if (
        reportError.code === "23505" &&
        /20 mètres|déjà été signalé/i.test(reportError.message || "")
      )
        return json({ error: "Ce problème a déjà été signalé à proximité." }, 409);
      console.error("citizen-report-submit report insert", reportError);
      return json({ error: "Impossible d’enregistrer le signalement." }, 500);
    }
    const uploaded: string[] = [];
    try {
      for (const file of photoFiles) {
        const path = report.id + "/" + crypto.randomUUID() + "." + extOf(file.name);
        const { error } = await admin.storage
          .from("report-media")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (error) throw new Error("Échec du stockage d’une photo.");
        uploaded.push(path);
        const { error: rowError } = await admin.from("report_media").insert({
          report_id: report.id,
          storage_path: path,
          media_type: file.type,
          file_size: file.size,
          uploaded_by: null,
          media_role: "citizen_evidence",
          moderation_status: "pending",
        });
        if (rowError) throw new Error("Impossible d’enregistrer une photo du signalement.");
      }
      if (videoFile) {
        const path = report.id + "/" + crypto.randomUUID() + "." + extOf(videoFile.name);
        const { error } = await admin.storage
          .from("report-media")
          .upload(path, videoFile, { contentType: videoFile.type, upsert: false });
        if (error) throw new Error("Échec du stockage sécurisé de la vidéo.");
        uploaded.push(path);
        const { error: rowError } = await admin.from("report_media").insert({
          report_id: report.id,
          storage_path: path,
          media_type: videoFile.type,
          file_size: videoFile.size,
          uploaded_by: null,
          media_role: "citizen_evidence",
          moderation_status: "pending",
        });
        if (rowError) throw new Error("Impossible d’enregistrer la vidéo du signalement.");
      }
    } catch (error) {
      if (uploaded.length) await admin.storage.from("report-media").remove(uploaded);
      await admin.from("reports").delete().eq("id", report.id);
      console.error("citizen-report-submit media", error);
      return json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Impossible d’enregistrer les médias du signalement.",
        },
        500,
      );
    }
    return json({ success: true, reference_code: report.reference_code });
  } catch (error) {
    console.error("citizen-report-submit", error);
    return json(
      {
        error:
          error instanceof Error ? error.message : "Erreur interne lors de l’envoi du signalement.",
      },
      500,
    );
  }
});
