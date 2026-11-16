import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@/pcs/router";
import { supabase } from "../lib/supabase";
import {
  listMyMissions,
  confirmFieldVerification,
  resolveMissionWithVideo,
  type AgentMission,
} from "../services/mairie";
import { statusLabels } from "../types";
import { getSession, getMyRoles } from "../services/permissions";

import {
  cacheAgentMissions,
  clearCachedAgentMissions,
  getCachedAgentMissions,
  queueFieldVerification,
  flushFieldVerifications,
  pendingFieldVerificationCount,
  queueResolutionVideo,
  flushResolutionVideos,
  pendingResolutionVideoCount,
} from "../services/offline";

export default function AgentTerrain() {
  const navigate = useNavigate();
  const [missions, setMissions] = useState<AgentMission[]>([]);
  const [agentUserId, setAgentUserId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [offlinePending, setOfflinePending] = useState(0);
  const [verifyId, setVerifyId] = useState<string | null>(null);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [video, setVideo] = useState<File | null>(null);
  const [videoError, setVideoError] = useState(""),
    [videoPreviewUrl, setVideoPreviewUrl] = useState("");
  const previewRef = useRef<HTMLVideoElement | null>(null),
    previewUrlRef = useRef("");
  const [busy, setBusy] = useState(false);
  const [videoProgress, setVideoProgress] = useState<number | null>(null);
  const [index, setIndex] = useState(0);

  async function logout() {
    setError("");
    if (offlinePending > 0) {
      setError(
        "Vous avez des éléments hors connexion en attente. Reconnectez-vous et synchronisez-les avant de vous déconnecter, afin de ne perdre aucune preuve de mission.",
      );
      return;
    }
    setBusy(true);
    try {
      if (!supabase) throw new Error("Service de connexion indisponible.");
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
      if (agentUserId) clearCachedAgentMissions(agentUserId);
      navigate("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "La déconnexion a échoué. Réessayez.");
    } finally {
      setBusy(false);
    }
  }

  async function load() {
    try {
      const data = await listMyMissions();
      setMissions(data);
      if (agentUserId) cacheAgentMissions(agentUserId, data);
      setError("");
    } catch (e) {
      const cached = agentUserId ? getCachedAgentMissions<AgentMission>(agentUserId) : [];
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
      (await (agentUserId ? pendingFieldVerificationCount(agentUserId) : Promise.resolve(0)).catch(
        () => 0,
      )) +
        (await (agentUserId ? pendingResolutionVideoCount(agentUserId) : Promise.resolve(0)).catch(
          () => 0,
        )),
    );
  }

  async function syncPending() {
    if (!navigator.onLine) return;
    let failed = 0;
    try {
      const verifications = await flushFieldVerifications(agentUserId!, async (item) => {
        await confirmFieldVerification(item.reportId, item.latitude, item.longitude, item.accuracy);
      });
      failed += verifications.failed;
      const videos = await flushResolutionVideos(agentUserId!, async (item) => {
        const file = new File([item.video], item.fileName, { type: item.fileType });
        await resolveMissionWithVideo(
          item.reportId,
          file,
          item.latitude,
          item.longitude,
          item.accuracy,
        );
      });
      failed += videos.failed;
      await load();
      if (failed > 0) {
        setError(
          `Synchronisation incomplète : ${failed} élément(s) restent en attente. Vérifiez la connexion puis actualisez.`,
        );
      }
    } catch (e) {
      await load();
      setError(
        e instanceof Error
          ? `Synchronisation impossible : ${e.message}`
          : "Synchronisation impossible. Les éléments restent en attente.",
      );
    }
  }

  useEffect(
    () => () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    },
    [],
  );
  useEffect(() => {
    if (previewRef.current && videoPreviewUrl) previewRef.current.src = videoPreviewUrl;
  }, [videoPreviewUrl]);
  useEffect(() => {
    let active = true;
    (async () => {
      const session = await getSession();
      if (!session) {
        if (active) navigate("/connexion-operationnelle?mode=agent");
        return;
      }
      const metadataRole = session.user.user_metadata?.role;
      if (navigator.onLine) {
        try {
          const roles = await getMyRoles();
          if (!roles.includes("agent_terrain")) {
            if (active) navigate("/connexion-operationnelle?mode=agent");
            return;
          }
          if (!supabase) {
            if (active) navigate("/connexion-operationnelle?mode=agent");
            return;
          }
          const { data: agent, error: agentError } = await supabase
            .from("field_agents")
            .select("is_active")
            .eq("user_id", session.user.id)
            .maybeSingle();
          if (agentError || !agent?.is_active) {
            if (active) navigate("/connexion-operationnelle?mode=agent");
            return;
          }
        } catch {
          if (metadataRole !== "agent_terrain") {
            if (active) navigate("/connexion-operationnelle?mode=agent");
            return;
          }
        }
      } else if (metadataRole !== "agent_terrain") {
        if (active) navigate("/connexion-operationnelle?mode=agent");
        return;
      }
      if (!active) return;
      setAgentUserId(session.user.id);
    })();
    return () => {
      active = false;
    };
  }, [navigate]);

  useEffect(() => {
    if (!agentUserId) return;
    void load();
    void syncPending();
    window.addEventListener("online", syncPending);
    return () => window.removeEventListener("online", syncPending);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chargement initial une seule fois, dès que l'agent est identifié (`load`/`syncPending` sont recréés à chaque rendu)
  }, [agentUserId]);

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
            await queueFieldVerification({ agentId: agentUserId!, ...payload });
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
            await queueFieldVerification({ agentId: agentUserId!, ...payload });
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

  function cancelVideoSelection() {
    setVideo(null);
    setVideoError("");
    setVideoId(null);
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = "";
    setVideoPreviewUrl("");
  }
  function resolve(m: AgentMission) {
    if (!video) {
      setError("Ajoutez une photo ou une vidéo de résolution.");
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
              agentId: agentUserId!,
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
              "Preuve (photo ou vidéo) et position enregistrées hors connexion. Elles seront transmises automatiquement dès que la connexion revient.",
            );
            return;
          }
          await resolveMissionWithVideo(
            payload.reportId,
            payload.video,
            payload.latitude,
            payload.longitude,
            payload.accuracy,
            undefined,
            (ratio) => setVideoProgress(ratio),
          );
          setVideoId(null);
          setVideo(null);
          await load();
        } catch (e) {
          if (!navigator.onLine) {
            await queueResolutionVideo({
              agentId: agentUserId!,
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
            setError("Connexion perdue : preuve et position mises en attente de synchronisation.");
          } else {
            setError(e instanceof Error ? e.message : "Validation impossible");
          }
        } finally {
          setVideoProgress(null);
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
      <style>{`
        .agentFeed {
          width: 100%;
          max-width: 920px;
          min-height: 100%;
          margin: 0 auto;
          padding: 18px clamp(12px, 3vw, 26px) 32px;
          color: #21152f;
          box-sizing: border-box;
        }
        .agentFeed .agentFeedTop {
          position: sticky;
          top: 0;
          z-index: 20;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 14px;
          margin: 0 0 18px;
          border: 1px solid #e8e1f0;
          border-radius: 18px;
          background: rgba(255,255,255,.96);
          box-shadow: 0 8px 24px rgba(42, 18, 66, .07);
          backdrop-filter: blur(12px);
        }
        .agentFeed .agentFeedTop > div { flex: 1; min-width: 0; }
        .agentFeed .agentFeedTop strong {
          display: block; color: #29143d; font-size: 17px; font-weight: 800;
        }
        .agentFeed .agentFeedTop small {
          display: block; margin-top: 3px; color: #786b86; font-size: 12px;
        }
        .agentFeed .agentRefresh,
        .agentFeed .agentLogout {
          min-height: 42px; border-radius: 12px; font-weight: 750;
        }
        .agentFeed .agentRefresh {
          width: 42px; border: 1px solid #e4d9ef; background: #f7f2fb;
          color: #582a78; font-size: 22px;
        }
        .agentFeed .agentLogout {
          padding: 0 12px !important; border: 1px solid #f2caca !important;
          background: #fff7f7 !important; color: #a52828 !important;
          font-size: 13px;
        }
        .agentFeed .agentFeedError {
          display: flex; align-items: flex-start; gap: 12px;
          padding: 13px 15px; margin: 0 0 16px;
          border: 1px solid #f3d1d1; border-radius: 14px;
          background: #fff7f7; color: #9f2626; font-size: 13px; line-height: 1.5;
        }
        .agentFeed .agentFeedError button {
          margin-left: auto; border: 0; background: transparent; color: inherit;
          font-size: 20px; line-height: 1;
        }
        .agentFeed .agentMissionViewport { width: 100%; }
        .agentFeed .agentMissionSlide .missionContent {
          position: relative; z-index: 1; width: 100%; box-sizing: border-box;
          padding: clamp(16px, 3vw, 26px);
          border: 1px solid #e9e1f1; border-radius: 22px;
          background: #fff; color: #261833;
          box-shadow: 0 14px 38px rgba(43, 19, 66, .09);
        }
        .agentFeed .missionBackdrop { pointer-events: none; }
        .agentFeed .missionMeta {
          display: flex; align-items: center; justify-content: space-between;
          gap: 10px; flex-wrap: wrap; margin-bottom: 14px;
        }
        .agentFeed .missionMeta > span:first-child {
          color: #76558d; font-size: 12px; font-weight: 800;
          letter-spacing: .045em;
        }
        .agentFeed .statusPill {
          display: inline-flex; align-items: center; min-height: 27px;
          padding: 4px 11px; border-radius: 999px; font-size: 11px;
          font-weight: 800; line-height: 1.2;
        }
        .agentFeed .statusPill.amber { background: #fff4d9; color: #8a5b00; }
        .agentFeed .statusPill.violet { background: #f0e8fa; color: #60318a; }
        .agentFeed .statusPill.slate { background: #eef0f4; color: #596273; }
        .agentFeed .missionContent > h1 {
          margin: 0 0 16px; color: #241331; font-size: clamp(21px, 4vw, 28px);
          font-weight: 850; line-height: 1.2; overflow-wrap: anywhere;
        }
        .agentFeed .missionLocation {
          display: flex; align-items: flex-start; gap: 12px;
          padding: 13px 14px; border: 1px solid #eee7f4;
          border-radius: 15px; background: #faf8fc;
        }
        .agentFeed .missionLocation > span {
          display: grid; place-items: center; flex: 0 0 34px; height: 34px;
          border-radius: 11px; background: #efe7f7; color: #63358a; font-size: 19px;
        }
        .agentFeed .missionLocation strong {
          display: block; color: #352443; font-size: 13px; line-height: 1.4;
        }
        .agentFeed .missionLocation small {
          display: block; margin-top: 3px; color: #84788e; font-size: 11px;
        }
        .agentFeed .agentOriginalMedia {
          display: grid !important; gap: 10px !important; margin: 18px 0 !important;
          padding: 14px; border: 1px solid #ece4f2; border-radius: 17px;
          background: #fcfbfd;
        }
        .agentFeed .agentOriginalMedia > strong {
          color: #352443; font-size: 13px; font-weight: 800;
        }
        .agentFeed .agentOriginalMedia img,
        .agentFeed .agentOriginalMedia video {
          display: block; width: 100%; max-height: 42vh; border-radius: 13px;
          object-fit: contain; background: #17121d;
        }
        .agentFeed .missionContent > p {
          color: #746b7d; font-size: 13px; line-height: 1.5;
        }
        .agentFeed .missionActions {
          display: flex; flex-wrap: wrap; gap: 10px; margin-top: 18px;
        }
        .agentFeed .feedActionButton {
          display: inline-flex; align-items: center; justify-content: center;
          min-height: 46px; padding: 10px 15px; border: 1px solid #ded3e8;
          border-radius: 13px; background: #fff; color: #51336a;
          font-size: 13px; font-weight: 800; line-height: 1.3;
          box-shadow: 0 3px 10px rgba(48, 24, 67, .04);
        }
        .agentFeed .feedActionButton.primary {
          border-color: #5b2b7c; background: #5b2b7c; color: #fff;
          box-shadow: 0 6px 16px rgba(91, 43, 124, .18);
        }
        .agentFeed .feedActionButton:disabled {
          opacity: .55; cursor: not-allowed; box-shadow: none;
        }
        .agentFeed .agentActionSheet {
          display: grid; gap: 10px; margin-top: 16px; padding: 16px;
          border: 1px solid #e8dff0; border-radius: 17px; background: #f9f6fc;
        }
        .agentFeed .agentActionSheet > strong {
          color: #38214c; font-size: 14px; font-weight: 850;
        }
        .agentFeed .agentActionSheet p {
          margin: 0; color: #6e6378; font-size: 13px; line-height: 1.55;
        }
        .agentFeed .agentActionSheet input,
        .agentFeed .agentActionSheet button { max-width: 100%; }
        .agentFeed .missionRail {
          display: flex; align-items: center; justify-content: center;
          gap: 8px; margin: 14px auto 0;
        }
        .agentFeed .missionRail button {
          display: flex; align-items: center; gap: 6px; min-height: 38px;
          padding: 7px 12px; border: 1px solid #e7deee; border-radius: 12px;
          background: #fff; color: #65427c; font-weight: 750;
        }
        .agentFeed .missionRail button small { font-size: 10px; }
        .agentFeed .missionRail button.railActive {
          border-color: #5b2b7c; background: #f2eafa; color: #4e246e;
        }
        .agentFeed .missionPager {
          border: 1px solid #e6dced; border-radius: 50%; background: #fff;
          color: #5b2b7c; box-shadow: 0 5px 16px rgba(43,19,66,.1);
        }
        .agentFeed .agentEmpty {
          max-width: 520px; margin: 48px auto; padding: 34px 22px;
          border: 1px solid #e9e1f1; border-radius: 22px; background: #fff;
          text-align: center; box-shadow: 0 12px 32px rgba(43,19,66,.07);
        }
        .agentFeed .agentEmpty > span {
          display: inline-grid; place-items: center; width: 54px; height: 54px;
          border-radius: 17px; background: #f0e8f8; color: #5b2b7c; font-size: 25px;
        }
        .agentFeed .agentEmpty h1 { margin: 14px 0 6px; color: #2c1a3a; font-size: 22px; }
        .agentFeed .agentEmpty p { margin: 0; color: #786e81; font-size: 13px; line-height: 1.5; }
        @media (max-width: 600px) {
          .agentFeed { padding: 10px 10px 24px; }
          .agentFeed .agentFeedTop { gap: 7px; padding: 10px; margin-bottom: 12px; }
          .agentFeed .agentFeedTop strong { font-size: 15px; }
          .agentFeed .agentLogout { padding: 0 9px !important; font-size: 11px; }
          .agentFeed .missionActions { display: grid; grid-template-columns: 1fr; }
          .agentFeed .missionActions .feedActionButton { width: 100%; }
          .agentFeed .agentActionSheet .feedActionButton { width: 100%; }
          .agentFeed .missionRail button { padding: 7px 9px; }
        }
      `}</style>
      <header className="agentFeedTop">
        <div>
          <strong>Mes missions</strong>
          <small>
            {missions.length} mission(s)
            {offlinePending > 0 ? ` · ${offlinePending} en attente` : ""}
          </small>
        </div>
        <button
          className="agentRefresh"
          onClick={load}
          aria-label="Actualiser les missions"
          title="Actualiser"
        >
          ↻
        </button>
        <button
          className="agentLogout"
          onClick={logout}
          disabled={busy}
          style={{
            border: "1px solid #fecaca",
            borderRadius: 10,
            padding: "8px 10px",
            background: "#fff",
            color: "#b91c1c",
            fontWeight: 700,
            whiteSpace: "nowrap",
          }}
        >
          ↪ Déconnexion
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
                        className={`statusPill ${s === "verification" ? "amber" : s === "in_progress" ? "violet" : s === "resolved" ? "violet" : "slate"}`}
                      >
                        {statusLabels[s as keyof typeof statusLabels] ?? s}
                      </span>
                    </div>
                    <h1>{m.reports?.title}</h1>
                    <div className="missionLocation">
                      <span>⌖</span>
                      <div>
                        <strong>
                          {m.reports?.location_label ?? "Localisation GPS enregistrée"}
                        </strong>
                        <small>Position du signalement</small>
                      </div>
                    </div>
                    {!!m.original_media?.length && (
                      <div className="agentOriginalMedia" style={{ display: "grid", gap: 10, margin: "14px 0" }}>
                        <strong>Pièces jointes du signalement</strong>
                        {m.original_media.map((media) => (
                          media.previewUrl ? (
                            media.media_type.startsWith("video") ? (
                              <video
                                key={media.id}
                                src={media.previewUrl}
                                controls
                                playsInline
                                preload="metadata"
                                style={{ width: "100%", maxHeight: "42vh", borderRadius: 12, background: "#111", objectFit: "contain" }}
                              />
                            ) : (
                              <img
                                key={media.id}
                                src={media.previewUrl}
                                alt="Photo du signalement"
                                loading="lazy"
                                style={{ width: "100%", maxHeight: "42vh", borderRadius: 12, objectFit: "contain", background: "#f1f5f9" }}
                              />
                            )
                          ) : (
                            <p key={media.id}>Un média du signalement n’a pas pu être chargé.</p>
                          )
                        ))}
                      </div>
                    )}
                    {!m.original_media?.length && (
                      <p style={{ margin: "12px 0", color: "#64748b", fontSize: 13 }}>
                        Aucune photo ou vidéo approuvée n’est disponible pour ce signalement.
                      </p>
                    )}
                    <div className="missionActions">
                      {m.reports?.latitude != null && (
                        <button
                          onClick={() => route(m.reports.latitude, m.reports.longitude)}
                          className="feedActionButton"
                        >
                          ⌖ Itinéraire
                        </button>
                      )}
                      {!["in_progress", "resolved", "rejected"].includes(s ?? "") && (
                        <button
                          className="feedActionButton primary"
                          disabled={busy}
                          onClick={() => setVerifyId(m.reports.id)}
                        >
                          ✓ Confirmer sur place
                        </button>
                      )}
                      {s === "in_progress" && !m.resolution_pending && (
                        <button
                          className="feedActionButton primary"
                          disabled={busy}
                          onClick={() => {
                            cancelVideoSelection();
                            setVideoId(m.id);
                          }}
                        >
                          ● Publier la résolution
                        </button>
                      )}
                    </div>
                    {m.resolution_pending && (
                      <div className="agentActionSheet">
                        <strong>Preuve envoyée</strong>
                        <p>Votre photo ou vidéo est en attente de validation par l'organisme responsable. Vous pourrez transmettre une nouvelle preuve si elle est rejetée.</p>
                      </div>
                    )}
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
                        <strong>Ajouter une photo ou une vidéo de résolution</strong>
                        {videoError && (
                          <p role="alert" style={{ color: "#b91c1c" }}>
                            {videoError}
                          </p>
                        )}
                        {video && videoPreviewUrl && (
                          <>
                            {video.type.startsWith("image/") ? (
                              <img
                                src={videoPreviewUrl}
                                alt="Aperçu de la preuve de résolution"
                                style={{ width: "100%", maxHeight: "42vh", objectFit: "contain", borderRadius: 12 }}
                              />
                            ) : (
                              <video
                                ref={previewRef}
                                controls
                                playsInline
                                style={{
                                  width: "100%",
                                  maxHeight: "42vh",
                                  borderRadius: 12,
                                  background: "#111",
                                  objectFit: "contain",
                                }}
                              />
                            )}
                            <p>{video.type.startsWith("image/") ? "Photo" : "Vidéo"} prête ({(video.size / 1024 / 1024).toFixed(1)} Mo).</p>
                          </>
                        )}
                        <div
                          style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "10px 0" }}
                        >
                          <button
                            type="button"
                            className="feedActionButton primary"
                            disabled={busy}
                            onClick={() =>
                              document.getElementById("agent-resolution-video-import")?.click()
                            }
                          >
                            {video ? "Choisir un autre média" : "Choisir une photo ou vidéo"}
                          </button>
                          <input
                            id="agent-resolution-video-import"
                            hidden
                            type="file"
                            accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime,.jpg,.jpeg,.png,.webp,.mp4,.webm,.mov,.m4v"
                            onChange={(event) => {
                              const file = event.target.files?.[0] ?? null;
                              event.target.value = "";
                              if (!file) return;
                              if (file.size <= 0) {
                                setVideoError("Le fichier de résolution est vide.");
                                return;
                              }
                              if (
                                ![
                                  "image/jpeg",
                                  "image/png",
                                  "image/webp",
                                  "video/mp4",
                                  "video/webm",
                                  "video/quicktime",
                                ].includes(file.type)
                              ) {
                                setVideoError("Format non pris en charge. Utilisez JPG, PNG, WEBP, MP4, WebM ou MOV.");
                                return;
                              }
                              setVideoError("");
                              setVideo(file);
                              if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
                              previewUrlRef.current = URL.createObjectURL(file);
                              setVideoPreviewUrl(previewUrlRef.current);
                            }}
                          />
                        </div>
                        <p>
                          Formats acceptés : JPG, PNG, WEBP, MP4, WebM ou MOV, sans limite de durée ni plafond de taille applicatif. Une position GPS précise à 20 mètres ou moins du signalement reste requise.
                        </p>
                        <button
                          className="feedActionButton primary"
                          disabled={!video || busy}
                          onClick={() => resolve(m)}
                        >
                          {busy
                            ? videoProgress !== null && videoProgress < 1
                              ? `Optimisation de la vidéo… ${Math.round(videoProgress * 100)} %`
                              : "Envoi…"
                            : "Envoyer la preuve de résolution"}
                        </button>
                        <button
                          type="button"
                          className="feedActionButton"
                          disabled={busy}
                          onClick={cancelVideoSelection}
                        >
                          Annuler
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
    </section>
  );
}
