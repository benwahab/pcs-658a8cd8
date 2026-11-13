import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { expectCode } from "../support/code";

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("public media approval guards", () => {
  const home = readSource("src/pcs/pages/Home.tsx");
  const detail = readSource("src/pcs/pages/ReportDetail.tsx");
  const mediaService = readSource("src/pcs/services/media.ts");
  const mediaCarousel = readSource("src/pcs/components/MediaCarousel.tsx");

  it("requires explicit approval before media enters the public home feed", () => {
    expectCode(home).toContain('item.moderation_status === "approved"');
    expectCode(home).toContain(
      "<MediaCarousel media={media} onMediaError={refreshFailedMediaUrl} />",
    );
    expectCode(home).toContain("// Clear the previous slide's media before loading this report.");
    expectCode(home).toContain("setMedia([]);\n    let cancelled = false;");
    expectCode(home).not.toContain("mediaCarouselPlaceholder");
  });

  it("preserves horizontal media navigation instead of resetting each swipe", () => {
    expectCode(mediaCarousel).toContain("Including activeIndex here would reset every swipe");
    expectCode(mediaCarousel).toContain("  }, [media]);");
    expectCode(mediaCarousel).not.toContain("  }, [media, activeIndex]);");
    expectCode(mediaCarousel).toContain('loading={safeIndex === 0 ? "eager" : "lazy"}');
    expectCode(mediaCarousel).toContain('fetchPriority={safeIndex === 0 ? "high" : "auto"}');
  });

  it("renews only a failed media URL through the approval-checking service", () => {
    expectCode(home).toContain(
      "const refreshFailedMediaUrl = async (mediaId: string, failedUrl: string) =>",
    );
    expectCode(home).toContain("current.url !== failedUrl");
    expectCode(home).toContain("mediaUrlRefreshInFlight.current.has(mediaId)");
    expectCode(home).toContain("createReportMediaUrl(current.storage_path)");
    expectCode(mediaCarousel).toContain("onError={() => onError?.(src)}");
    expectCode(mediaCarousel).toContain("onMediaError?.(item.id, failedUrl)");
  });

  it("avoids autoplay and eager video buffering on 3G connections", () => {
    expectCode(mediaCarousel).toContain('effectiveType !== "3g"');
    expectCode(mediaCarousel).toContain(
      'video.preload = slowNetwork && !autoplayAllowed ? "metadata" : "auto";',
    );
    expectCode(mediaCarousel).toContain('video.preload = "auto";');
  });

  it("uses time-limited public media links and renews them before the one-hour expiry", () => {
    expectCode(mediaService).toContain("expiresIn = 3600");
    expectCode(mediaService).toContain("createReportMediaUrls(");
    expectCode(mediaService).toContain("body: { paths: missing, expiresIn }");
    expectCode(mediaService).toContain("createReportMediaUrl(");
  });

  it("requires explicit approval before media enters public report details", () => {
    expectCode(detail).toContain(
      'select("id,storage_path,media_role,media_type,moderation_status")',
    );
    expectCode(detail).toContain('m.moderation_status==="approved"');
    expectCode(detail).toContain("createReportMediaUrls(approvedMedia.map(m=>m.storage_path))");
    expectCode(detail).toContain("signedUrls[m.storage_path]");
  });

  it("prepares the next report's media about 1.5 screens ahead of the swipe", () => {
    expectCode(home).toContain("const lookAheadPx = Math.max(");
    expectCode(home).toContain("* 1.5");
    expectCode(home).toContain("rootMargin: `${lookAheadPx}px 0px`");
    expectCode(home).not.toContain('rootMargin: "700px 0px"');
    // The approval check still runs before any media is shown.
    expectCode(home).toContain('item.moderation_status === "approved"');
  });
});
