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
const MAX_DESCRIPTION_LENGTH = 5000;
const MAX_LOCATION_LENGTH = 250;
const CAPTURE_VIDEO_MAX_SECONDS = 8;
const CAPTURE_VIDEO_STOP_MS = 8500;

export default function ReportForm() {
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const cameraPreviewRef = useRef<HTMLVideoElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const stoppingRef = useRef(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [communes, setCommunes] = useState<Commune[]>([]);
  const [allCommunes, setAllCommunes] = useState<Commune[]>([]);

  const [region, setRegion] = useState("");
  const [commune, setCommune] = useState("");
  const [category, setCategory] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null,
  );

  const [files, setFiles] = useState<File[]>([]);
  const [video, setVideo] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [recording, setRecording] = useState(false);
  const [finalizingVideo, setFinalizingVideo] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

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

  function clearTimers() {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  function detachPreview() {
    const videoElement = cameraPreviewRef.current;
    if (!videoElement) return;

    videoElement.pause();
    videoElement.srcObject = null;
  }

  function stopCameraTracks() {
    const stream = streamRef.current;
    streamRef.current = null;
    stream?.getTracks().forEach((track) => track.stop());
  }

  function resetRecorder() {
    recorderRef.current = null;
    stoppingRef.current = false;
    chunksRef.current = [];
  }

  function cleanupCamera() {
    clearTimers();
    stopCameraTracks();
    detachPreview();
    resetRecorder();
    setRecording(false);
    setRecordingSeconds(0);
  }

  function finishVideo(file: File | null) {
    stopCameraTracks();
    detachPreview();
    setRecording(false);
    setRecordingSeconds(0);
    setFinalizingVideo(false);

    if (!file) {
      setVideo(null);
      return;
    }

    if (file.size > MAX_VIDEO_SIZE_BYTES) {
      setError("Vidéo trop volumineuse. Maximum : 50 Mo.");
      setVideo(null);
      return;
    }

    setVideo(file);
  }

  function stopRecording() {
    const recorder = recorderRef.current;
    if (!recorder || stoppingRef.current) return;

    stoppingRef.current = true;
    clearTimers();
    setRecording(false);
    setFinalizingVideo(true);

    if (recorder.state === "recording") {
      try {
        recorder.requestData();
      } catch {
        // Le navigateur peut déjà finaliser le dernier fragment.
      }

      try {
        recorder.stop();
      } catch {
        setError("La vidéo n’a pas pu être finalisée.");
        cleanupCamera();
        setFinalizingVideo(false);
      }

      return;
    }

    if (recorder.state === "inactive") {
      finalizeInactiveRecorder(recorder);
    }
  }

  function finalizeInactiveRecorder(recorder: MediaRecorder) {
    const type = recorder.mimeType || "video/webm";
    const blob = new Blob(chunksRef.current, { type });
    const file = new File([blob], "signalement-video.webm", {
      type: "video/webm",
    });

    resetRecorder();
    finishVideo(file);
  }

  async function startVideoCapture() {
    setError("");

    if (recording || finalizingVideo) return;

    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setError("La caméra vidéo n’est pas disponible sur cet appareil.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 854, max: 854 },
          height: { ideal: 480, max: 480 },
          frameRate: { ideal: 24, max: 24 },
        },
        audio: false,
      });

      streamRef.current = stream;

      const mime =
        ["video/webm;codecs=vp8", "video/webm"].find((type) =>
          MediaRecorder.isTypeSupported(type),
        ) ?? "";

      const recorder = new MediaRecorder(stream, {
        ...(mime ? { mimeType: mime } : {}),
        videoBitsPerSecond: 900000,
      });

      chunksRef.current = [];
      recorderRef.current = recorder;
      stoppingRef.current = false;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        setError("La caméra n’a pas pu enregistrer la vidéo.");
        cleanupCamera();
        setFinalizingVideo(false);
      };

      recorder.onstop = () => {
        finalizeInactiveRecorder(recorder);
      };

      setRecording(true);
      setFinalizingVideo(false);
      setRecordingSeconds(0);
      recorder.start(500);

      const startedAt = Date.now();

      intervalRef.current = window.setInterval(() => {
        setRecordingSeconds(
          Math.min(
            CAPTURE_VIDEO_MAX_SECONDS,
            Math.floor((Date.now() - startedAt) / 1000),
          ),
        );
      }, 200);

      timerRef.current = window.setTimeout(
        stopRecording,
        CAPTURE_VIDEO_STOP_MS,
      );

      requestAnimationFrame(() => {
        const videoElement = cameraPreviewRef.current;
        if (!videoElement) return;

        videoElement.autoplay = true;
        videoElement.muted = true;
        videoElement.defaultMuted = true;
        videoElement.playsInline = true;
        videoElement.srcObject = stream;
        void videoElement.play().catch(() => undefined);
      });
    } catch (captureError) {
      cleanupCamera();
      setFinalizingVideo(false);
      setError(
        captureError instanceof Error
          ? captureError.message
          : "Impossible d’accéder à la caméra.",
      );
    }
  }

  useEffect(
    () => () => {
      clearTimers();

      const recorder = recorderRef.current;

      if (recorder && recorder.state === "recording") {
        try {
          recorder.stop();
        } catch {
          // Ignore les erreurs pendant le démontage du composant.
        }
      }

      stopCameraTracks();
      detachPreview();
      resetRecorder();
    },
    [],
  );

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

    if (recording || finalizingVideo) {
      setError("Attendez la fin de la finalisation de la vidéo.");
      return;
    }

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

    if (description.trim().length < 10) {
      setError("Décrivez le problème en au moins 10 caractères.");
      return;
    }

    if (!coords) {
      setError(
        "La position GPS est obligatoire pour vérifier qu’un problème n’a pas déjà été signalé à proximité.",
      );
      return;
    }

    if (files.length > MAX_PHOTOS) {
      setError("Maximum 5 photos par signalement.");
      return;
    }

    if (video) {
      if (video.size > MAX_VIDEO_SIZE_BYTES) {
        setError("Vidéo trop volumineuse. Maximum : 50 Mo.");
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
        description: description.trim(),
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

  const videoBusy = recording || finalizingVideo;

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
          Description
          <textarea
            required
            minLength={10}
            maxLength={MAX_DESCRIPTION_LENGTH}
            rows={5}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Décrivez le problème, ce qui se passe et, si possible, depuis quand…"
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
          className="button"
          data-pcs-tour="location"
          onClick={locate}
        >
          Utiliser ma position
        </button>

        {coords && (
          <small>
            GPS : {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
          </small>
        )}

        <fieldset className="mediaPicker" data-pcs-tour="photo">
          <legend>
            La vidéo ne peut pas dépasser {CAPTURE_VIDEO_MAX_SECONDS} secondes
          </legend>

          <div className="mediaPickerRow">
            <button
              type="button"
              className="mediaPickBtn"
              onClick={() => photoInputRef.current?.click()}
              disabled={videoBusy}
            >
              <span aria-hidden="true">📷</span> Prendre une photo
            </button>

            <input
              ref={photoInputRef}
              hidden
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              onChange={(event) => {
                addPhotos(event.target.files);
                event.target.value = "";
              }}
            />
          </div>

          <div className="mediaPickerRow">
            <button
              type="button"
              className="mediaPickBtn"
              onClick={() => void startVideoCapture()}
              disabled={videoBusy}
            >
              {recording
                ? `🎥 Enregistrement… ${recordingSeconds} s`
                : finalizingVideo
                  ? "⏳ Finalisation de la vidéo…"
                  : `🎥 Filmer (${CAPTURE_VIDEO_MAX_SECONDS} s)`}
            </button>
          </div>

          {recording && (
            <div className="cameraCapture">
              <video ref={cameraPreviewRef} autoPlay muted playsInline />
              <p>
                Arrêt automatique à {CAPTURE_VIDEO_MAX_SECONDS} secondes. La
                vidéo est ensuite finalisée avant l’envoi.
              </p>
            </div>
          )}

          {finalizingVideo && !recording && (
            <div className="cameraCapture">
              <p>⏳ Finalisation de la vidéo…</p>
            </div>
          )}

          {(files.length > 0 || video) && (
            <ul className="mediaChosen">
              {files.map((file, index) => (
                <li key={file.name + "-" + index}>
                  📷 {file.name}
                  <button
                    type="button"
                    onClick={() =>
                      setFiles((current) =>
                        current.filter(
                          (_, itemIndex) => itemIndex !== index,
                        ),
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
          disabled={saving || videoBusy}
          className="button primary"
          type="submit"
        >
          {saving ? "Envoi en cours…" : "Envoyer le signalement"}
        </button>
      </form>
    </section>
  );
}
