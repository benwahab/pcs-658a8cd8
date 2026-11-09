import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";

export function PhotoLightbox({ photos, startIndex, onClose }: { photos: string[]; startIndex: number; onClose: () => void }) {
  const [index, setIndex] = useState(startIndex);
  const [zoomed, setZoomed] = useState(false);
  const touch = useRef<{ x: number; y: number; n: number } | null>(null);

  const go = (d: -1 | 1) => setIndex((i) => Math.max(0, Math.min(photos.length - 1, i + d)));

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return createPortal(
    <div
      className="photoLightbox"
      role="dialog"
      aria-modal="true"
      aria-label="Photo en plein écran"
      onTouchStart={(e) => {
        const t = e.touches[0];
        touch.current = t ? { x: t.clientX, y: t.clientY, n: e.touches.length } : null;
      }}
      onTouchEnd={(e) => {
        const start = touch.current;
        touch.current = null;
        const t = e.changedTouches[0];
        if (!start || !t || start.n > 1 || zoomed) return;
        const dx = t.clientX - start.x;
        const dy = t.clientY - start.y;
        if (dy > 90 && Math.abs(dy) > Math.abs(dx) * 1.3) onClose();
        else if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
      }}
    >
      <button type="button" className="photoLightboxClose" aria-label="Fermer" onClick={onClose}>×</button>
      {photos.length > 1 && <span className="photoLightboxCount">{index + 1}/{photos.length}</span>}
      <TransformWrapper
        key={index}
        minScale={1}
        maxScale={4}
        doubleClick={{ mode: "toggle", step: 1.5 }}
        panning={{ disabled: !zoomed }}
        onTransformed={(_, s) => setZoomed(s.scale > 1.02)}
      >
        <TransformComponent wrapperClass="photoLightboxStage" contentClass="photoLightboxContent">
          <img src={photos[index]} alt={`Photo ${index + 1} du signalement`} draggable={false} />
        </TransformComponent>
      </TransformWrapper>
      {index > 0 && <button type="button" className="photoLightboxNav isPrev" aria-label="Photo précédente" onClick={() => go(-1)}>‹</button>}
      {index < photos.length - 1 && <button type="button" className="photoLightboxNav isNext" aria-label="Photo suivante" onClick={() => go(1)}>›</button>}
    </div>,
    document.body,
  );
}
