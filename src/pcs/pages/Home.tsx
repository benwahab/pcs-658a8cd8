import { useEffect, useRef, useState } from "react";
import { Link } from "@/pcs/router";
import { supabase } from "../lib/supabase";
import { listPublicReports } from "../lib/reports";
import type { PublicReport } from "../types";
import { statusLabels } from "../types";
import { createReportMediaUrl } from "../services/media";
import BrandLogo from "../components/BrandLogo";
import { MediaCarousel } from "../components/MediaCarousel";

export default function Home() {
  const [reports, setReports] = useState<PublicReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [headerHidden, setHeaderHidden] = useState(false);
  const [headerScrolled, setHeaderScrolled] = useState(false);

  useEffect(() => {
    let active = true;
    const refreshReports = async () => {
      try {
        const nextReports = await listPublicReports();
        if (active) {
          setReports(nextReports);
          setError("");
        }
      } catch (error) {
        if (active) setError(error instanceof Error ? error.message : "Impossible de charger les signalements publics.");
      } finally {
        if (active) setLoading(false);
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refreshReports();
    };
    void refreshReports();
    const timer = window.setInterval(() => void refreshReports(), 30000);
    window.addEventListener("focus", refreshReports);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshReports);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    const feed = document.querySelector(".citizenFeed");
    if (!feed) return;

    let lastScrollTop = feed.scrollTop;

    const onScroll = () => {
      const current = Math.max(0, feed.scrollTop);
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
    return () => feed.removeEventListener("scroll", onScroll);
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
          onClick={() => {
            const feed = document.querySelector(".citizenFeed");
            feed?.scrollTo({ top: 0, behavior: "smooth" });
            setHeaderHidden(false);
            setHeaderScrolled(false);
          }}
        >
          <BrandLogo className="feedBrandLogo" />
        </Link>

        <div className="feedTabs">
          <span className="active">Tous les signalements</span>
        </div>

        <details className="feedAccess" data-pcs-tour="professional-access">
          <summary>
            <span className="feedAccessIcon">◈</span>
            <span>Espace professionnel</span>
            <span className="feedAccessChevron">▾</span>
          </summary>
          <div>
            <Link to="/cst">🖥️ CST — Supervision technique</Link>
            <Link to="/connexion-operationnelle">🏛️ Mairie</Link>
            <Link to="/connexion-operationnelle?mode=agent">
              👷 Agent terrain
            </Link>
            <Link to="/connexion-operationnelle?mode=moderator">
              🛡️ Modérateur
            </Link>
            <Link to="/connexion-nigelec">⚡ NIGELEC</Link>
            <Link to="/connexion-nde">💧 NDE</Link>
          </div>
        </details>
      </div>

      <article className="citizenSlide citizenSlideIntro">
        <div className="slideShade" />
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
  const slideRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!mediaReady) return;
    const refresh = () => setMediaRefresh((value) => value + 1);
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
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
          .select("id,storage_path,media_role,media_type")
          .eq("report_id", reportId)
          .order("created_at", { ascending: true });

        if (error) throw error;

        const urls = await Promise.all(
          (data ?? [])
            .filter((item) => item.id && item.storage_path)
            .map(async (item) => ({
              id: item.id as string,
              url: await createReportMediaUrl(item.storage_path as string),
              media_role: item.media_role ?? "evidence",
              media_type: item.media_type ?? "image",
            })),
        );

        if (!cancelled) {
          setMedia(urls.sort((a, b) => Number(b.media_type.startsWith("video")) - Number(a.media_type.startsWith("video"))));
        }
      } catch {
        if (!cancelled) setMedia([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mediaReady, mediaRefresh, report.id]);

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
        </div>
      </div>
    </article>
  );
}
