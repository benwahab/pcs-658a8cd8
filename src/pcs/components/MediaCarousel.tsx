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

    const observer = new IntersectionObserver(
      ([entry]) => setActive(Boolean(entry?.isIntersecting)),
      { rootMargin: "180px 0px", threshold: 0.35 },
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
      video.preload = "metadata";

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
      if (activeFeedVideo === video) activeFeedVideo = null;
    };
  }, [active, autoplayAllowed]);

  return (
    <video
      ref={ref}
      src={active ? src : undefined}
      poster={poster}
      controls
      playsInline
      muted
      loop
      preload="none"
      aria-label="Vidéo du média"
    />
  );
}

export function MediaCarousel({ media }: { media: MediaItem[] }) {
  if (!media.length) return null;

  const poster = media.find(
    (item) =>
      !item.media_type?.startsWith("video") &&
      item.media_role !== "resolution_video",
  )?.url;

  return (
    <div className="mediaCarousel">
      {media.map((item, index) => (
        <div className="mediaCarouselItem" key={item.id}>
          {item.media_type?.startsWith("video") ||
          item.media_role === "resolution_video" ? (
            <LazyFeedVideo src={item.url} poster={poster} />
          ) : (
            <img
              src={item.url}
              alt="Pièce jointe du signalement"
              loading="lazy"
              decoding="async"
            />
          )}
          {media.length > 1 && (
            <span className="mediaCount">
              {index + 1}/{media.length}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
