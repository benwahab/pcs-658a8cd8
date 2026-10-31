import { useEffect, useRef, useState } from "react";

type MediaItem = {
  id: string;
  url: string;
  media_type: string;
  media_role?: string;
};

let activeFeedVideo: HTMLVideoElement | null = null;

function LazyFeedVideo({ src, poster, onError }: { src: string; poster?: string; onError?: (failedUrl: string) => void }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [active, setActive] = useState(false);
  const [frameReady, setFrameReady] = useState(false);
  const [autoplayAllowed, setAutoplayAllowed] = useState(true);
  const [slowNetwork, setSlowNetwork] = useState(false);

  useEffect(() => {
    const connection = (
      navigator as Navigator & {
        connection?: { saveData?: boolean; effectiveType?: string };
      }
    ).connection;
    const effectiveType = connection?.effectiveType;
    const saveData = connection?.saveData === true;

    // Mobile-first network policy:
    // 2G/slow-2G and Save-Data use the strictest data-saving mode.
    // 3G uses a conservative mode to avoid pulling large videos too early.
    // 4G/5G/Wi-Fi are treated as normal, while still loading only the active item.
    const slowNetwork =
      saveData ||
      effectiveType === "slow-2g" ||
      effectiveType === "2g" ||
      effectiveType === "3g";

    // Avoid automatic playback and full-file preloading on 3G as well.
    // Citizens can still start playback manually; on that explicit action,
    // onUserPlay switches only this video to preload="auto".
    const autoplayAllowed =
      !saveData &&
      effectiveType !== "slow-2g" &&
      effectiveType !== "2g" &&
      effectiveType !== "3g" &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    setSlowNetwork(slowNetwork);
    setAutoplayAllowed(autoplayAllowed);

    if (!("IntersectionObserver" in window)) {
      setActive(true);
      return;
    }

    const video = ref.current;
    if (!video) return;

    const feedRoot = video.closest<HTMLElement>(".citizenFeed");

    const observer = new IntersectionObserver(
      ([entry]) => setActive(Boolean(entry?.isIntersecting)),
      {
        root: feedRoot ?? null,
        rootMargin: slowNetwork ? "40px 0px" : "180px 0px",
        threshold: slowNetwork ? 0.45 : 0.2,
      },
    );

    observer.observe(video);
    return () => observer.disconnect();
  }, [slowNetwork]);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    let disposed = false;

    const stopOtherFeedVideos = () => {
      if (activeFeedVideo && activeFeedVideo !== video) {
        activeFeedVideo.pause();
      }
    };

    const tryPlay = () => {
      if (disposed || !active || !autoplayAllowed) return;

      // Explicit properties are important on mobile WebKit/Chromium:
      // the JSX attributes alone are not always enough after a source reload.
      video.muted = true;
      video.defaultMuted = true;
      video.playsInline = true;

      stopOtherFeedVideos();
      activeFeedVideo = video;

      void video.play()
        .catch(() => {
          // Native video controls remain available when autoplay is refused.
        });
    };

    const onReady = () => {
      if (!active) return;
      tryPlay();
    };

    const onUserPlay = () => {
      activeFeedVideo = video;
      // Once the citizen explicitly starts playback, allow the browser to build
      // a useful buffer even when the device prefers reduced data usage.
      // This only affects the currently playing video.
      video.preload = "auto";
    };

    video.addEventListener("canplay", onReady);
    video.addEventListener("loadeddata", onReady);
    video.addEventListener("play", onUserPlay);

    const onVisibility = () => {
      if (document.visibilityState !== "visible") video.pause();
      else if (active) tryPlay();
    };

    document.addEventListener("visibilitychange", onVisibility);

    if (active) {
      // Only the active video may buffer. On 3G/2G, Save-Data, or reduced
      // motion, keep metadata-only until the citizen manually presses Play.
      video.preload = slowNetwork && !autoplayAllowed ? "metadata" : "auto";
      video.muted = true;
      video.defaultMuted = true;
      video.playsInline = true;

      if (video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
        tryPlay();
      } else {
        // Start loading first; playback is retried from canplay/loadeddata.
        video.load();
      }
    } else {
      video.pause();
      if (activeFeedVideo === video) activeFeedVideo = null;
    }

    return () => {
      disposed = true;
      video.removeEventListener("canplay", onReady);
      video.removeEventListener("loadeddata", onReady);
      video.removeEventListener("play", onUserPlay);
      document.removeEventListener("visibilitychange", onVisibility);
      video.pause();
      if (activeFeedVideo === video) activeFeedVideo = null;
    };
  }, [active, autoplayAllowed, slowNetwork]);

  return (
    <div className="feedVideoFrame">
      <video
        ref={ref}
        className={frameReady ? "feedVideoReady" : "feedVideoLoading"}
        onLoadedData={() => setFrameReady(true)}
        onPlaying={() => setFrameReady(true)}
        onError={() => onError?.(src)}
        src={src}
        poster={poster}
        autoPlay
        playsInline
        muted
        loop={!slowNetwork}
        preload={active ? (slowNetwork && !autoplayAllowed ? "metadata" : "auto") : "none"}
        controls
        aria-label="Vidéo du signalement"
        controlsList="noremoteplayback"
        disablePictureInPicture
      />
    </div>
  );
}

export function MediaCarousel({ media, onMediaError }: { media: MediaItem[]; onMediaError?: (mediaId: string, failedUrl: string) => void }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [imageReady, setImageReady] = useState(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const swipeHandled = useRef(false);

  // Reset the selected item only when the report's media collection changes.
  // Including activeIndex here would reset every swipe back to the first item.
  useEffect(() => {
    setActiveIndex(0);
  }, [media]);

  // Each newly selected image needs its own decode/readiness state.
  useEffect(() => {
    setImageReady(false);
  }, [activeIndex, media]);

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
          <LazyFeedVideo src={item.url} poster={poster} onError={(failedUrl) => onMediaError?.(item.id, failedUrl)} />
        ) : (
          <img
            className={`citizenFeedMediaImage${imageReady ? " mediaImageReady" : " mediaImageLoading"}`}
            src={item.url}
            alt="Pièce jointe du signalement"
            loading="lazy"
            decoding="async"
            fetchPriority="low"
            onLoad={(event) => {
              const image = event.currentTarget;
              void image.decode().catch(() => undefined).finally(() => setImageReady(true));
            }}
            onError={() => {
              setImageReady(true);
              onMediaError?.(item.id, item.url);
            }}
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
