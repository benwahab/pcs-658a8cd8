import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import { supabase } from "../lib/supabase";
import {
  listCategories,
  submitCitizenReport,
} from "../lib/reports";
import type { Category, Region } from "../types";
import {
  listAllCommunes,
  listRegions,
} from "../services/mairie";
import {
  MAX_VIDEO_SIZE_BYTES,
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
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null,
  );

  const [files, setFiles] = useState<File[]>([]);
  const [video, setVideo] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    Promise.all([listCategories(), listRegions(), listAllCommunes()])
      .then(([categoryList, regionList, communeList]) => {
        setCategories(categoryList);
        setRegions(regionList);
        setAllCommunes(communeList);
      })
      .catch((loadError) => {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Impossible de charger les catégories, régions et localités.",
        );
      });
  }, []);

  useEffect(() => {
    setCommune("");
    setCommunes(
      region
        ? allCommunes.filter((item) => item.region_id === region)
        : [],
    );
  }, [region, allCommunes]);

  function locate() {
    navigator.geolocation?.getCurrentPosition(
      (position) => {
        setCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocation((value) => value || "Position GPS enregistrée");
      },
      () => {
        setError(
          "La position GPS est nécessaire pour envoyer le signalement. Autorisez la localisation puis réessayez.",
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      },
    );
  }

  function addPhotos(list: FileList | null) {
    const next = [...files, ...Array.from(list ?? [])];

    if (next.length > MAX_PHOTOS) {
      setError("Maximum 5 photos par signalement.");
    }

    setFiles(next.slice(0, MAX_PHOTOS));
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

    if (!coords) {
      setError(
        "La position GPS est obligatoire pour vérifier qu’un problème n’a pas déjà été signalé à proximité.",
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
        setError(
          videoError instanceof Error
            ? videoError.message
            : "La vidéo n’est pas valide.",
        );
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
        photos: files,
        video,
      });

      setSubmitted(true);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Erreur lors de l’envoi du signalement.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (submitted) {
    return (
      <section className="narrow authScreen reportScreen">
        <div className="card reportSuccess">
          Votre signalement a bien été envoyé. Merci pour votre contribution
          citoyenne.
        </div>
      </section>
    );
  }

  return (
    <section
      className="narrow authScreen reportScreen"
      data-pcs-tour="report-form"
    >
      <h1>Faire un signalement</h1>
      <p>
        Vous pouvez signaler sans créer de compte. Le signalement est enregistré
        sans identité de citoyen.
      </p>

      <form className="card form" onSubmit={submit}>
        <label>
          Région du problème
          <select
            required
            value={region}
            onChange={(event) => setRegion(event.target.value)}
          >
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

        <button type="button" className="mediaPickBtn" onClick={locate} disabled={saving}>
          Utiliser ma position GPS
        </button>
        {coords && (
          <p className="muted">
            GPS : {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
          </p>
        )}

        <fieldset className="mediaPicker" disabled={saving}>
          <button
            type="button"
            className="mediaPickBtn"
            onClick={() => {
              const accepted = window.confirm(
                "IMPORTANT — RÈGLES DES PHOTOS DE SIGNALEMENT\\n\\n" +
                "Importez uniquement une photo réelle qui montre clairement le problème signalé et qui entre dans le cadre du signalement.\\n\\n" +
                "Toute photo sans preuve réelle, sans rapport avec le problème, trompeuse ou hors sujet sera rejetée et supprimée.\\n\\n" +
                "Voulez-vous choisir une photo depuis votre téléphone ?"
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
              addPhotos(event.target.files);
              event.target.value = "";
              setError("");
            }}
          />

          <button
            type="button"
            className="mediaPickBtn"
            onClick={() => {
              const accepted = window.confirm(
                "IMPORTANT — RÈGLES DES VIDÉOS DE SIGNALEMENT\\n\\n" +
                "Importez uniquement une vidéo réelle qui montre clairement le problème signalé et qui entre dans le cadre du signalement.\\n\\n" +
                "Toute vidéo sans preuve réelle, sans rapport avec le problème, trompeuse ou hors sujet sera rejetée et supprimée.\\n\\n" +
                "Voulez-vous choisir une vidéo depuis votre téléphone ?"
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
              const selected = event.target.files?.[0] ?? null;
              event.target.value = "";
              if (!selected) return;
              if (selected.size <= 0 || selected.size > MAX_VIDEO_SIZE_BYTES) {
                setError("La vidéo ne doit pas dépasser 100 Mo.");
                return;
              }
              setError("");
              setVideo(selected);
            }}
          />

          {(files.length > 0 || video) && (
            <ul className="mediaChosen">
              {files.map((file, index) => (
                <li key={file.name + "-" + index}>
                  📷 {file.name}
                  <button
                    type="button"
                    onClick={() =>
                      setFiles((current) =>
                        current.filter((_, itemIndex) => itemIndex !== index),
                      )
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
    </section>
  );
}
