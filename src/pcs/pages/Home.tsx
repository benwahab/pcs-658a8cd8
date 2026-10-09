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
import { AlertCircle, CheckCircle2, Flag, Home as HomeIcon, MessageCircle, Share2 } from "lucide-react";

async function sharePublicReport(report: PublicReport, onFallbackMessage: (message: string) => void): Promise<boolean> {
  if (!report.id) return false;
  const url = new URL(`/signalement/${encodeURIComponent(report.id)}`, window.location.origin).toString();
  const shareData = { title: report.title ? `${report.title} — PCS` : "Signalement citoyen — PCS", text: "Consultez ce signalement citoyen sur PCS.", url };
  try {
    if (typeof navigator.share === "function" && (!navigator.canShare || navigator.canShare(shareData))) { await navigator.share(shareData); return true; }
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(url); onFallbackMessage("Lien du signalement copié."); return true; }
  } catch (error) { if (error instanceof DOMException && error.name === "AbortError") return false; }
  onFallbackMessage(`Lien du signalement : ${url}`);
  return false;
}

export default function Home() {
  const [reports, setReports] = useState<PublicReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [headerHidden, setHeaderHidden] = useState(false);
  const [headerScrolled, setHeaderScrolled] = useState(false);
  const [introFirstVisit, setIntroFirstVisit] = useState(false);
  const [showSwipeHint, setShowSwipeHint] = useState(false);

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

    const mobileHint = window.matchMedia("(max-width: 700px), (pointer: coarse)");
    let swipeHintTimer: number | undefined;
    let swipeHintHideTimer: number | undefined;

    const showMobileSwipeHint = () => {
      if (!mobileHint.matches) return;
      setShowSwipeHint(true);
      if (swipeHintHideTimer !== undefined) window.clearTimeout(swipeHintHideTimer);
      swipeHintHideTimer = window.setTimeout(() => setShowSwipeHint(false), 9000);
    };

    const resetHomePosition = () => {
      setHeaderHidden(false);
      setHeaderScrolled(false);
      setShowSwipeHint(false);
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
        // The feed uses mandatory scroll-snap, which can swallow a small
        // 30px programmatic movement on mobile. Temporarily suspend snapping
        // for the hint so the gesture preview is actually visible.
        const previousSnapType = feed.style.scrollSnapType;
        feed.style.scrollSnapType = "none";
        feed.scrollTo({ top: 30, left: 0, behavior: "smooth" });

        hintReturnTimer = window.setTimeout(() => {
          if (hintCancelled) {
            hinting = false;
            return;
          }

          feed.scrollTo({ top: 0, left: 0, behavior: "smooth" });
          hintResetTimer = window.setTimeout(() => {
            feed.style.scrollSnapType = previousSnapType;
            hinting = false;
            scheduleScrollHint(8000);
          }, 500);
        }, 650);
      }, delay);
    };

    const cancelScrollHint = () => {
      hintCancelled = true;
      setShowSwipeHint(false);
      if (hintStartTimer !== undefined) window.clearTimeout(hintStartTimer);
      if (hintReturnTimer !== undefined) window.clearTimeout(hintReturnTimer);
      if (hintResetTimer !== undefined) window.clearTimeout(hintResetTimer);
      if (hintRepeatTimer !== undefined) window.clearTimeout(hintRepeatTimer);
      if (swipeHintTimer !== undefined) window.clearTimeout(swipeHintTimer);
      if (swipeHintHideTimer !== undefined) window.clearTimeout(swipeHintHideTimer);
      if (hinting) {
        hinting = false;
        feed.style.scrollSnapType = "";
        feed.scrollTo({ top: 0, left: 0, behavior: "auto" });
      }
    };

    if (swipeHintTimer !== undefined) window.clearTimeout(swipeHintTimer);
    swipeHintTimer = window.setTimeout(showMobileSwipeHint, 900);
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

      if (current > 8) setShowSwipeHint(false);
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
    // Do not cancel on touchstart/pointerdown: mobile browsers fire those
    // events simply because the user touches the feed, which prevented the
    // discoverability hint from ever appearing on phones. A real swipe still
    // produces touchmove/scroll and cancels the hint.
    const cancelEvents = ["touchmove", "wheel"] as const;
    cancelEvents.forEach((eventName) => feed.addEventListener(eventName, cancelScrollHint, { passive: true }));
    return () => {
      window.removeEventListener("pcs-home-reset", resetHomePosition);
      feed.removeEventListener("scroll", onScroll);
      cancelEvents.forEach((eventName) => feed.removeEventListener(eventName, cancelScrollHint));
      if (swipeHintTimer !== undefined) window.clearTimeout(swipeHintTimer);
      if (swipeHintHideTimer !== undefined) window.clearTimeout(swipeHintHideTimer);
      cancelScrollHint();
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reportId = params.get("pcsReturnReport");
    if (!reportId || !reports.length) return;
    const scrollToReturnedReport = () => {
      const feed = document.querySelector<HTMLElement>(".citizenFeed");
      const target = feed?.querySelector<HTMLElement>(`[data-report-id="${CSS.escape(reportId)}"]`);
      if (!feed || !target) return false;
      setHeaderHidden(false);
      setHeaderScrolled(true);
      target.scrollIntoView({ block: "start", behavior: "auto" });
      window.history.replaceState(null, "", "/");
      return true;
    };
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      if (scrollToReturnedReport() || attempts >= 20) window.clearInterval(timer);
    }, 100);
    return () => window.clearInterval(timer);
  }, [reports]);

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
          <p className="eyebrow feedEyebrow" style={{ color: "#FFFFFF", WebkitTextFillColor: "#FFFFFF", textShadow: "0 2px 5px rgba(0,0,0,.72)" }}>PLATEFORME CITOYENNE</p>
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
              onClick={() => {
                try { window.sessionStorage.setItem("pcs-report-return-v1", JSON.stringify({ type: "home" })); } catch {}
              }}
            >
              ＋ Signaler un problème
            </Link>
          </div>
        </div>
      </article>

      <div
        className={`citizenSwipeHint${showSwipeHint ? " isVisible" : ""}`}
        aria-hidden="true"
      >
        <span className="citizenSwipeHintIcon">
          <span className="citizenSwipeHintDot" />
          <span className="citizenSwipeHintArrow">↑</span>
        </span>
        <span>Faites glisser vers le haut</span>
      </div>

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
  const [confirmationPulse, setConfirmationPulse] = useState(false);
  const [shareCount, setShareCount] = useState(0);
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

    // Observe against the actual citizen feed scroll container. This is
    // important on mobile/PWA where the feed can scroll inside the app shell
    // instead of the browser viewport.
    const feedRoot = slide.closest<HTMLElement>(".citizenFeed");
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setMediaReady(true);
          observer.disconnect();
        }
      },
      { root: feedRoot ?? null, rootMargin: "700px 0px", threshold: 0 },
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
    try {
      const storedShareCount = Number(window.localStorage.getItem(`pcs-share-count:${report.id}`) ?? "0");
      if (Number.isFinite(storedShareCount) && storedShareCount >= 0) setShareCount(storedShareCount);
    } catch {
      // Local storage can be unavailable in restricted browsers; keep the counter at zero.
    }
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
    if (!interactionMessage) return;
    const timer = window.setTimeout(() => setInteractionMessage(""), 4200);
    return () => window.clearTimeout(timer);
  }, [interactionMessage]);

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
      setInteractionMessage(result.confirmed ? "Confirmation enregistrée." : "Confirmation retirée.");
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
    <article ref={slideRef} className="citizenSlide citizenSlideTrack" data-report-id={report.id}>
      <div className="slideContent">
        {mediaReady && media.length > 0 && (
          <MediaCarousel media={media} />
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
              <button
                type="button"
                className={[
                  confirmed ? "feedPrimary" : "feedSecondary",
                  "feedConfirmButton",
                  confirmationPulse ? "isPulsing" : "",
                ].filter(Boolean).join(" ")}
                onPointerDown={() => setConfirmationPulse(true)}
                onClick={toggleConfirmation}
                disabled={interactionBusy}
                aria-pressed={confirmed}
                aria-label={confirmed ? "Retirer ma confirmation" : "Confirmer ce signalement"}
              >
                <span className="feedConfirmIcon" aria-hidden="true">👍</span>
                <small>{confirmationCount}</small>
              </button>
              <button
                type="button"
                className="feedSecondary"
                onClick={() => setCommentsOpen((open) => !open)}
                aria-expanded={commentsOpen}
                aria-label="Afficher les commentaires"
              >
                <MessageCircle aria-hidden="true" strokeWidth={2.2} />
                <small>{publicComments.length}</small>
              </button>
              <button
                type="button"
                className="feedSecondary"
                onClick={async () => {
                  const shared = await sharePublicReport(report, setInteractionMessage);
                  if (!shared) return;
                  setShareCount((count) => {
                    const next = count + 1;
                    try { window.localStorage.setItem(`pcs-share-count:${report.id}`, String(next)); } catch {}
                    return next;
                  });
                }}
                aria-label={`Partager le signalement ${report.reference_code ?? ""}`}
              >
                <Share2 aria-hidden="true" strokeWidth={2.2} />
                <small>{shareCount}</small>
              </button>
              <Link className="feedSecondary feedRailLink feedRailHome" to="/" aria-label="Accueil" onClick={(event) => {
                // The feed is already on the home route, so navigating to "/"
                // alone does not move the scroll container back to its first slide.
                event.preventDefault();
                const feed = document.querySelector<HTMLElement>(".citizenFeed");
                const intro = feed?.querySelector<HTMLElement>(".citizenSlideIntro");
                // Reset the home feed through its public event; header and hint state
                // belong to Home and are not in scope inside an individual report slide.
                window.dispatchEvent(new Event("pcs-home-reset"));
                setCommentsOpen(false);
                feed?.scrollTo({ top: 0, left: 0, behavior: "auto" });
                document.querySelector<HTMLElement>("main")?.scrollTo({ top: 0, left: 0, behavior: "auto" });
                window.scrollTo({ top: 0, left: 0, behavior: "auto" });
                intro?.scrollIntoView({ block: "start", behavior: "auto" });
                feed?.scrollTo({ top: 0, left: 0, behavior: "auto" });
              }}>
                <HomeIcon aria-hidden="true" strokeWidth={2.2} />
                <small>Accueil</small>
              </Link>
              <Link className="feedPrimary feedRailLink feedRailReport" to="/signaler" aria-label="Signaler un problème" onClick={() => {
                try { window.sessionStorage.setItem("pcs-report-return-v1", JSON.stringify({ type: "report", reportId: report.id })); } catch {}
              }}>
                <Flag aria-hidden="true" strokeWidth={2.2} />
                <small>Signaler</small>
              </Link>
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
                    <div className="citizenCommentAvatar" aria-hidden="true">
                      {(comment.display_name?.trim()?.[0] ?? "C").toUpperCase()}
                    </div>
                    <div className="citizenCommentBody">
                      <div className="citizenCommentMeta">
                        <small>{new Date(comment.created_at).toLocaleString("fr-FR")}</small>
                      </div>
                      <p>{comment.body}</p>
                    </div>
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
            {interactionMessage && (
              <div
                className={`citizenInteractionPopup${/^(Impossible|Les interactions|Activez)/i.test(interactionMessage) ? " isError" : ""}`}
                role="status"
                aria-live="polite"
              >
                <span className="citizenInteractionPopupIcon" aria-hidden="true">
                  {/^(Impossible|Les interactions|Activez)/i.test(interactionMessage)
                    ? <AlertCircle strokeWidth={2.4} />
                    : <CheckCircle2 strokeWidth={2.4} />}
                </span>
                <span className="citizenInteractionPopupText">{interactionMessage}</span>
                <button
                  type="button"
                  className="citizenInteractionPopupClose"
                  onClick={() => setInteractionMessage("")}
                  aria-label="Fermer le message"
                >
                  ×
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
