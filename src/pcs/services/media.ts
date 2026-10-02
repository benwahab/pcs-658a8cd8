import { supabase } from "../lib/supabase";

export const MAX_VIDEO_SIZE_BYTES = 50 * 1024 * 1024;

const ALLOWED_IMAGES = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_VIDEOS = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
] as const;

const VIDEO_EXTENSIONS: Record<string, string[]> = {
  "video/mp4": ["mp4", "m4v"],
  "video/webm": ["webm"],
  "video/quicktime": ["mov", "qt"],
};

export const CITIZEN_VIDEO_MAX_SECONDS = 10;

export function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);

    video.preload = "metadata";

    const cleanup = () => URL.revokeObjectURL(url);

    video.onloadedmetadata = () => {
      cleanup();
      resolve(video.duration);
    };

    video.onerror = () => {
      cleanup();
      reject(new Error("Vidéo illisible ou format non pris en charge."));
    };

    video.src = url;
  });
}

async function detectVideoContainer(
  file: File,
): Promise<"mp4" | "webm" | null> {
  const bytes = new Uint8Array(await file.slice(0, 32).arrayBuffer());

  if (
    bytes.length >= 4 &&
    bytes[0] === 0x1a &&
    bytes[1] === 0x45 &&
    bytes[2] === 0xdf &&
    bytes[3] === 0xa3
  ) {
    return "webm";
  }

  if (
    bytes.length >= 12 &&
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70
  ) {
    return "mp4";
  }

  return null;
}

export async function validateCitizenVideo(file: File) {
  if (!ALLOWED_VIDEOS.includes(file.type as (typeof ALLOWED_VIDEOS)[number])) {
    throw new Error("Type vidéo non autorisé. Utilisez MP4, WebM ou MOV.");
  }

  if (file.size <= 0 || file.size > MAX_VIDEO_SIZE_BYTES) {
    throw new Error("Vidéo trop volumineuse. Maximum : 50 Mo.");
  }

  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const allowedExtensions = VIDEO_EXTENSIONS[file.type] ?? [];

  if (!allowedExtensions.includes(extension)) {
    throw new Error(
      "L’extension de la vidéo ne correspond pas à son type MIME.",
    );
  }

  const container = await detectVideoContainer(file);

  if (!container) {
    throw new Error(
      "Le fichier vidéo n’est pas reconnu comme un conteneur MP4/WebM valide.",
    );
  }

  if (
    (file.type === "video/webm" && container !== "webm") ||
    (file.type !== "video/webm" && container !== "mp4")
  ) {
    throw new Error(
      "Le contenu réel de la vidéo ne correspond pas à son type déclaré.",
    );
  }

  const duration = await getVideoDuration(file);

  // Certains navigateurs mobiles renvoient Infinity pour la durée des WebM
  // MediaRecorder sans métadonnées de durée. Ne pas bloquer ici : l'Edge
  // Function analyse le conteneur réel et applique la limite stricte côté serveur.
  if (Number.isFinite(duration) && duration > 0) {
    if (duration > CITIZEN_VIDEO_MAX_SECONDS + 0.25) {
      throw new Error(
        "La vidéo doit durer " +
          CITIZEN_VIDEO_MAX_SECONDS +
          " secondes maximum (celle-ci dure " +
          Math.ceil(duration) +
          " s).",
      );
    }
    return { duration, container };
  }

  return { duration: null, container };
}

export async function createReportMediaUrl(
  path: string,
  expiresIn = 3600,
): Promise<string> {
  if (!supabase) {
    throw new Error("Supabase n’est pas configuré.");
  }

  const { data, error } = await supabase.storage
    .from("report-media")
    .createSignedUrl(path, expiresIn);

  if (error) throw error;
  return data.signedUrl;
}

export async function uploadResolutionVideo(
  reportId: string,
  file: File,
  latitude: number,
  longitude: number,
  accuracyM?: number,
): Promise<string> {
  if (!supabase) {
    throw new Error("Supabase n’est pas configuré.");
  }

  if (!ALLOWED_VIDEOS.includes(file.type as (typeof ALLOWED_VIDEOS)[number])) {
    throw new Error("Vidéo MP4, WebM ou MOV requise.");
  }

  if (file.size > MAX_VIDEO_SIZE_BYTES) {
    throw new Error("Vidéo trop volumineuse. Maximum : 50 Mo.");
  }

  if (accuracyM != null && accuracyM > 20) {
    throw new Error("La précision GPS doit être de 20 mètres ou moins.");
  }

  const extension = file.name.split(".").pop()?.toLowerCase() || "mp4";
  const path =
    reportId + "/resolution-" + crypto.randomUUID() + "." + extension;

  const { error } = await supabase.storage
    .from("report-media")
    .upload(path, file, {
      contentType: file.type,
      upsert: false,
    });

  if (error) throw error;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: row, error: rowError } = await supabase
    .from("report_media")
    .insert({
      report_id: reportId,
      storage_path: path,
      media_type: file.type,
      file_size: file.size,
      uploaded_by: user?.id ?? null,
      media_role: "resolution_video",
      moderation_status: "approved",
      captured_latitude: latitude,
      captured_longitude: longitude,
    } as any)
    .select("id")
    .single();

  if (rowError) {
    await supabase.storage.from("report-media").remove([path]);
    throw rowError;
  }

  return row.id as string;
}
