import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "@/pcs/router";
import { supabase, isSupabaseConfigured } from "./lib/supabase";
import OnboardingTour from "./components/OnboardingTour";
import PwaInstallPrompt from "./components/PwaInstallPrompt";
import BrandLogo from "./components/BrandLogo";


export function Shell({ children }: { children: ReactNode }) {
  const [email, setEmail] = useState<string | null>(null);
  // Professional access: collapsed by default and auto-collapses 5 seconds after opening.
  const professionalMenuTimer = useRef<number | undefined>(undefined);
  const navigate = useNavigate();
  const location = useLocation();
  const isMairie = location.pathname === "/mairie";
  // Keep the global PCS header on the CST login/recovery screen; hide it only inside the authenticated CST workspace.
  const isCstDashboard = location.pathname.startsWith("/cst/");
  const isAgentLogin =
    location.pathname === "/connexion-operationnelle" &&
    new URLSearchParams(location.search).get("mode") === "agent";
  const isPhoneClient =
    typeof navigator !== "undefined" &&
    (((navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData?.mobile === true) ||
      /Android.*Mobile|iPhone|iPod/i.test(navigator.userAgent));

  // Keep the professional menu collapsed consistently whenever the user changes page.
  useEffect(() => {
    if (professionalMenuTimer.current !== undefined) {
      window.clearTimeout(professionalMenuTimer.current);
      professionalMenuTimer.current = undefined;
    }
    document.querySelectorAll<HTMLDetailsElement>("details.feedAccessHeader, details.feedAccessSubmenu").forEach((menu) => {
      menu.open = false;
    });
  }, [location.pathname]);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let active = true;

    // Resolve the existing session before deciding whether professional access
    // should be visible, avoiding a brief flash on refresh.
    supabase.auth
      .getUser()
      .then(({ data, error }) => {
        if (!active) return;
        setEmail(error ? null : data.user?.email ?? null);
      })
      .catch(() => {
        if (!active) return;
        setEmail(null);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setEmail(session?.user?.email ?? null);
      setAuthChecked(true);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  function closeProfessionalMenu() {
    if (professionalMenuTimer.current !== undefined) {
      window.clearTimeout(professionalMenuTimer.current);
      professionalMenuTimer.current = undefined;
    }
    document.querySelectorAll<HTMLDetailsElement>("details.feedAccessHeader, details.feedAccessSubmenu").forEach((menu) => {
      menu.open = false;
    });
  }

  function refreshProfessionalMenuTimer() {
    if (professionalMenuTimer.current !== undefined) {
      window.clearTimeout(professionalMenuTimer.current);
      professionalMenuTimer.current = undefined;
    }

    const menu = document.querySelector<HTMLDetailsElement>("details.feedAccessHeader");
    if (!menu?.open) return;

    professionalMenuTimer.current = window.setTimeout(() => {
      menu.open = false;
      professionalMenuTimer.current = undefined;
    }, 5000);
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
      {!isCstDashboard && <header className="feedImmersiveHeader">
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

        {<details
          className={"feedAccess feedAccessHeader" + (location.pathname === "/signaler" || location.pathname === "/" || isAgentLogin ? " feedAccessHeaderCompact" : "") + (isAgentLogin ? " feedAccessHeaderHomeCompact" : "")}
          data-pcs-tour="professional-access"
          onToggle={(event) => {
            const menu = event.currentTarget;
            if (professionalMenuTimer.current !== undefined) {
              window.clearTimeout(professionalMenuTimer.current);
              professionalMenuTimer.current = undefined;
            }
            if (menu.open) {
              refreshProfessionalMenuTimer();
            }
          }}
          onPointerDown={(event) => {
            if (event.currentTarget.open) refreshProfessionalMenuTimer();
          }}
          onInput={refreshProfessionalMenuTimer}
          onChange={refreshProfessionalMenuTimer}
        >
          <summary aria-label="Espace professionnel" title={location.pathname === "/" ? undefined : "Espace professionnel"}>
            <span className="feedAccessIcon">◈</span>
            {location.pathname !== "/" && (
              <>
                <span className="feedAccessLabel">Espace professionnel</span>
                <span className="feedAccessChevron">▾</span>
              </>
            )}
          </summary>
          <div onPointerDown={refreshProfessionalMenuTimer} onInput={refreshProfessionalMenuTimer} onChange={refreshProfessionalMenuTimer}>
            {location.pathname === "/" || isPhoneClient ? (
              <Link to="/connexion-operationnelle?mode=agent" onClick={closeProfessionalMenu}>👷 Agent terrain</Link>
            ) : (
              <>
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
              </>
            )}
          </div>
        </details>}

        {email && (
          <span className="session" data-pcs-tour="account">
            <span>{email}</span>
            <button className="button" onClick={logout}>
              Déconnexion
            </button>
          </span>
        )}
      </header>}

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
  const isInstalledPwa =
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches ||
      ("standalone" in navigator &&
        (navigator as Navigator & { standalone?: boolean }).standalone === true));

  // Browser: keep the branded PCS splash.
  // Installed PWA: let Android's native launch splash be the only splash.
  const [showSplash, setShowSplash] = useState(!isInstalledPwa);
  const [isConnecting, setIsConnecting] = useState(() => typeof navigator !== "undefined" && !navigator.onLine);

  useEffect(() => {
    if (typeof window === "undefined" || window.location.pathname !== "/") return;
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches ||
      ("standalone" in navigator &&
        (navigator as Navigator & { standalone?: boolean }).standalone === true);
    if (!standalone) return;

    const rawPending = window.localStorage.getItem("pcs-pending-deeplink-v1");
    if (!rawPending) return;

    try {
      const pending = JSON.parse(rawPending) as { path?: string; createdAt?: number };
      const isFresh =
        typeof pending.path === "string" &&
        /^\/signalement\/[^/]+$/.test(pending.path) &&
        typeof pending.createdAt === "number" &&
        Date.now() - pending.createdAt <= 86400000;

      window.localStorage.removeItem("pcs-pending-deeplink-v1");
      if (isFresh) window.location.replace(pending.path!);
    } catch {
      window.localStorage.removeItem("pcs-pending-deeplink-v1");
    }
  }, []);
  useEffect(() => {
    if (typeof window === "undefined" || isInstalledPwa) return;

    // Browser only: keep the branded PCS splash for 5 seconds.
    // Installed PWA skips this layer so Android's native launch splash is not followed by a second splash.
    let active = true;
    let retryTimer: number | undefined;
    let hideTimer: number | undefined;
    let fallbackTimer: number | undefined;
    let controller: AbortController | undefined;

    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        retryTimer = window.setTimeout(resolve, ms);
      });

    // Never let a connectivity probe keep the full-screen splash over the app forever.
    // If the server is unreachable, release the UI after a short grace period and let
    // the app display its own offline/error states.
    fallbackTimer = window.setTimeout(() => {
      if (!active) return;
      setShowSplash(false);
      document.documentElement.dataset.pcsSplashReady = "true";
      window.dispatchEvent(new Event("pcs-splash-completed"));
    }, 8000);

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
            if (fallbackTimer !== undefined) {
              window.clearTimeout(fallbackTimer);
              fallbackTimer = undefined;
            }
            hideTimer = window.setTimeout(() => {
              if (active) {
                setShowSplash(false);
                document.documentElement.dataset.pcsSplashReady = "true";
                window.dispatchEvent(new Event("pcs-splash-completed"));
              }
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
      if (fallbackTimer !== undefined) window.clearTimeout(fallbackTimer);
    };
  }, [isInstalledPwa]);

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
    <>
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
            @keyframes pcsSplashSpinner {
              to { transform: rotate(360deg); }
            }
            .pcsSplash {
              position: fixed;
              inset: 0;
              z-index: 99999;
              display: grid;
              place-items: center;
              /* PCS — écran de lancement : violet officiel uniforme. */
              background:#160029;
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
            }
            .pcsSplashSpinner {
              width: 34px;
              height: 34px;
              box-sizing: border-box;
              border: 3px solid rgba(255,255,255,.22);
              border-top-color: #ffffff;
              border-right-color: #d8c8ff;
              border-radius: 50%;
              animation: pcsSplashSpinner .85s linear infinite;
            }
            @media (prefers-reduced-motion: reduce) {
              .pcsSplash img, .pcsSplashSpinner { animation: none; }
            }
          `}</style>
          <div className="pcsSplash" role="status" aria-label={isConnecting ? "Recherche de connexion" : "Chargement de PCS"}>
            <div className="pcsSplashContent">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1536 1536" role="img" aria-label="PCS" style={{display:"block",width:"min(68vw, 300px)",maxHeight:"42vh",objectFit:"contain"}}><rect width="1536" height="1536" fill="#160029"/><g transform="translate(96 408)"><path fill="#FFFFFF" fill-rule="evenodd" d="M 1253 38 L 1251 38 L 1244 34 L 1241 34 L 1236 31 L 1232 31 L 1225 28 L 1215 27 L 1209 25 L 1203 25 L 1202 24 L 1182 24 L 1181 23 L 1141 25 L 1134 27 L 1122 28 L 1113 31 L 1105 32 L 1101 34 L 1097 34 L 1062 47 L 1042 57 L 1024 68 L 1008 80 L 989 98 L 978 111 L 964 133 L 954 158 L 954 163 L 951 172 L 950 190 L 949 191 L 949 209 L 950 210 L 951 229 L 954 241 L 957 248 L 958 254 L 960 256 L 960 258 L 967 270 L 967 272 L 990 303 L 1014 326 L 1053 357 L 1099 390 L 1122 409 L 1139 426 L 1145 435 L 1152 451 L 1153 463 L 1154 464 L 1154 475 L 1153 476 L 1153 483 L 1149 493 L 1149 496 L 1138 513 L 1127 524 L 1117 531 L 1103 537 L 1098 537 L 1097 538 L 1073 537 L 1059 530 L 1044 516 L 1035 502 L 1030 489 L 1028 487 L 1028 484 L 1025 478 L 1024 471 L 1022 467 L 1021 457 L 1018 445 L 1017 423 L 1016 422 L 1016 401 L 1015 400 L 1016 374 L 994 375 L 969 382 L 946 395 L 925 414 L 920 421 L 918 422 L 908 438 L 908 440 L 901 454 L 896 473 L 895 486 L 894 487 L 894 503 L 895 504 L 895 511 L 897 521 L 902 537 L 909 552 L 911 554 L 911 556 L 914 559 L 917 565 L 934 584 L 944 592 L 963 604 L 978 611 L 1001 618 L 1006 618 L 1017 621 L 1039 622 L 1040 623 L 1071 623 L 1072 622 L 1095 621 L 1106 618 L 1112 618 L 1120 615 L 1125 615 L 1132 612 L 1139 611 L 1142 609 L 1145 609 L 1179 595 L 1191 588 L 1193 588 L 1229 565 L 1252 545 L 1265 531 L 1276 517 L 1288 498 L 1293 486 L 1296 482 L 1303 462 L 1303 457 L 1306 448 L 1306 438 L 1307 437 L 1307 416 L 1306 415 L 1305 400 L 1299 382 L 1292 369 L 1276 349 L 1249 326 L 1226 312 L 1223 309 L 1221 309 L 1202 297 L 1191 292 L 1170 279 L 1168 279 L 1165 276 L 1155 271 L 1132 256 L 1107 232 L 1098 220 L 1092 207 L 1088 191 L 1088 163 L 1092 148 L 1098 137 L 1107 128 L 1123 118 L 1137 114 L 1154 114 L 1155 115 L 1160 115 L 1167 118 L 1178 125 L 1190 137 L 1196 148 L 1197 153 L 1199 156 L 1199 161 L 1202 172 L 1202 208 L 1198 226 L 1199 227 L 1217 227 L 1218 226 L 1235 224 L 1249 220 L 1252 218 L 1257 217 L 1273 208 L 1287 197 L 1300 182 L 1306 172 L 1312 158 L 1316 141 L 1316 118 L 1309 94 L 1299 76 L 1293 68 L 1276 52 Z M 826 28 L 799 21 L 791 21 L 783 19 L 765 19 L 764 18 L 763 19 L 746 19 L 737 21 L 727 21 L 722 23 L 707 25 L 674 35 L 652 44 L 630 55 L 606 70 L 580 90 L 546 124 L 526 150 L 512 173 L 500 196 L 500 198 L 498 200 L 489 221 L 478 254 L 477 262 L 474 270 L 473 280 L 471 285 L 470 298 L 467 312 L 467 325 L 466 326 L 466 335 L 465 336 L 465 357 L 464 358 L 464 378 L 465 379 L 465 396 L 466 397 L 466 406 L 467 407 L 467 418 L 468 419 L 471 442 L 474 451 L 474 456 L 476 460 L 478 471 L 490 505 L 493 509 L 493 511 L 501 527 L 514 548 L 524 561 L 544 582 L 549 585 L 555 591 L 581 607 L 600 615 L 623 621 L 637 622 L 638 623 L 648 623 L 649 624 L 683 623 L 691 621 L 698 621 L 725 614 L 763 597 L 792 578 L 804 568 L 824 548 L 843 524 L 846 518 L 853 509 L 856 502 L 862 493 L 862 491 L 872 471 L 874 463 L 876 460 L 876 457 L 879 451 L 879 447 L 882 441 L 882 437 L 886 424 L 886 419 L 889 408 L 889 400 L 891 393 L 891 386 L 892 385 L 881 380 L 861 409 L 838 437 L 813 462 L 781 486 L 767 494 L 765 494 L 751 501 L 731 506 L 705 507 L 684 501 L 676 497 L 673 494 L 671 494 L 662 487 L 646 470 L 634 452 L 634 450 L 632 448 L 625 432 L 624 426 L 621 421 L 621 417 L 618 410 L 617 401 L 614 392 L 614 384 L 611 371 L 610 343 L 609 342 L 609 310 L 610 309 L 610 299 L 611 298 L 611 286 L 617 254 L 621 242 L 621 238 L 623 235 L 625 226 L 634 203 L 648 176 L 666 152 L 685 135 L 706 125 L 716 124 L 717 123 L 731 123 L 748 128 L 751 131 L 754 132 L 761 140 L 765 148 L 768 160 L 768 170 L 769 171 L 768 173 L 769 175 L 768 176 L 768 193 L 765 206 L 765 213 L 763 217 L 762 226 L 755 250 L 789 247 L 798 244 L 803 244 L 810 241 L 814 241 L 832 234 L 849 225 L 869 210 L 882 196 L 888 187 L 898 167 L 902 155 L 902 150 L 904 143 L 904 120 L 899 96 L 895 86 L 888 74 L 871 54 L 849 38 Z M 353 25 L 347 24 L 341 21 L 337 21 L 330 18 L 320 17 L 314 15 L 308 15 L 307 14 L 291 14 L 290 13 L 249 14 L 248 15 L 240 15 L 239 16 L 219 18 L 209 21 L 203 21 L 199 23 L 176 28 L 173 30 L 156 35 L 151 38 L 148 38 L 107 59 L 93 68 L 68 88 L 47 110 L 38 122 L 27 139 L 27 141 L 25 143 L 14 166 L 14 169 L 11 174 L 10 181 L 7 188 L 7 194 L 5 199 L 4 213 L 3 214 L 2 235 L 3 236 L 3 251 L 4 252 L 4 263 L 9 265 L 10 264 L 15 249 L 18 244 L 19 239 L 28 218 L 31 214 L 31 212 L 42 191 L 47 184 L 57 174 L 66 168 L 74 166 L 83 166 L 91 172 L 96 187 L 96 221 L 95 222 L 95 229 L 93 238 L 93 247 L 90 260 L 89 273 L 87 278 L 87 285 L 83 301 L 80 322 L 77 332 L 76 343 L 74 348 L 73 359 L 70 370 L 70 376 L 67 387 L 67 393 L 63 412 L 63 419 L 60 432 L 60 441 L 57 456 L 57 467 L 56 468 L 56 476 L 54 485 L 54 499 L 53 500 L 53 537 L 54 538 L 54 551 L 57 564 L 57 570 L 60 578 L 60 582 L 67 601 L 75 614 L 81 621 L 90 628 L 101 634 L 112 638 L 117 638 L 124 640 L 137 640 L 152 637 L 155 635 L 158 635 L 168 631 L 186 620 L 197 610 L 204 601 L 197 572 L 197 565 L 194 552 L 192 519 L 191 518 L 191 477 L 192 476 L 192 463 L 193 462 L 193 449 L 194 448 L 194 432 L 195 431 L 197 402 L 199 392 L 200 391 L 215 396 L 220 396 L 235 400 L 243 400 L 252 402 L 285 402 L 286 401 L 301 400 L 315 396 L 319 396 L 322 394 L 328 393 L 343 387 L 368 373 L 385 360 L 399 347 L 413 331 L 426 313 L 445 276 L 455 246 L 455 242 L 459 228 L 459 221 L 460 220 L 461 205 L 462 204 L 461 166 L 459 159 L 458 147 L 456 143 L 452 126 L 449 121 L 449 118 L 445 111 L 445 109 L 433 88 L 422 73 L 412 62 L 385 41 L 373 34 L 371 34 Z M 265 121 L 280 128 L 297 143 L 305 153 L 315 173 L 315 177 L 318 184 L 319 199 L 320 200 L 320 216 L 319 217 L 318 233 L 315 241 L 315 245 L 308 264 L 298 282 L 288 295 L 277 306 L 265 315 L 255 319 L 251 322 L 225 328 L 207 328 L 206 327 L 206 317 L 207 316 L 208 269 L 209 268 L 207 218 L 204 204 L 203 191 L 200 181 L 200 176 L 197 167 L 197 163 L 190 142 L 183 127 L 197 122 L 218 118 L 252 118 Z"/></g></svg>
              {isConnecting && <div className="pcsSplashSpinner" aria-hidden="true" />}
            </div>
          </div>
        </>
        )}
    </>
  );
}

export default App;
