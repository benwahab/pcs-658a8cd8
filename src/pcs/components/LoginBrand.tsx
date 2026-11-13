// Purely visual header/footer shared by all PCS sign-in pages.
import { createPortal } from "react-dom";
import emblem from "@/assets/pcs-login-emblem.png.asset.json";
import backdrop from "@/assets/pcs-login-bg.webp.asset.json";

export function LoginBackdrop() {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      className="pcsLoginBg"
      aria-hidden="true"
      style={{ backgroundImage: `url(${backdrop.url})` }}
    />,
    document.body,
  );
}

export function LoginBrand() {
  return (
    <div className="pcsLoginBrand">
      <LoginBackdrop />
      <img src={emblem.url} alt="PCS" width={380} height={220} />
      <strong>
        Plateforme citoyenne
        <br />
        de signalement
      </strong>
      <span className="pcsLoginTagline">
        <em>Ensemble pour un Niger plus sûr</em>
      </span>
    </div>
  );
}

export function LoginFooter() {
  return (
    <div className="pcsLoginFooter">
      <span className="pcsLoginShield" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M12 2.5 4.5 5.5v6c0 4.6 3.1 8.4 7.5 10 4.4-1.6 7.5-5.4 7.5-10v-6L12 2.5Z" />
          <path d="m8.5 12 2.4 2.4 4.6-4.8" />
        </svg>
      </span>
      <strong>PCS - Niger</strong>
      <em>Une citoyenneté active pour un développement durable</em>
    </div>
  );
}
