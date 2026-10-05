import { useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Link, useLocation, useNavigate } from "@/pcs/router";
import { supabase, isSupabaseConfigured } from "./lib/supabase";
import OnboardingTour from "./components/OnboardingTour";
import PwaInstallPrompt from "./components/PwaInstallPrompt";
import BrandLogo from "./components/BrandLogo";


export function Shell({ children }: { children: ReactNode }) {
  const [email, setEmail] = useState<string | null>(null);
  const [feedHeaderHidden, setFeedHeaderHidden] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const isMairie = location.pathname === "/mairie";

  useEffect(() => {
    if (location.pathname !== "/") {
      setFeedHeaderHidden(false);
      return;
    }

    // The feed may scroll in its own container on mobile. Listen in capture
    // phase so the navbar responds even when the scroll event does not bubble.
    let lastScrollTop = 0;
    let activeScrollTarget: HTMLElement | null = null;

    const getScrollTop = (target?: EventTarget | null) => {
      const element = target instanceof HTMLElement ? target : null;
      const feed = document.querySelector<HTMLElement>(".citizenFeed");
      const main = document.querySelector<HTMLElement>("main");
      return Math.max(
        0,
        element?.scrollTop ?? 0,
        feed?.scrollTop ?? 0,
        main?.scrollTop ?? 0,
        window.scrollY,
        document.documentElement.scrollTop,
      );
    };

    const onAnyScroll = (event: Event) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const current = getScrollTop(target);
      // Prefer the actual scrolling element when multiple containers exist.
      if (target && target.scrollHeight > target.clientHeight + 2) {
        activeScrollTarget = target;
      }
      const position = activeScrollTarget?.scrollTop ?? current;
      if (position <= 8 && current <= 8) {
        setFeedHeaderHidden(false);
      } else if (position > lastScrollTop + 3 || current > lastScrollTop + 3) {
        setFeedHeaderHidden(true);
      } else if (position < lastScrollTop - 3 || current < lastScrollTop - 3) {
        setFeedHeaderHidden(false);
      }
      lastScrollTop = Math.max(position, current);
    };

    // Initialize after the first layout, including cases where the feed mounts late.
    const initialize = () => {
      activeScrollTarget = document.querySelector<HTMLElement>(".citizenFeed");
      lastScrollTop = getScrollTop(activeScrollTarget);
      setFeedHeaderHidden(lastScrollTop > 8);
    };
    const frame = requestAnimationFrame(initialize);
    document.addEventListener("scroll", onAnyScroll, { passive: true, capture: true });
    window.addEventListener("scroll", onAnyScroll, { passive: true });

    // If the feed is rendered after this effect, capture it without requiring a reload.
    const observer = new MutationObserver(() => {
      if (!activeScrollTarget) {
        activeScrollTarget = document.querySelector<HTMLElement>(".citizenFeed");
        if (activeScrollTarget) lastScrollTop = activeScrollTarget.scrollTop;
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("scroll", onAnyScroll, true);
      window.removeEventListener("scroll", onAnyScroll);
      observer.disconnect();
    };
  }, [location.pathname]);

  useEffect(() => {
    if (!supabase) return;

    supabase.auth
      .getUser()
      .then(({ data }) => setEmail(data.user?.email ?? null));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setEmail(session?.user?.email ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  function closeProfessionalMenu() {
    document.querySelectorAll<HTMLDetailsElement>("details.feedAccessHeader, details.feedAccessSubmenu").forEach((menu) => {
      menu.open = false;
    });
  }

  async function logout() {
    await supabase?.auth.signOut();
    setEmail(null);
    navigate("/");
  }

  if (isMairie) {
    return <div className="app mairieApp">{children}</div>;
  }

  return (
    <div className="app">
      <header className={"feedImmersiveHeader" + (feedHeaderHidden ? " is-hidden" : "")}>
        <Link className="brand" to="/">
          <BrandLogo className="brandLogo" />
        </Link>

        <nav data-pcs-tour="app-nav">
          <Link
            to="/"
            onClick={(event) => {
              if (location.pathname === "/") {
                event.preventDefault();
                window.dispatchEvent(new Event("pcs-home-reset"));
              }
            }}
          >
            Accueil
          </Link>
        </nav>

        <details className="feedAccess feedAccessHeader" data-pcs-tour="professional-access">
          <summary>
            <span className="feedAccessIcon">◈</span>
            <span>Espace professionnel</span>
            <span className="feedAccessChevron">▾</span>
          </summary>
          <div>
            <Link to="/cst" onClick={closeProfessionalMenu}>🖥️ CST — Supervision technique</Link>
            <Link to="/connexion-operationnelle" onClick={closeProfessionalMenu}>🏛️ Mairie</Link>
            <Link to="/connexion-operationnelle?mode=agent" onClick={closeProfessionalMenu}>👷 Agent terrain</Link>
            <Link to="/connexion-operationnelle?mode=moderator" onClick={closeProfessionalMenu}>🛡️ Modérateur</Link>
            <details className="feedAccessSubmenu">
              <summary>⚡ NIGELEC <span aria-hidden="true">▸</span></summary>
              <div>
                <Link to="/connexion-nigelec?type=central" onClick={closeProfessionalMenu}>Accès au compte central</Link>
                <Link to="/connexion-nigelec?type=agency" onClick={closeProfessionalMenu}>Accès aux comptes agences</Link>
              </div>
            </details>
            <details className="feedAccessSubmenu">
              <summary>💧 NDE <span aria-hidden="true">▸</span></summary>
              <div>
                <Link to="/connexion-nde?type=central" onClick={closeProfessionalMenu}>Accès au compte central</Link>
                <Link to="/connexion-nde?type=agency" onClick={closeProfessionalMenu}>Accès aux comptes agences</Link>
              </div>
            </details>
          </div>
        </details>

        <span className="session" data-pcs-tour="account">
          {email ? (
            <>
              <span>{email}</span>
              <button className="button" onClick={logout}>
                Déconnexion
              </button>
            </>
          ) : (
            "Visiteur"
          )}
        </span>
      </header>

      <main>{children}</main>

      <footer className="appFooter">PCS — Plateforme de Citoyenneté et de Signalement</footer>
    </div>
  );
}

function ConnectionStatus() {
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [weak, setWeak] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const update = () => setOnline(navigator.onLine);

    const updateConnection = () => {
      const connection = (
        navigator as Navigator & {
          connection?: {
            effectiveType?: string;
            downlink?: number;
          };
        }
      ).connection;

      const type = connection?.effectiveType;

      setWeak(
        type === "slow-2g" ||
          type === "2g" ||
          (connection?.downlink != null && connection.downlink < 0.7),
      );
    };

    updateConnection();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);

    const connection = (
      navigator as Navigator & { connection?: EventTarget }
    ).connection;

    connection?.addEventListener("change", updateConnection);

    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      connection?.removeEventListener("change", updateConnection);
    };
  }, []);

  // Keep monitoring connection state internally, but never display a connection banner.
  return null;
}

function App({ children }: { children: ReactNode }) {
  const [showSplash, setShowSplash] = useState(true);
  const [isConnecting, setIsConnecting] = useState(() => typeof navigator !== "undefined" && !navigator.onLine);
  const logoStyle = {
    "--pcs-logo-url": 'url("/assets/pcs-logo.jpg")',
  } as CSSProperties;

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Keep the locally bundled logo visible until the PCS origin is reachable.
    // Only begin the 5-second minimum display period after a successful probe.
    let active = true;
    let retryTimer: number | undefined;
    let hideTimer: number | undefined;
    let controller: AbortController | undefined;

    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        retryTimer = window.setTimeout(resolve, ms);
      });

    const checkConnection = async () => {
      while (active) {
        controller = new AbortController();
        const requestTimeout = window.setTimeout(() => controller?.abort(), 3000);

        try {
          const response = await fetch(
            `/manifest.webmanifest?pcs-connectivity-check=${Date.now()}`,
            { cache: "no-store", signal: controller.signal },
          );

          if (response.ok) {
            window.clearTimeout(requestTimeout);
            if (!active) return;
            setIsConnecting(false);
            hideTimer = window.setTimeout(() => {
              if (active) setShowSplash(false);
            }, 5000);
            return;
          }
          if (active) setIsConnecting(true);
        } catch {
          // Show the spinner only after the connectivity probe fails.
          if (active) setIsConnecting(true);
        } finally {
          window.clearTimeout(requestTimeout);
        }

        if (active) await wait(3000);
      }
    };

    void checkConnection();

    return () => {
      active = false;
      controller?.abort();
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      if (hideTimer !== undefined) window.clearTimeout(hideTimer);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const endpoint = `${import.meta.env.VITE_SUPABASE_URL || ""}/functions/v1/cst-telemetry`;
    if (!endpoint.startsWith("http")) return;

    const send = (
      eventType: string,
      message: string,
      metadata: Record<string, unknown> = {},
    ) => {
      void fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          frontend_events: [
            {
              event_type: eventType,
              message,
              page: window.location.pathname,
              browser: navigator.userAgent.slice(0, 120),
              device: window.innerWidth < 760 ? "mobile" : "desktop",
              occurred_at: Date.now(),
              metadata,
            },
          ],
        }),
        keepalive: true,
      }).catch(() => undefined);
    };

    const onError = (event: ErrorEvent) =>
      send("javascript_error", event.message || "Erreur JavaScript", {
        filename: event.filename?.slice(0, 200),
        line: event.lineno,
        column: event.colno,
      });

    const onRejection = (event: PromiseRejectionEvent) =>
      send(
        "unhandled_rejection",
        event.reason instanceof Error
          ? event.reason.message
          : String(event.reason).slice(0, 500),
      );

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return (
    <div style={logoStyle}>
      <Shell>
        {children}
        <OnboardingTour />
        <PwaInstallPrompt />
        <ConnectionStatus />
        {!isSupabaseConfigured && (
          <div className="dev-banner">
            Configuration requise : renseignez les variables VITE_SUPABASE_*
            avant déploiement.
          </div>
        )}
      </Shell>
      {showSplash && (
        <>
          <style>{`
            @keyframes pcsSplashLogoIn {
              from { opacity: 0; transform: scale(.96); }
              to { opacity: 1; transform: scale(1); }
            }
            @keyframes pcsSplashSpinner {
              to { transform: rotate(360deg); }
            }
            .pcsSplash {
              position: fixed;
              inset: 0;
              z-index: 99999;
              display: grid;
              place-items: center;
              background: #fff;
            }
            .pcsSplashContent {
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 28px;
            }
            .pcsSplash img {
              display: block;
              width: min(68vw, 300px);
              max-height: 42vh;
              object-fit: contain;
              opacity: 1;
              transform: none;
            }
            .pcsSplashSpinner {
              width: 34px;
              height: 34px;
              box-sizing: border-box;
              border: 3px solid #e9e5f2;
              border-top-color: #4e3a7f;
              border-right-color: #7964ad;
              border-radius: 50%;
              animation: pcsSplashSpinner .85s linear infinite;
            }
            @media (prefers-reduced-motion: reduce) {
              .pcsSplash img, .pcsSplashSpinner { animation: none; }
            }
          `}</style>
          <div className="pcsSplash" role="status" aria-label={isConnecting ? "Recherche de connexion" : "Chargement de PCS"}>
            <div className="pcsSplashContent">
              <img src="/icons/icon-512.svg" alt="PCS — Plateforme de Citoyenneté et de Signalement" />
              {isConnecting && <div className="pcsSplashSpinner" aria-hidden="true" />}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default App;
