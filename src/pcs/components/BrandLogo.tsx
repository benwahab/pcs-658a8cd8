import type { CSSProperties } from "react";
export default function BrandLogo({
  className = "",
  alt = "PCS — Plateforme Citoyenne de Signalement",
  style,
}: {
  className?: string;
  alt?: string;
  style?: CSSProperties;
}) {
  return (
    <img
      className={className}
      src="/assets/pcs-brand-logo.svg"
      alt={alt}
      style={style}
      draggable={false}
    />
  );
}
