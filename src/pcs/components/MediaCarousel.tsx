import { useEffect, useRef, useState } from "react";

type MediaItem = {
  id: string;
  url: string;
  media_type: string;
  media_role?: string;
};

let activeFeedVideo: HTMLVideoElement | null = null;

function LazyFeedVideo({ src, poster }: { src: string; poster?: string }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [active, setActive] = useState(false);
  const [autoplayAllowed, setAutoplayAllowed] = useState(true);

  useEffect(() => {
    const connection = (
      navigator as Navigator & {
        connection?: { saveData?: boolean; effectiveType?: string };
      }
    ).connection;
    const slowNetwork =
      connection?.saveData === true ||
      connection?.effectiveType === "slow-2g" ||
      connection?.effectiveType === "2g";

    setAutoplayAllowed(
      !slowNetwork &&
        !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );

    if (!("IntersectionObserver" in window)) {
      setActive(true);
      return;
    }

    const video = ref.current;
    if (!video) return;

    // The citizen feed is itself the scroll container. Using the browser
    // viewport as the observer root is unreliable on mobile/PWA, where the
    // feed can scroll inside a fixed-height app shell. Observe against the
    // actual feed so videos are activated as they approach the visible slide.
    const feedRoot = video.closest<HTMLElement>(".citizenFeed");

    const observer = new IntersectionObserver(
      ([entry]) => setActive(Boolean(entry?.isIntersecting)),
      { root: feedRoot ?? null, rootMargin: "320px 0px", threshold: 0.2 },
    );

    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    const onVisibility = () => {
      if (document.visibilityState !== "visible") video.pause();
    };

    document.addEventListener("visibilitychange", onVisibility);

    if (active) {
      // Prepare the visible video and allow it to buffer before playback.
      video.preload = "auto";
      if (video.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) {
        video.load();
      }

      if (autoplayAllowed) {
        if (activeFeedVideo && activeFeedVideo !== video) {
          activeFeedVideo.pause();
        }
        activeFeedVideo = video;
        void video.play().catch(() => undefined);
      }
    } else {
      video.pause();
      if (activeFeedVideo === video) activeFeedVideo = null;
    }

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      // Stop playback when this slide is removed or replaced by another media item.
      video.pause();
      if (activeFeedVideo === video) activeFeedVideo = null;
    };
  }, [active, autoplayAllowed]);

  return (
    <video
      ref={ref}
      src={src}
      poster={poster}
      autoPlay
      playsInline
      muted
      loop
      preload="auto"
      aria-label="Vidéo du signalement"
    />
  );
}

export function MediaCarousel({ media }: { media: MediaItem[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const swipeHandled = useRef(false);

  useEffect(() => {
    setActiveIndex(0);
  }, [media]);

  if (!media.length) return null;

  const safeIndex = Math.min(activeIndex, media.length - 1);
  const item = media[safeIndex];
  const isVideo =
    item.media_type?.startsWith("video") ||
    item.media_role === "resolution_video";
  const poster = media.find(
    (candidate) =>
      !candidate.media_type?.startsWith("video") &&
      candidate.media_role !== "resolution_video",
  )?.url;

  const changeSlide = (direction: -1 | 1) => {
    setActiveIndex((current) =>
      Math.max(0, Math.min(media.length - 1, current + direction)),
    );
  };

  return (
    <div
      className="mediaCarousel"
      onTouchStartCapture={(event) => {
        const touch = event.changedTouches[0];
        if (!touch) return;
        touchStart.current = { x: touch.clientX, y: touch.clientY };
        swipeHandled.current = false;
      }}
      onTouchEndCapture={(event) => {
        const startPoint = touchStart.current;
        touchStart.current = null;
        if (!startPoint || swipeHandled.current) return;
        const touch = event.changedTouches[0];
        if (!touch) return;
        const dx = touch.clientX - startPoint.x;
        const dy = touch.clientY - startPoint.y;
        // Accept deliberate short horizontal swipes, but leave vertical page scrolling alone.
        if (Math.abs(dx) < 28 || Math.abs(dx) < Math.abs(dy) * 1.15) return;
        swipeHandled.current = true;
        changeSlide(dx < 0 ? 1 : -1);
      }}
      aria-label="Médias du signalement : glisser horizontalement pour changer de média"
    >
      <div className="mediaCarouselItem" key={item.id}>
        {isVideo ? (
          <LazyFeedVideo src={item.url} poster={poster} />
        ) : (
          <img
            className="citizenFeedMediaImage"
            src={item.url}
            alt="Pièce jointe du signalement"
            decoding="async"
          />
        )}
      </div>
      {media.length > 1 && (
        <>
          <span className="mediaCount" aria-live="polite">
            {safeIndex + 1}/{media.length}
          </span>
          {safeIndex > 0 && (
            <button
              type="button"
              className="mediaCarouselNav mediaCarouselPrev"
              aria-label="Média précédent"
              onClick={() => changeSlide(-1)}
            >
              ‹
            </button>
          )}
          {safeIndex < media.length - 1 && (
            <button
              type="button"
              className="mediaCarouselNav mediaCarouselNext"
              aria-label="Média suivant"
              onClick={() => changeSlide(1)}
            >
              ›
            </button>
          )}
        </>
      )}
    </div>
  );
}
