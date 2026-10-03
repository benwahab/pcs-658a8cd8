import { useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Link, useLocation, useNavigate } from "@/pcs/router";
import { supabase, isSupabaseConfigured } from "./lib/supabase";
import OnboardingTour from "./components/OnboardingTour";
import BrandLogo from "./components/BrandLogo";
import { url as pcsLogoUrl } from "@/assets/pcs-logo.png.asset.json";

export function Shell({ children }: { children: ReactNode }) {
  const [email, setEmail] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const isMairie = location.pathname === "/mairie";

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
      <header>
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

  if (online && !weak) return null;

  return (
    <div
      className={`connectionStatus ${!online ? "offline" : "weak"}`}
      role="status"
      aria-live="polite"
    >
      {!online
        ? "Hors connexion — les pages déjà chargées restent disponibles."
        : "Connexion faible — PCS privilégie les données déjà en cache et réessaie automatiquement les lectures."}
    </div>
  );
}

function App({ children }: { children: ReactNode }) {
  const [showSplash, setShowSplash] = useState(true);
  const logoStyle = {
    "--pcs-logo-url": `url("${pcsLogoUrl}")`,
  } as CSSProperties;

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Brief startup screen only for the initial app mount; internal route
    // changes do not remount App. Always remove it after a short timeout.
    const timeout = window.setTimeout(
      () => setShowSplash(false),
      5000,
    );

    return () => window.clearTimeout(timeout);
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
            @keyframes pcsSplashFadeOut {
              from { opacity: 1; }
              to { opacity: 0; visibility: hidden; }
            }
            @keyframes pcsSplashLogoIn {
              from { opacity: 0; transform: scale(.96); }
              to { opacity: 1; transform: scale(1); }
            }
            .pcsSplash {
              position: fixed;
              inset: 0;
              z-index: 99999;
              display: grid;
              place-items: center;
              background: #fff;
              animation: pcsSplashFadeOut .28s ease-out 4.72s forwards;
            }
            .pcsSplash img {
              display: block;
              width: min(68vw, 300px);
              max-height: 42vh;
              object-fit: contain;
              animation: pcsSplashLogoIn .45s ease-out both;
            }
            @media (prefers-reduced-motion: reduce) {
              .pcsSplash, .pcsSplash img { animation: none; }
            }
          `}</style>
          <div className="pcsSplash" role="status" aria-label="Chargement de PCS">
            <img src={pcsLogoUrl} alt="PCS — Plateforme de Citoyenneté et de Signalement" />
          </div>
        </>
      )}
    </div>
  );
}

export default App;
