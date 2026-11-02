import { supabase } from "../lib/supabase";

export const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024;

/**
 * Compress citizen evidence locally so Free-tier Storage serves smaller files.
 * Keep the original when the browser cannot decode/encode safely or the result
 * would be larger. This never changes video files or moderation status.
 */
export async function compressCitizenPhoto(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || typeof createImageBitmap !== "function") {
    return file;
  }

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
    const maxDimension = 1600;
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.type === "image/webp" && file.size <= 700 * 1024) {
      return file;
    }

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/webp", 0.78);
    });
    if (!blob || blob.size === 0 || blob.size >= file.size) return file;

    const baseName = file.name.replace(/\.[^.]+$/, "") || "photo";
    return new File([blob], `${baseName}.webp`, {
      type: "image/webp",
      lastModified: file.lastModified,
    });
  } catch {
    // Compression is an optimization, never a reason to block a valid report.
    return file;
  } finally {
    bitmap?.close();
  }
}

// Limite applicative volontaire : 100 Mo par vidéo.
export const MAX_VIDEO_SIZE_BYTES = 100 * 1024 * 1024;

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

  if (file.size <= 0) {
    throw new Error("La vidéo est vide.");
  }
  if (file.size > MAX_VIDEO_SIZE_BYTES) {
    throw new Error("La vidéo ne doit pas dépasser 100 Mo.");
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

  return { container };
}

export async function createReportMediaUrls(
  paths: string[],
  expiresIn = 3600,
): Promise<Record<string, string>> {
  if (!supabase) throw new Error("Supabase n’est pas configuré.");
  const uniquePaths = [...new Set(paths.filter(Boolean))];
  if (!uniquePaths.length) return {};

  // One server round-trip for all approved media in a report; the private
  // bucket and server-side moderation/publication checks remain unchanged.
  const { data, error } = await supabase.functions.invoke("public-report-media-url", {
    body: { paths: uniquePaths, expiresIn },
  });
  if (error) throw error;
  if (!data?.signedUrls || typeof data.signedUrls !== "object") {
    throw new Error("Le serveur n’a pas fourni les URL des médias.");
  }
  return data.signedUrls as Record<string, string>;
}

export async function createReportMediaUrl(
  path: string,
  expiresIn = 3600,
): Promise<string> {
  const urls = await createReportMediaUrls([path], expiresIn);
  const url = urls[path];
  if (!url) throw new Error("Média introuvable, non approuvé ou non public.");
  return url;
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

  if (file.size <= 0) {
    throw new Error("La vidéo est vide.");
  }
  if (file.size > MAX_VIDEO_SIZE_BYTES) {
    throw new Error("La vidéo ne doit pas dépasser 100 Mo.");
  }

  if (accuracyM == null || !Number.isFinite(accuracyM) || accuracyM < 0 || accuracyM > 20) {
    throw new Error("La précision GPS doit être de 20 mètres ou moins.");
  }

  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new Error("Coordonnées GPS invalides.");
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
      moderation_status: "pending",
      captured_latitude: latitude,
      captured_longitude: longitude,
      accuracy_m: accuracyM,
    } as any)
    .select("id")
    .single();

  if (rowError) {
    await supabase.storage.from("report-media").remove([path]);
    throw rowError;
  }

  return row.id as string;
}
