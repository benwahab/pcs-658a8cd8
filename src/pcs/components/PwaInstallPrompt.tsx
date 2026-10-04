import { useEffect, useState } from "react";

const ONBOARDING_KEY = "pcs_onboarding_v1_completed";
const DISMISSED_KEY = "pcs_pwa_install_dismissed_v1";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isInstalled() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    ("standalone" in navigator && (navigator as Navigator & { standalone?: boolean }).standalone === true)
  );
}

export default function PwaInstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [canPrompt, setCanPrompt] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [ios, setIos] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (window.location.pathname.startsWith("/mairie")) return;

    const ua = navigator.userAgent;
    const isIosDevice = /iphone|ipad|ipod/i.test(ua);
    setIos(isIosDevice);

    const checkInstalled = () => {
      const current = isInstalled();
      setInstalled(current);
      if (current) setVisible(false);
      return current;
    };

    const showAfterOnboarding = () => {
      if (checkInstalled()) return;
      if (localStorage.getItem(DISMISSED_KEY) === "true") return;
      setVisible(true);
    };

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      (window as Window & { __pcsInstallPrompt?: InstallPromptEvent }).__pcsInstallPrompt = event as InstallPromptEvent;
      setCanPrompt(true);
    };

    const onAppInstalled = () => {
      setInstalled(true);
      setVisible(false);
      setCanPrompt(false);
      localStorage.setItem("pcs_pwa_installed_v1", "true");
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    window.addEventListener("pcs-onboarding-completed", showAfterOnboarding);
    const media = window.matchMedia("(display-mode: standalone)");
    media.addEventListener?.("change", checkInstalled);

    // Existing citizens may have completed the guide before this install flow existed.
    const timer = window.setTimeout(() => {
      if (localStorage.getItem(ONBOARDING_KEY) === "true") showAfterOnboarding();
    }, 900);

    checkInstalled();
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
      window.removeEventListener("pcs-onboarding-completed", showAfterOnboarding);
      media.removeEventListener?.("change", checkInstalled);
    };
  }, []);

  async function install() {
    const promptEvent = (window as Window & { __pcsInstallPrompt?: InstallPromptEvent }).__pcsInstallPrompt;
    if (!promptEvent) {
      setShowHelp(true);
      return;
    }
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === "accepted") {
        setVisible(false);
        localStorage.setItem("pcs_pwa_install_dismissed_v1", "true");
      }
    } catch {
      setShowHelp(true);
    }
  }

  function dismiss() {
    setVisible(false);
    setShowHelp(false);
    localStorage.setItem(DISMISSED_KEY, "true");
  }

  if (!visible || installed) return null;

  return (
    <div role="presentation" style={{ position: "fixed", inset: 0, zIndex: 100000, display: "grid", placeItems: "center", padding: 20, background: "rgba(15,23,42,.62)" }}>
      <section role="dialog" aria-modal="true" aria-labelledby="pcs-pwa-title" style={{ width: "min(100%, 420px)", borderRadius: 22, padding: 24, background: "#fff", color: "#172033", boxShadow: "0 24px 80px rgba(0,0,0,.28)", fontFamily: "system-ui,sans-serif" }}>
        <div aria-hidden="true" style={{ width: 58, height: 58, marginBottom: 16, display: "grid", placeItems: "center", borderRadius: 16, background: "#e6f5f2", color: "#0f766e", fontSize: 30 }}>＋</div>
        <h2 id="pcs-pwa-title" style={{ margin: "0 0 10px", fontSize: 23, lineHeight: 1.2 }}>Installer PCS sur votre téléphone</h2>
        <p style={{ margin: "0 0 20px", color: "#52605e", lineHeight: 1.55 }}>Accédez plus rapidement à PCS depuis votre écran d’accueil, comme une application.</p>
        {showHelp && (
          <div style={{ marginBottom: 18, padding: 13, borderRadius: 12, background: "#f1f5f9", fontSize: 14, lineHeight: 1.55 }}>
            {ios
              ? <>Dans Safari, appuyez sur <strong>Partager</strong>, puis choisissez <strong>Sur l’écran d’accueil</strong> et confirmez.</>
              : <>Ouvrez le menu de votre navigateur (⋮ ou ⋯), puis choisissez <strong>Installer l’application</strong> ou <strong>Ajouter à l’écran d’accueil</strong>.</>}
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button type="button" onClick={install} style={{ minHeight: 48, border: 0, borderRadius: 12, padding: "12px 16px", background: "#0f766e", color: "#fff", fontWeight: 750, fontSize: 15, cursor: "pointer" }}>{showHelp ? "Voir les étapes d’installation" : "Installer PCS"}</button>
          <button type="button" onClick={dismiss} style={{ minHeight: 44, border: "1px solid #d5ddda", borderRadius: 12, padding: "10px 16px", background: "#fff", color: "#475569", fontWeight: 650, fontSize: 14, cursor: "pointer" }}>Plus tard</button>
        </div>
      </section>
    </div>
  );
}
