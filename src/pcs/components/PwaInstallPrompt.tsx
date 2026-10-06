import { useEffect, useState } from "react";

const ONBOARDING_KEY = "pcs_onboarding_v1_completed";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

declare global {
  interface Window {
    __pcsInstallPrompt?: InstallPromptEvent;
  }
}

function isInstalled() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    ("standalone" in navigator &&
      (navigator as Navigator & { standalone?: boolean }).standalone === true)
  );
}

export default function PwaInstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [promptAvailable, setPromptAvailable] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (window.location.pathname.startsWith("/mairie")) return;

    const checkInstalled = () => {
      const current = isInstalled();
      setInstalled(current);
      if (current) setVisible(false);
      return current;
    };

    const maybeShowPrompt = () => {
      if (checkInstalled()) return;
      if (!window.__pcsInstallPrompt) return;
      if (localStorage.getItem(ONBOARDING_KEY) === "true") setVisible(true);
    };

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      window.__pcsInstallPrompt = event as InstallPromptEvent;
      setPromptAvailable(true);
      maybeShowPrompt();
    };

    const onOnboardingCompleted = () => {
      if (window.__pcsInstallPrompt) maybeShowPrompt();
    };

    const onAppInstalled = () => {
      setInstalled(true);
      setVisible(false);
      window.__pcsInstallPrompt = undefined;
      localStorage.setItem("pcs_pwa_installed_v1", "true");
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    window.addEventListener("pcs-onboarding-completed", onOnboardingCompleted);
    const media = window.matchMedia("(display-mode: standalone)");
    media.addEventListener?.("change", checkInstalled);

    checkInstalled();
    // The native install event can arrive after the onboarding flow finishes.
    const timer = window.setTimeout(maybeShowPrompt, 1500);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
      window.removeEventListener("pcs-onboarding-completed", onOnboardingCompleted);
      media.removeEventListener?.("change", checkInstalled);
    };
  }, []);

  async function install() {
    const promptEvent = window.__pcsInstallPrompt;
    if (!promptEvent) {
      setVisible(false);
      return;
    }

    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      window.__pcsInstallPrompt = undefined;
      setPromptAvailable(false);
      if (choice.outcome === "accepted") {
        setVisible(false);
      }
    } catch {
      setVisible(false);
    }
  }

  function dismiss() {
    setVisible(false);
  }

  if (!visible || installed || !promptAvailable) return null;

  return (
    <div
      role="presentation"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200000,
        display: "grid",
        placeItems: "center",
        padding: 20,
        background: "rgba(15,23,42,.62)",
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="pcs-pwa-title"
        style={{
          width: "min(100%, 420px)",
          borderRadius: 22,
          padding: 24,
          background: "#fff",
          color: "#172033",
          boxShadow: "0 24px 80px rgba(0,0,0,.28)",
          fontFamily: "system-ui,sans-serif",
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: 58,
            height: 58,
            marginBottom: 16,
            display: "grid",
            placeItems: "center",
            borderRadius: 16,
            background: "#e6f5f2",
            color: "#0f766e",
            fontSize: 30,
          }}
        >
          ＋
        </div>
        <h2
          id="pcs-pwa-title"
          style={{ margin: "0 0 10px", fontSize: 23, lineHeight: 1.2 }}
        >
          Installer PCS
        </h2>
        <p style={{ margin: "0 0 20px", color: "#52605e", lineHeight: 1.55 }}>
          Installez PCS sur votre téléphone en un seul geste.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            type="button"
            onClick={install}
            style={{
              minHeight: 48,
              border: 0,
              borderRadius: 12,
              padding: "12px 16px",
              background: "#0f766e",
              color: "#fff",
              fontWeight: 750,
              fontSize: 15,
              cursor: "pointer",
            }}
          >
            Installer maintenant
          </button>
          <button
            type="button"
            onClick={dismiss}
            style={{
              minHeight: 44,
              border: "1px solid #d5ddda",
              borderRadius: 12,
              padding: "10px 16px",
              background: "#fff",
              color: "#475569",
              fontWeight: 650,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Plus tard
          </button>
        </div>
      </section>
    </div>
  );
}
