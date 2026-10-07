import { useEffect, useRef, useState } from "react";
import { Link } from "@/pcs/router";
import { supabase } from "../lib/supabase";
import { listPublicReports } from "../lib/reports";

// Hide the two explicitly archived citizen test videos from the public feed.
// Keep the report records and the separate photo attached to the 30 September report untouched.
const HIDDEN_TEST_MEDIA_IDS = new Set([
  "3bc68590-9fc8-4fd6-add5-0fc2856840ea", // PCS-20261002-7A2D729F
  "6c7a3f58-2f85-408e-8611-1a5fcce6a06a", // PCS-20261001-F32BB56F
]);
import type { PublicReport } from "../types";
import { statusLabels } from "../types";
import { createReportMediaUrl } from "../services/media";
import BrandLogo from "../components/BrandLogo";
import introArtAsset from "@/assets/pcs-hero.webp.asset.json";
import { MediaCarousel } from "../components/MediaCarousel";

async function sharePublicReport(report: PublicReport, onFallbackMessage: (message: string) => void) {
  if (!report.id) return;
  const url = new URL(`/signalement/${encodeURIComponent(report.id)}`, window.location.origin).toString();
  const shareData = { title: report.title ? `${report.title} — PCS` : "Signalement citoyen — PCS", text: "Consultez ce signalement citoyen sur PCS.", url };
  try {
    if (typeof navigator.share === "function" && (!navigator.canShare || navigator.canShare(shareData))) { await navigator.share(shareData); return; }
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(url); onFallbackMessage("Lien du signalement copié."); return; }
  } catch (error) { if (error instanceof DOMException && error.name === "AbortError") return; }
  onFallbackMessage(`Lien du signalement : ${url}`);
}

export default function Home() {
  const [reports, setReports] = useState<PublicReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [headerHidden, setHeaderHidden] = useState(false);
  const [headerScrolled, setHeaderScrolled] = useState(false);
  const [introFirstVisit, setIntroFirstVisit] = useState(false);

  useEffect(() => {
    let active = true;
    let inFlight = false;
    let lastRefreshAt = 0;
    const refreshReports = async (force = false) => {
      // Avoid overlapping requests when the timer, tab visibility and window focus
      // fire close together. A short cooldown also prevents duplicate focus events.
      const now = Date.now();
      if (inFlight || (!force && now - lastRefreshAt < 5000)) return;
      inFlight = true;
      lastRefreshAt = now;
      try {
        const nextReports = await listPublicReports();
        if (active) {
          // Exclude the two empty test-video publications from the home feed entirely.
          // Keep the underlying reports and the separate photo on the 30 September report intact.
          const hiddenTestReportRefs = new Set([
            "PCS-20261002-7A2D729F",
            "PCS-20261001-F32BB56F",
          ]);
          setReports(nextReports.filter((report) => !hiddenTestReportRefs.has(report.reference_code ?? "")));
          setError("");
        }
      } catch (error) {
        if (active) setError(error instanceof Error ? error.message : "Impossible de charger les signalements publics.");
      } finally {
        inFlight = false;
        if (active) setLoading(false);
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refreshReports();
    };
    void refreshReports(true);
    const timer = window.setInterval(() => void refreshReports(), 30000);
    window.addEventListener("focus", onVisibility);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", onVisibility);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reducedMotion) {
      setIntroFirstVisit(true);
    }

    const feed = document.querySelector<HTMLElement>(".citizenFeed");
    if (!feed) return;

    const resetHomePosition = () => {
      setHeaderHidden(false);
      setHeaderScrolled(false);
      feed.scrollTo({ top: 0, left: 0, behavior: "auto" });
      document.querySelector<HTMLElement>("main")?.scrollTo({ top: 0, left: 0, behavior: "auto" });
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      feed.querySelector<HTMLElement>(".citizenSlideIntro")?.scrollIntoView({
        block: "start",
        behavior: "auto",
      });
      feed.scrollTo({ top: 0, left: 0, behavior: "auto" });
    };

    // On entering the home route, always begin at the report-entry slide.
    resetHomePosition();

    // Scroll discoverability hint: show a short native-feed movement after
    // a few seconds of inactivity. After each completed hint, wait again so a
    // citizen who remains on the home page can rediscover the scroll naturally.
    let hintCancelled = false;
    let hinting = false;
    let hintStartTimer: number | undefined;
    let hintReturnTimer: number | undefined;
    let hintResetTimer: number | undefined;
    let hintRepeatTimer: number | undefined;

    const scheduleScrollHint = (delay = 3000) => {
      if (hintCancelled || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      if (hintStartTimer !== undefined) window.clearTimeout(hintStartTimer);
      hintStartTimer = window.setTimeout(() => {
        if (hintCancelled || hinting || feed.scrollTop > 2) return;

        hinting = true;
        feed.scrollTo({ top: 30, left: 0, behavior: "smooth" });

        hintReturnTimer = window.setTimeout(() => {
          if (hintCancelled) {
            hinting = false;
            return;
          }

          feed.scrollTo({ top: 0, left: 0, behavior: "smooth" });
          hintResetTimer = window.setTimeout(() => {
            hinting = false;
            scheduleScrollHint(8000);
          }, 500);
        }, 650);
      }, delay);
    };

    const cancelScrollHint = () => {
      hintCancelled = true;
      if (hintStartTimer !== undefined) window.clearTimeout(hintStartTimer);
      if (hintReturnTimer !== undefined) window.clearTimeout(hintReturnTimer);
      if (hintResetTimer !== undefined) window.clearTimeout(hintResetTimer);
      if (hintRepeatTimer !== undefined) window.clearTimeout(hintRepeatTimer);
      if (hinting) {
        hinting = false;
        feed.scrollTo({ top: 0, left: 0, behavior: "auto" });
      }
    };

    scheduleScrollHint();
    window.addEventListener("pcs-home-reset", resetHomePosition);

    let lastScrollTop = feed.scrollTop;

    const onScroll = () => {
      const current = Math.max(0, feed.scrollTop);

      // The onboarding hint is only a visual preview. Keep the navigation in
      // its normal top state while the preview moves the feed.
      if (hinting) {
        setHeaderScrolled(false);
        setHeaderHidden(false);
        lastScrollTop = current;
        return;
      }

      setHeaderScrolled(current > 8);

      if (current <= 8) {
        setHeaderHidden(false);
      } else if (current > lastScrollTop + 2) {
        setHeaderHidden(true);
      } else if (current < lastScrollTop - 2) {
        setHeaderHidden(false);
      }

      lastScrollTop = current;
    };

    feed.addEventListener("scroll", onScroll, { passive: true });
    const cancelEvents = ["touchstart", "pointerdown", "wheel"] as const;
    cancelEvents.forEach((eventName) => feed.addEventListener(eventName, cancelScrollHint, { passive: true }));
    return () => {
      window.removeEventListener("pcs-home-reset", resetHomePosition);
      feed.removeEventListener("scroll", onScroll);
      cancelEvents.forEach((eventName) => feed.removeEventListener(eventName, cancelScrollHint));
      cancelScrollHint();
    };
  }, []);

  return (
    <section className="citizenFeed">
      <div
        className={`citizenFeedTop${headerHidden ? " headerHidden" : ""}${headerScrolled ? " headerScrolled" : ""}`}
      >
        <Link
          className="feedBrand"
          data-pcs-tour="home"
          to="/"
          aria-label="Accueil — revenir au début du flux"
          onClick={(event) => {
            // This is an in-page control, not a route change. Prevent router
            // scroll restoration from racing with the feed reset.
            event.preventDefault();
            const feed = document.querySelector<HTMLElement>(".citizenFeed");
            const intro = feed?.querySelector<HTMLElement>(".citizenSlideIntro");

            setHeaderHidden(false);
            setHeaderScrolled(false);

            // Reset both possible scroll containers: the feed itself and the
            // document. scrollIntoView is a final fallback for mobile layouts.
            feed?.scrollTo({ top: 0, left: 0, behavior: "auto" });
            window.scrollTo({ top: 0, left: 0, behavior: "auto" });
            intro?.scrollIntoView({ block: "start", behavior: "smooth" });
          }}
        >
          <BrandLogo className="feedBrandLogo" />
        </Link>

        <div className="feedTabs">
          <span className="active">Tous les signalements</span>
        </div>


      </div>

      <article className={`citizenSlide citizenSlideIntro${introFirstVisit ? " introFirstVisit" : ""}`}>
        <div
          className="introArt"
          aria-hidden="true"
          style={{ backgroundImage: `url(${introArtAsset.url})` }}
        />
        <div className="introScrim" aria-hidden="true" />
        <div className="slideContent">
          <p className="eyebrow feedEyebrow">PLATEFORME CITOYENNE</p>
          <h1>
            Les problèmes publics,
            <br />
            <strong>visibles et suivis.</strong>
          </h1>
          <p>
            Parcourez les signalements publiés dans tout le Niger, suivez leur
            évolution et consultez les résolutions.
          </p>
          <div className="feedActions">
            <Link
              className="feedPrimary"
              data-pcs-tour="create-report"
              to="/signaler"
            >
              ＋ Signaler un problème
            </Link>
          </div>
        </div>
      </article>

      {error && (
        <article className="citizenSlide">
          <div className="slideContent">
            <p className="error">{error}</p>
          </div>
        </article>
      )}

      {loading && (
        <article className="citizenSlide">
          <div className="slideContent">
            <p>Chargement des signalements…</p>
          </div>
        </article>
      )}

      {!loading && reports.length === 0 && !error && (
        <article className="citizenSlide">
          <div className="slideContent">
            <h2>Aucun signalement public pour le moment.</h2>
            <p>
              Les signalements publiés apparaîtront ici au fur et à mesure.
            </p>
          </div>
        </article>
      )}

      {reports.map((report) => (
        <PublicReportSlide key={report.id} report={report} />
      ))}
    </section>
  );
}

function PublicReportSlide({ report }: { report: PublicReport }) {
  const [media, setMedia] = useState<
    { id: string; url: string; media_role: string; media_type: string }[]
  >([]);
  const [mediaReady, setMediaReady] = useState(false);
  const [mediaRefresh, setMediaRefresh] = useState(0);
  const [visitorToken, setVisitorToken] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [publicComments, setPublicComments] = useState<{ id: string; display_name: string | null; body: string; created_at: string }[]>([]);
  const [confirmationCount, setConfirmationCount] = useState(0);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [interactionBusy, setInteractionBusy] = useState(false);
  const [interactionMessage, setInteractionMessage] = useState("");
  const slideRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!mediaReady) return;
    // Signed media URLs are valid for one hour; refresh every 45 minutes rather
    // than querying Storage every 30 seconds for every visible report.
    let lastRefreshAt = Date.now();
    const refreshIfStale = () => {
      if (Date.now() - lastRefreshAt < 45 * 60 * 1000) return;
      lastRefreshAt = Date.now();
      setMediaRefresh((value) => value + 1);
    };
    const timer = window.setInterval(refreshIfStale, 60 * 1000);
    window.addEventListener("focus", refreshIfStale);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshIfStale);
    };
  }, [mediaReady]);

  useEffect(() => {
    const slide = slideRef.current;
    if (!slide || !supabase || !report.id) {
      setMedia([]);
      return;
    }

    if (!("IntersectionObserver" in window)) {
      setMediaReady(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setMediaReady(true);
          observer.disconnect();
        }
      },
      { rootMargin: "700px 0px", threshold: 0 },
    );

    observer.observe(slide);
    return () => observer.disconnect();
  }, [report.id]);

  useEffect(() => {
    if (!mediaReady || !supabase || !report.id) return;

    let cancelled = false;
    const reportId = report.id;

    void (async () => {
      try {
        const { data, error } = await supabase
          .from("public_report_media")
          .select("id,storage_path,media_role,media_type,moderation_status")
          .eq("report_id", reportId)
          .order("created_at", { ascending: true });

        if (error) throw error;

        // Fail closed: never create a URL or render a media item unless the
        // database explicitly returns moderation_status='approved'. The view also
        // filters this server-side; this is a second, client-side safety boundary.
        const publicEvidence = (data ?? []).filter(
          (item) =>
            item.id &&
            item.storage_path &&
            item.moderation_status === "approved" &&
            (item.media_role === "citizen_evidence" || item.media_role === "resolution_video") &&
            !HIDDEN_TEST_MEDIA_IDS.has(item.id as string),
        );

        // A broken/expired URL for one attachment must not hide the other valid
        // photos or videos belonging to the same public report.
        const settledUrls = await Promise.allSettled(
          publicEvidence.map(async (item) => ({
            id: item.id as string,
            url: await createReportMediaUrl(item.storage_path as string),
            media_role: item.media_role ?? "citizen_evidence",
            media_type: item.media_type ?? "image",
          })),
        );
        const urls = settledUrls.flatMap((result) =>
          result.status === "fulfilled" ? [result.value] : [],
        );

        if (!cancelled) {
          setMedia(
            urls.sort((a, b) => {
              // Keep all original citizen evidence first; append the mairie-approved
              // resolution video at the end of the same horizontal carousel.
              const aIsResolution = a.media_role === "resolution_video";
              const bIsResolution = b.media_role === "resolution_video";
              if (aIsResolution !== bIsResolution) return Number(aIsResolution) - Number(bIsResolution);
              const aIsVideo = a.media_type.startsWith("video");
              const bIsVideo = b.media_type.startsWith("video");
              return Number(bIsVideo) - Number(aIsVideo);
            }),
          );
        }
      } catch {
        if (!cancelled) setMedia([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mediaReady, mediaRefresh, report.id]);


  useEffect(() => {
    if (!report.id) return;
    const storageKey = "pcs-citizen-token";
    const createToken = () => {
      // randomUUID n'est pas disponible dans certains navigateurs embarqués.
      if (typeof window.crypto?.randomUUID === "function") return window.crypto.randomUUID();
      if (typeof window.crypto?.getRandomValues === "function") {
        const bytes = new Uint8Array(16);
        window.crypto.getRandomValues(bytes);
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
      }
      throw new Error("Ce navigateur ne permet pas de créer un identifiant sécurisé.");
    };
    let token = "";
    try {
      token = window.localStorage.getItem(storageKey) ?? "";
      if (!token) {
        token = createToken();
        window.localStorage.setItem(storageKey, token);
      }
    } catch {
      try { token = createToken(); } catch { token = ""; }
    }
    setVisitorToken(token || null);
    if (!token) setInteractionMessage("Activez un navigateur sécurisé pour confirmer ce signalement.");
  }, [report.id]);

  useEffect(() => {
    if (!supabase || !report.id || !visitorToken) return;
    let cancelled = false;
    void (async () => {
      const { data: reaction, error: reactionError } = await supabase.rpc("get_public_report_confirmation", {
        p_report_id: report.id!,
        p_visitor_token: visitorToken!,
      });
      if (reactionError) throw reactionError;
      if (!cancelled && reaction && typeof reaction === "object") {
        const result = reaction as { confirmed?: boolean; count?: number };
        setConfirmed(Boolean(result.confirmed));
        setConfirmationCount(Number(result.count ?? 0));
      }
      const { data: comments, error: commentsError } = await supabase.rpc("list_public_report_comments", {
        p_report_id: report.id!,
      });
      if (commentsError) throw commentsError;
      if (!cancelled) setPublicComments((comments ?? []) as { id: string; display_name: string | null; body: string; created_at: string }[]);
    })().catch(() => {
      if (!cancelled) setInteractionMessage("Les interactions sont temporairement indisponibles.");
    });
    return () => { cancelled = true; };
  }, [report.id, visitorToken]);

  const toggleConfirmation = async () => {
    if (!supabase || !report.id || !visitorToken) {
      setInteractionMessage("Impossible de créer votre identifiant citoyen. Rechargez la page puis réessayez.");
      return;
    }
    setInteractionBusy(true);
    setInteractionMessage("");
    try {
      const { data, error } = await supabase.rpc("toggle_public_report_confirmation", {
        p_report_id: report.id!,
        p_visitor_token: visitorToken,
      });
      if (error) throw error;
      const result = data as { confirmed?: boolean; count?: number } | null;
      if (!result || typeof result.confirmed !== "boolean" || typeof result.count !== "number") {
        throw new Error("Réponse de confirmation invalide.");
      }
      setConfirmed(result.confirmed);
      setConfirmationCount(result.count);
    } catch (cause) {
      console.error("[PCS] Confirmation du signalement impossible", cause);
      setInteractionMessage("Impossible d’enregistrer votre confirmation. Vérifiez votre connexion puis réessayez.");
    } finally {
      setInteractionBusy(false);
    }
  };

  const submitPublicComment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || !report.id || !visitorToken) {
      setInteractionMessage("Impossible de créer votre identifiant citoyen. Rechargez la page puis réessayez.");
      return;
    }
    const body = commentText.trim();
    if (body.length < 2 || body.length > 1000) {
      setInteractionMessage("Le commentaire doit contenir entre 2 et 1 000 caractères.");
      return;
    }
    setInteractionBusy(true);
    setInteractionMessage("");
    try {
      const { error } = await supabase.rpc("submit_public_report_comment", {
        p_report_id: report.id!,
        p_body: body,
        p_display_name: null as unknown as string,
        p_visitor_token: visitorToken,
      });
      if (error) throw error;
      setCommentText("");
      const { data, error: commentsError } = await supabase.rpc("list_public_report_comments", {
        p_report_id: report.id!,
      });
      if (commentsError) throw commentsError;
      setPublicComments((data ?? []) as { id: string; display_name: string | null; body: string; created_at: string }[]);
      setCommentsOpen(true);
      setInteractionMessage("Votre commentaire a été publié.");
    } catch {
      setInteractionMessage("Impossible de publier le commentaire. Réessayez.");
    } finally {
      setInteractionBusy(false);
    }
  };

  return (
    <article ref={slideRef} className="citizenSlide citizenSlideTrack">
      <div className="slideContent">
        {mediaReady && media.length > 0 ? (
          <MediaCarousel media={media} />
        ) : mediaReady ? null : (
          <div className="mediaCarousel mediaCarouselPlaceholder" aria-hidden="true">
            <div className="mediaCarouselItem" />
          </div>
        )}

        <div className="slideOverlay">
          <p className="eyebrow feedEyebrow">
            {report.status ? statusLabels[report.status] : "Signalement"}
          </p>

          <div className="row">
            <strong>{report.reference_code ?? "PCS"}</strong>
            <span className="badge" data-pcs-tour="status">
              {report.priority ?? "normal"}
            </span>
          </div>

          <h2>{report.title}</h2>

          {report.location_label && (
            <p>
              <strong>📍</strong> {report.location_label}
            </p>
          )}

          {report.resolution_note && (
            <p>
              <strong>Résolution :</strong> {report.resolution_note}
            </p>
          )}

          <div className="citizenReportInteractions" aria-label="Interactions citoyennes">
            <div className="feedActions">
              <button type="button" className={confirmed ? "feedPrimary" : "feedSecondary"} onClick={toggleConfirmation} disabled={interactionBusy}>
                {confirmed ? "✓ Confirmé" : "Je confirme"}
              </button>
              <button type="button" className="feedSecondary" onClick={() => setCommentsOpen((open) => !open)} aria-expanded={commentsOpen}>
                Commenter ({publicComments.length})
              </button>
              <button type="button" className="feedSecondary" onClick={() => void sharePublicReport(report, setInteractionMessage)} aria-label={`Partager le signalement ${report.reference_code ?? ""}`}>
                ↗ Partager
              </button>
            </div>
            {commentsOpen && (
              <section className="citizenPublicComments" aria-label="Commentaires du signalement">
                <div className="citizenCommentsHeader">
                  <h3>Commentaires ({publicComments.length})</h3>
                  <button
                    type="button"
                    className="feedSecondary"
                    onClick={() => {
                      setCommentsOpen(false);
                      setInteractionMessage("");
                    }}
                    aria-label="Fermer les commentaires"
                  >
                    Fermer ✕
                  </button>
                </div>
                {publicComments.length === 0 ? <p>Aucun commentaire public pour le moment.</p> : publicComments.map((comment) => (
                  <article key={comment.id} className="citizenPublicComment">
                    {comment.display_name && <strong>{comment.display_name}</strong>}
                    <p>{comment.body}</p>
                    <small>{new Date(comment.created_at).toLocaleString("fr-FR")}</small>
                  </article>
                ))}
                <form onSubmit={submitPublicComment}>
                  <label htmlFor={`public-comment-${report.id}`}>Votre commentaire</label>
                  <textarea
                    id={`public-comment-${report.id}`}
                    value={commentText}
                    onChange={(event) => setCommentText(event.target.value)}
                    minLength={2}
                    maxLength={1000}
                    rows={3}
                    placeholder="Partagez une information utile…"
                    required
                  />
                  <button type="submit" className="feedPrimary" disabled={interactionBusy || commentText.trim().length < 2}>
                    {interactionBusy ? "Envoi…" : "Publier le commentaire"}
                  </button>
                </form>
              </section>
            )}
            {interactionMessage && <p role="status" aria-live="polite">{interactionMessage}</p>}
          </div>
        </div>
      </div>
    </article>
  );
}
