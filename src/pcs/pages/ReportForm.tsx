import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import { supabase } from "../lib/supabase";
import { LoginBrand } from "../components/LoginBrand";
import { listCategories, submitCitizenReport } from "../lib/reports";
import type { Category, Region } from "../types";
import { listAllCommunes, listRegions } from "../services/mairie";
import {
  MAX_VIDEO_SIZE_BYTES,
  compressCitizenPhoto,
  compressCitizenVideo,
  validateCitizenVideo,
} from "../services/media";

interface Commune {
  id: string;
  name: string;
  region_id: string;
}

const MAX_PHOTOS = 5;
const MAX_TITLE_LENGTH = 120;
const MAX_LOCATION_LENGTH = 250;
const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024;

async function snapshotSelectedFile(file: File): Promise<File> {
  // Copier immédiatement le contenu, avant que le sélecteur Android ne perde son accès temporaire.
  const bytes = await file.arrayBuffer();
  if (bytes.byteLength === 0)
    throw new Error("Le fichier sélectionné est vide ou inaccessible. Sélectionnez-le à nouveau.");
  return new File([bytes], file.name, {
    type: file.type || "application/octet-stream",
    lastModified: file.lastModified,
  });
}

export default function ReportForm() {
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [communes, setCommunes] = useState<Commune[]>([]);
  const [allCommunes, setAllCommunes] = useState<Commune[]>([]);

  const [region, setRegion] = useState("");
  const [commune, setCommune] = useState("");
  const [category, setCategory] = useState("");
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [gpsCommune, setGpsCommune] = useState<{
    id: string;
    name: string;
    region_id: string;
    region_name: string;
  } | null>(null);

  const [files, setFiles] = useState<File[]>([]);
  const [video, setVideo] = useState<File | null>(null);
  const [videoProgress, setVideoProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [gpsNoticeOpen, setGpsNoticeOpen] = useState(false);
  const returnTargetRef = useRef<{ type: "home" | "report"; reportId?: string } | null>(null);

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem("pcs-report-return-v1");
      const parsed = raw ? (JSON.parse(raw) as { type?: string; reportId?: string }) : null;
      returnTargetRef.current =
        parsed?.type === "report" && parsed.reportId
          ? { type: "report", reportId: parsed.reportId }
          : { type: "home" };
    } catch {
      returnTargetRef.current = { type: "home" };
    }
  }, []);

  useEffect(() => {
    let active = true;

    // Charger chaque liste indépendamment : l'échec d'une requête ne doit
    // pas empêcher l'affichage des régions ou des localités déjà récupérées.
    void Promise.allSettled([listCategories(), listRegions(), listAllCommunes()]).then(
      ([categoryResult, regionResult, communeResult]) => {
        if (!active) return;

        const failedLists: string[] = [];

        if (categoryResult.status === "fulfilled") {
          setCategories(categoryResult.value);
        } else {
          failedLists.push("catégories");
        }

        if (regionResult.status === "fulfilled") {
          setRegions(regionResult.value);
        } else {
          failedLists.push("régions");
        }

        if (communeResult.status === "fulfilled") {
          setAllCommunes(communeResult.value);
        } else {
          failedLists.push("localités");
        }

        if (failedLists.length) {
          setError(
            `Impossible de charger les ${failedLists.join(", ")}. Vérifiez votre connexion puis réessayez.`,
          );
        }
      },
    );

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const regionCommunes = region ? allCommunes.filter((item) => item.region_id === region) : [];
    setCommunes(regionCommunes);
    setCommune(gpsCommune && gpsCommune.region_id === region ? gpsCommune.id : "");
  }, [region, allCommunes, gpsCommune]);

  function locate() {
    if (!navigator.geolocation) {
      setError("La géolocalisation n’est pas disponible sur cet appareil.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const accuracy = position.coords.accuracy;
        if (!Number.isFinite(accuracy) || accuracy > 100) {
          setCoords(null);
          setGpsCommune(null);
          setError(
            "La précision GPS est insuffisante (plus de 100 mètres). Placez-vous près du problème et réessayez.",
          );
          return;
        }
        if (!supabase) {
          setError("Supabase n’est pas configuré.");
          return;
        }

        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        const { data, error: gpsError } = await supabase.rpc("match_citizen_gps_commune", {
          p_latitude: latitude,
          p_longitude: longitude,
        });
        if (gpsError) {
          setCoords(null);
          setGpsCommune(null);
          setError("Impossible de vérifier la localité avec le GPS. Réessayez dans un instant.");
          return;
        }

        const matches = Array.isArray(data) ? data : [];
        if (matches.length !== 1) {
          setCoords(null);
          setGpsCommune(null);
          setError(
            matches.length > 1
              ? "Votre position est trop proche d’une limite entre plusieurs localités. Déplacez-vous légèrement à l’intérieur de la localité et réessayez."
              : "Votre position GPS ne se trouve dans aucune localité reconnue. Vérifiez votre GPS et réessayez.",
          );
          return;
        }

        const match = matches[0] as {
          commune_id: string;
          commune_name: string;
          region_id: string;
          region_name: string;
        };
        setCoords({ lat: latitude, lng: longitude, accuracy });
        setGpsCommune({
          id: match.commune_id,
          name: match.commune_name,
          region_id: match.region_id,
          region_name: match.region_name,
        });
        setRegion(match.region_id);
        setLocation((value) => value || "Position GPS vérifiée");
        setGpsNoticeOpen(false);
        setError("");
      },
      () => {
        setCoords(null);
        setGpsCommune(null);
        setError(
          "La position GPS est nécessaire pour envoyer le signalement. Autorisez la localisation puis réessayez.",
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  async function addPhotos(list: FileList | null) {
    const selected = Array.from(list ?? []);
    if (!selected.length) return;
    try {
      const available = Math.max(0, MAX_PHOTOS - files.length);
      const exceededLimit = selected.length > available;
      const snapshots: File[] = [];
      for (const file of selected.slice(0, available)) {
        if (!file.type.startsWith("image/"))
          throw new Error("Un fichier sélectionné n’est pas une image valide.");
        if (file.size <= 0 || file.size > MAX_IMAGE_SIZE_BYTES)
          throw new Error("Chaque photo doit être lisible et ne pas dépasser 8 Mo.");
        snapshots.push(await compressCitizenPhoto(await snapshotSelectedFile(file)));
      }
      setFiles((current) => [...current, ...snapshots].slice(0, MAX_PHOTOS));
      if (exceededLimit) setError("Vous pouvez joindre au maximum 5 photos par signalement.");
      else if (snapshots.length) setError("");
    } catch (photoError) {
      setError(
        photoError instanceof Error
          ? photoError.message
          : "Impossible de lire la photo. Sélectionnez-la à nouveau.",
      );
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");

    if (!supabase) {
      setError("Supabase n’est pas configuré.");
      return;
    }

    if (!category) {
      setError("Choisissez une catégorie.");
      return;
    }

    if (!region) {
      setError("Choisissez la région du problème.");
      return;
    }

    if (!commune) {
      setError("Choisissez la localité du problème.");
      return;
    }

    if (title.trim().length < 5) {
      setError("Le titre doit contenir au moins 5 caractères.");
      return;
    }

    if (!coords || !gpsCommune) {
      setError("Prenez une position GPS précise pour vérifier la localité du problème.");
      return;
    }

    if (gpsCommune.id !== commune || gpsCommune.region_id !== region) {
      setError(
        "Votre GPS vous situe à " +
          gpsCommune.name +
          " (" +
          gpsCommune.region_name +
          "), et non dans la localité choisie. Corrigez votre choix ou reprenez la position GPS à proximité du problème.",
      );
      return;
    }

    if (files.length === 0 && !video) {
      setError("Ajoutez au moins une photo ou une vidéo au signalement.");
      return;
    }

    if (files.length > MAX_PHOTOS) {
      setError("Maximum 5 photos par signalement.");
      return;
    }

    if (video) {
      if (video.size > MAX_VIDEO_SIZE_BYTES) {
        setError("La vidéo ne doit pas dépasser 100 Mo.");
        return;
      }

      try {
        await validateCitizenVideo(video);
      } catch (videoError) {
        setError(videoError instanceof Error ? videoError.message : "La vidéo n’est pas valide.");
        return;
      }
    }

    setSaving(true);

    try {
      await submitCitizenReport({
        category_id: category,
        region_id: region,
        commune_id: commune,
        title: title.trim(),
        location_label: location.trim() || null,
        latitude: coords.lat,
        longitude: coords.lng,
        gps_accuracy_m: coords.accuracy,
        photos: files,
        video,
      });

      setSubmitted(true);
      window.setTimeout(() => {
        const target = returnTargetRef.current ?? { type: "home" as const };
        try {
          window.sessionStorage.removeItem("pcs-report-return-v1");
        } catch {
          // Storage can be unavailable: there is nothing to clean up.
        }
        const query =
          target.type === "report" && target.reportId
            ? `?pcsReturnReport=${encodeURIComponent(target.reportId)}`
            : "";
        window.history.replaceState(null, "", `/${query}`);
        window.dispatchEvent(new PopStateEvent("popstate"));
      }, 3000);
    } catch (submitError) {
      setError(
        submitError instanceof Error &&
          /^(La vidéo|Le fichier|Type vidéo|L’extension|Le contenu|La précision GPS|Coordonnées GPS|Supabase)/i.test(
            submitError.message,
          )
          ? submitError.message
          : "Impossible d’envoyer le signalement. Vérifiez votre connexion et la lisibilité des médias, puis réessayez.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (submitted) {
    return (
      <section className="narrow authScreen reportScreen pcsLoginPage reportFormPage">
        <div className="authScreen pcsLogin reportFormGlass">
          <LoginBrand />
          <div className="card reportSuccess">
            Votre signalement a bien été envoyé. Merci pour votre contribution citoyenne.
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className="narrow authScreen reportScreen pcsLoginPage reportFormPage"
      data-pcs-tour="report-form"
    >
      <div className="authScreen pcsLogin reportFormGlass">
        <LoginBrand />
        <h1>Faire un signalement</h1>
        <p className="reportIntro">Vous pouvez signaler sans créer de compte.</p>

        <form className="card form" onSubmit={submit}>
          <label>
            Région du problème
            <select required value={region} onChange={(event) => setRegion(event.target.value)}>
              <option value="">Choisir…</option>
              {regions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Localité du problème
            <select
              required
              disabled={!region}
              value={commune}
              onChange={(event) => setCommune(event.target.value)}
            >
              <option value="">
                {!region
                  ? "Choisir d’abord une région…"
                  : !communes.length
                    ? "Aucune localité disponible"
                    : "Choisir une localité…"}
              </option>
              {communes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Catégorie
            <select
              data-pcs-tour="category"
              required
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              <option value="">Choisir…</option>
              {categories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Titre
            <input
              required
              minLength={5}
              maxLength={MAX_TITLE_LENGTH}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ex. Caniveau bouché"
            />
          </label>

          <label>
            Zone / adresse
            <input
              maxLength={MAX_LOCATION_LENGTH}
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Quartier, rue, repère…"
            />
          </label>

          <button
            type="button"
            className="mediaPickBtn"
            onClick={() => setGpsNoticeOpen(true)}
            disabled={saving}
          >
            Utiliser ma position GPS
          </button>
          {gpsNoticeOpen && (
            <div
              className="gpsNoticeBackdrop"
              role="presentation"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) setGpsNoticeOpen(false);
              }}
            >
              <div
                className="gpsNotice"
                role="dialog"
                aria-modal="true"
                aria-labelledby="gps-notice-title"
                aria-describedby="gps-notice-description"
              >
                <div className="gpsNoticeIcon" aria-hidden="true">
                  📍
                </div>
                <h2 id="gps-notice-title">Position GPS</h2>
                <p id="gps-notice-description">
                  Pour permettre aux agents terrain de retrouver exactement le problème signalé,
                  vous devez prendre la position GPS à proximité immédiate du problème.
                </p>
                <p>
                  Si vous êtes éloigné, la position enregistrée peut être différente du lieu réel et
                  induire les agents terrain en erreur.
                </p>
                <div className="gpsNoticeActions">
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => setGpsNoticeOpen(false)}
                  >
                    Annuler
                  </button>
                  <button type="button" className="button primary" onClick={locate}>
                    J’ai compris, continuer
                  </button>
                </div>
              </div>
            </div>
          )}
          {coords && gpsCommune && (
            <p className="muted">
              Position vérifiée : {gpsCommune.name}, région de {gpsCommune.region_name}
              {" · "}précision {Math.round(coords.accuracy)} m
            </p>
          )}

          <fieldset className="mediaPicker" disabled={saving}>
            <button
              type="button"
              className="mediaPickBtn"
              onClick={() => {
                const accepted = window.confirm(
                  "IMPORTANT — RÈGLES DES PHOTOS DE SIGNALEMENT\n\n" +
                    "Importez uniquement une photo réelle qui montre clairement le problème signalé et qui entre dans le cadre du signalement.\n\n" +
                    "Toute photo sans preuve réelle, sans rapport avec le problème, trompeuse ou hors sujet sera rejetée et supprimée.\n\n" +
                    "Voulez-vous choisir une photo depuis votre téléphone ?",
                );
                if (accepted) photoInputRef.current?.click();
              }}
            >
              Importer une photo
            </button>
            <input
              ref={photoInputRef}
              hidden
              type="file"
              accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
              multiple
              onChange={(event) => {
                const input = event.currentTarget;
                void addPhotos(input.files);
                input.value = "";
              }}
            />

            <button
              type="button"
              className="mediaPickBtn"
              onClick={() => {
                const accepted = window.confirm(
                  "IMPORTANT — RÈGLES DES VIDÉOS DE SIGNALEMENT\n\n" +
                    "Importez uniquement une vidéo réelle qui montre clairement le problème signalé et qui entre dans le cadre du signalement.\n\n" +
                    "Toute vidéo sans preuve réelle, sans rapport avec le problème, trompeuse ou hors sujet sera rejetée et supprimée.\n\n" +
                    "Voulez-vous choisir une vidéo depuis votre téléphone ?",
                );
                if (accepted) videoInputRef.current?.click();
              }}
            >
              Importer une vidéo
            </button>
            <input
              ref={videoInputRef}
              hidden
              type="file"
              accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.m4v"
              onChange={(event) => {
                const input = event.currentTarget;
                const selected = input.files?.[0] ?? null;
                if (!selected) return;
                void (async () => {
                  try {
                    if (selected.size <= 0 || selected.size > MAX_VIDEO_SIZE_BYTES)
                      throw new Error("La vidéo doit être lisible et ne pas dépasser 100 Mo.");
                    if (!selected.type.startsWith("video/"))
                      throw new Error("Le fichier sélectionné n’est pas une vidéo valide.");
                    const snapshot = await snapshotSelectedFile(selected);
                    setVideoProgress(0);
                    const optimized = await compressCitizenVideo(snapshot, (ratio) =>
                      setVideoProgress(ratio),
                    );
                    setVideo(optimized);
                    setError("");
                  } catch (videoError) {
                    setError(
                      videoError instanceof Error
                        ? videoError.message
                        : "Impossible de lire la vidéo. Sélectionnez-la à nouveau.",
                    );
                  } finally {
                    setVideoProgress(null);
                    input.value = "";
                  }
                })();
              }}
            />

            {videoProgress !== null && (
              <p className="videoOptimizing" role="status">
                Optimisation de la vidéo… {Math.round(videoProgress * 100)} %
              </p>
            )}

            {(files.length > 0 || video) && (
              <ul className="mediaChosen">
                {files.map((file, index) => (
                  <li key={file.name + "-" + index}>
                    📷 {file.name}
                    <button
                      type="button"
                      onClick={() =>
                        setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))
                      }
                    >
                      ×
                    </button>
                  </li>
                ))}
                {video && (
                  <li>
                    🎥 {video.name}
                    <button type="button" onClick={() => setVideo(null)}>
                      ×
                    </button>
                  </li>
                )}
              </ul>
            )}
          </fieldset>

          {error && <p className="error">{error}</p>}

          <button
            data-pcs-tour="submit-report"
            disabled={saving}
            className="button primary"
            type="submit"
          >
            {saving ? "Envoi en cours…" : "Envoyer le signalement"}
          </button>
        </form>
      </div>
    </section>
  );
}
