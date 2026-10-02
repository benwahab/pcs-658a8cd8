import { useEffect, useState } from "react";
import { Link } from "@/pcs/router";
import {
  listMyMissions,
  confirmFieldVerification,
  resolveMissionWithVideo,
} from "../services/mairie";
import BrandLogo from "../components/BrandLogo";
import { statusLabels } from "../types";
import {
  cacheAgentMissions,
  getCachedAgentMissions,
  queueFieldVerification,
  flushFieldVerifications,
  pendingFieldVerificationCount,
  queueResolutionVideo,
  flushResolutionVideos,
  pendingResolutionVideoCount,
} from "../services/offline";

export default function AgentTerrain() {
  const [missions, setMissions] = useState<any[]>(() => getCachedAgentMissions());
  const [error, setError] = useState("");
  const [offlinePending, setOfflinePending] = useState(0);
  const [verifyId, setVerifyId] = useState<string | null>(null);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [video, setVideo] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [index, setIndex] = useState(0);

  async function load() {
    try {
      const data = await listMyMissions();
      setMissions(data);
      cacheAgentMissions(data);
      setError("");
    } catch (e) {
      const cached = getCachedAgentMissions();
      if (cached.length) {
        setMissions(cached);
        setError("Mode hors connexion : missions précédemment chargées.");
      } else {
        setError(
          e instanceof Error ? e.message : "Impossible de charger les missions hors connexion.",
        );
      }
    }
    setOfflinePending(
      (await pendingFieldVerificationCount().catch(() => 0)) +
        (await pendingResolutionVideoCount().catch(() => 0)),
    );
  }

  async function syncPending() {
    if (!navigator.onLine) return;
    await flushFieldVerifications(async (item) => {
      await confirmFieldVerification(item.reportId, item.latitude, item.longitude, item.accuracy);
    });
    await flushResolutionVideos(async (item) => {
      const file = new File([item.video], item.fileName, { type: item.fileType });
      await resolveMissionWithVideo(
        item.reportId,
        file,
        item.latitude,
        item.longitude,
        item.accuracy,
      );
    });
    await load();
  }

  useEffect(() => {
    void load();
    void syncPending();
    window.addEventListener("online", syncPending);
    return () => window.removeEventListener("online", syncPending);
  }, []);

  function route(lat: number | null, lng: number | null) {
    if (lat === null || lng === null) return;
    window.open("https://www.google.com/maps/dir/?api=1&destination=" + lat + "," + lng, "_blank");
  }

  function locateVerification(reportId: string) {
    setError("");
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        const payload = {
          reportId,
          latitude: p.coords.latitude,
          longitude: p.coords.longitude,
          accuracy: p.coords.accuracy ?? null,
        };
        try {
          if (payload.accuracy === null || payload.accuracy > 20) {
            throw new Error("La précision GPS doit être de 20 mètres ou moins.");
          }
          if (!navigator.onLine) {
            await queueFieldVerification(payload);
            setOfflinePending((v) => v + 1);
            setVerifyId(null);
            setError(
              "Position enregistrée hors connexion. Elle sera transmise automatiquement dès que la connexion revient.",
            );
            return;
          }
          await confirmFieldVerification(
            payload.reportId,
            payload.latitude,
            payload.longitude,
            payload.accuracy,
          );
          setVerifyId(null);
          await load();
        } catch (e) {
          if (!navigator.onLine) {
            await queueFieldVerification(payload);
            setOfflinePending((v) => v + 1);
            setVerifyId(null);
            setError(
              "Connexion perdue : position enregistrée et mise en attente de synchronisation.",
            );
          } else {
            setError(e instanceof Error ? e.message : "Vérification impossible");
          }
        } finally {
          setBusy(false);
        }
      },
      () => {
        setError("La localisation GPS précise est obligatoire pour confirmer le signalement.");
        setBusy(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
      },
    );
  }

  function resolve(m: any) {
    if (!video) {
      setError("Ajoutez la vidéo de résolution.");
      return;
    }
    setError("");
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        const payload = {
          reportId: m.reports.id,
          video,
          latitude: p.coords.latitude,
          longitude: p.coords.longitude,
          accuracy: p.coords.accuracy ?? null,
        };
        try {
          if (payload.accuracy === null || payload.accuracy > 20) {
            throw new Error("La précision GPS doit être de 20 mètres ou moins.");
          }
          if (!navigator.onLine) {
            await queueResolutionVideo({
              reportId: payload.reportId,
              video: payload.video,
              fileName: payload.video.name,
              fileType: payload.video.type,
              latitude: payload.latitude,
              longitude: payload.longitude,
              accuracy: payload.accuracy,
            });
            setVideoId(null);
            setVideo(null);
            setOfflinePending((v) => v + 1);
            setError(
              "Vidéo et position enregistrées hors connexion. Elles seront transmises automatiquement dès que la connexion revient.",
            );
            return;
          }
          await resolveMissionWithVideo(
            payload.reportId,
            payload.video,
            payload.latitude,
            payload.longitude,
            payload.accuracy,
          );
          setVideoId(null);
          setVideo(null);
          await load();
        } catch (e) {
          if (!navigator.onLine) {
            await queueResolutionVideo({
              reportId: payload.reportId,
              video: payload.video,
              fileName: payload.video.name,
              fileType: payload.video.type,
              latitude: payload.latitude,
              longitude: payload.longitude,
              accuracy: payload.accuracy,
            });
            setVideoId(null);
            setVideo(null);
            setOfflinePending((v) => v + 1);
            setError("Connexion perdue : vidéo et position mises en attente de synchronisation.");
          } else {
            setError(e instanceof Error ? e.message : "Validation impossible");
          }
        } finally {
          setBusy(false);
        }
      },
      () => {
        setError("La localisation GPS précise est obligatoire pour publier la résolution.");
        setBusy(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
      },
    );
  }

  function next() {
    if (missions.length) setIndex((i) => Math.min(i + 1, missions.length - 1));
  }
  function prev() {
    if (missions.length) setIndex((i) => Math.max(i - 1, 0));
  }

  return (
    <section className="agentFeed">
      <header className="agentFeedTop">
        <Link to="/" className="feedBrand">
          <BrandLogo className="agentBrandLogo" />
        </Link>
        <div>
          <strong>Mes missions</strong>
          <small>
            {missions.length} mission(s)
            {offlinePending > 0 ? ` · ${offlinePending} en attente` : ""}
          </small>
        </div>
        <button className="agentRefresh" onClick={load}>
          ↻
        </button>
      </header>
      {error && (
        <div className="agentFeedError">
          {error}
          <button onClick={() => setError("")}>×</button>
        </div>
      )}
      {!missions.length && !error ? (
        <div className="agentEmpty">
          <span>✓</span>
          <h1>Aucune mission</h1>
          <p>Les missions attribuées par votre mairie apparaîtront ici.</p>
          <Link className="feedPrimary" to="/">
            Accueil
          </Link>
        </div>
      ) : (
        missions.length > 0 && (
          <div className="agentMissionViewport">
            {missions.map((m, i) => {
              const s = m.reports?.status;
              return (
                <article className={`agentMissionSlide ${i === index ? "current" : ""}`} key={m.id}>
                  <div className="missionBackdrop">
                    <div className="missionGlow" />
                  </div>
                  <div className="missionContent">
                    <div className="missionMeta">
                      <span>{m.reports?.reference_code}</span>
                      <span
                        className={`statusPill ${s === "verification" ? "amber" : s === "in_progress" ? "violet" : s === "resolved" ? "green" : "slate"}`}
                      >
                        {statusLabels[s as keyof typeof statusLabels] ?? s}
                      </span>
                    </div>
                    <h1>{m.reports?.title}</h1>
                    <p>{m.reports?.description}</p>
                    <div className="missionLocation">
                      <span>⌖</span>
                      <div>
                        <strong>
                          {m.reports?.location_label ?? "Localisation GPS enregistrée"}
                        </strong>
                        <small>Position du signalement</small>
                      </div>
                    </div>
                    <div className="missionActions">
                      {m.reports?.latitude != null && (
                        <button
                          onClick={() => route(m.reports.latitude, m.reports.longitude)}
                          className="feedActionButton"
                        >
                          ⌖ Itinéraire
                        </button>
                      )}
                      {s === "verification" && (
                        <button
                          className="feedActionButton primary"
                          disabled={busy}
                          onClick={() => setVerifyId(m.reports.id)}
                        >
                          ✓ Confirmer sur place
                        </button>
                      )}
                      {s === "in_progress" && (
                        <button
                          className="feedActionButton primary"
                          disabled={busy}
                          onClick={() => setVideoId(m.id)}
                        >
                          ● Publier la résolution
                        </button>
                      )}
                    </div>
                    {verifyId === m.reports?.id && (
                      <div className="agentActionSheet">
                        <strong>Confirmation terrain</strong>
                        <p>
                          Vous devez être physiquement à 20 mètres ou moins du lieu du signalement.
                        </p>
                        <button
                          className="feedActionButton primary"
                          disabled={busy}
                          onClick={() => locateVerification(m.reports.id)}
                        >
                          {busy ? "Vérification GPS…" : "Confirmer avec ma position GPS"}
                        </button>
                      </div>
                    )}
                    {videoId === m.id && (
                      <div className="agentActionSheet">
                        <strong>Publier la résolution</strong>
                        <label>
                          Vidéo prise sur place
                          <input
                            type="file"
                            accept="video/mp4,video/webm,video/quicktime"
                            capture="environment"
                            onChange={(e) => setVideo(e.target.files?.[0] ?? null)}
                          />
                        </label>
                        <p>
                          Vidéo et position GPS obligatoires. La vidéo doit être prise à 20 mètres
                          ou moins du lieu.
                        </p>
                        <button
                          className="feedActionButton primary"
                          disabled={!video || busy}
                          onClick={() => resolve(m)}
                        >
                          {busy ? "Publication…" : "Publier maintenant"}
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="missionRail">
                    <button
                      onClick={() => setError("La validation est enregistrée par le backend PCS.")}
                    >
                      ✓<small>Traçabilité</small>
                    </button>
                    <button onClick={() => route(m.reports?.latitude, m.reports?.longitude)}>
                      ⌖<small>GPS</small>
                    </button>
                    <button onClick={() => setIndex(i)} className="railActive">
                      #{i + 1}
                      <small>Mission</small>
                    </button>
                  </div>
                </article>
              );
            })}
            <button className="missionPager prev" disabled={index === 0} onClick={prev}>
              ↑
            </button>
            <button
              className="missionPager next"
              disabled={index === missions.length - 1}
              onClick={next}
            >
              ↓
            </button>
          </div>
        )
      )}
      <div className="agentFeedBottom">
        <Link to="/agent-terrain" className="active">
          <span>▣</span>
          <small>Missions</small>
        </Link>
        <button onClick={load}>
          <span>↻</span>
          <small>Actualiser</small>
        </button>
        <Link to="/" className="feedCreate">
          <span>⌂</span>
        </Link>
        <Link to="/notifications">
          <span>♧</span>
          <small>Alertes</small>
        </Link>
        <Link to="/connexion-operationnelle?mode=agent">
          <span>♙</span>
          <small>Compte</small>
        </Link>
      </div>
    </section>
  );
}
