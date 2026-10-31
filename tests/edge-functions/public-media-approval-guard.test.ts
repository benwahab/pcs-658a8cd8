import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("public media approval guards", () => {
  const home = readSource("src/pcs/pages/Home.tsx");
  const detail = readSource("src/pcs/pages/ReportDetail.tsx");
  const mediaService = readSource("src/pcs/services/media.ts");
  const mediaCarousel = readSource("src/pcs/components/MediaCarousel.tsx");

  it("requires explicit approval before media enters the public home feed", () => {
    expect(home).toContain('item.moderation_status === "approved"');
    expect(home).toContain('<MediaCarousel media={media} onMediaError={refreshFailedMediaUrl} />');
    expect(home).toContain("// Clear the previous slide's media before loading this report.");
    expect(home).toContain("setMedia([]);\n    let cancelled = false;");
    expect(home).not.toContain("mediaCarouselPlaceholder");
  });

  it("preserves horizontal media navigation instead of resetting each swipe", () => {
    expect(mediaCarousel).toContain("Including activeIndex here would reset every swipe");
    expect(mediaCarousel).toContain("  }, [media]);");
    expect(mediaCarousel).not.toContain("  }, [media, activeIndex]);");
  });

  it("renews only a failed media URL through the approval-checking service", () => {
    expect(home).toContain("const refreshFailedMediaUrl = async (mediaId: string, failedUrl: string) =>");
    expect(home).toContain("current.url !== failedUrl");
    expect(home).toContain("mediaUrlRefreshInFlight.current.has(mediaId)");
    expect(home).toContain("createReportMediaUrl(current.storage_path)");
    expect(mediaCarousel).toContain("onError={() => onError?.(src)}");
    expect(mediaCarousel).toContain("onMediaError?.(item.id, failedUrl)");
  });

  it("avoids autoplay and eager video buffering on 3G connections", () => {
    expect(mediaCarousel).toContain('effectiveType !== "3g"');
    expect(mediaCarousel).toContain('video.preload = slowNetwork && !autoplayAllowed ? "metadata" : "auto";');
    expect(mediaCarousel).toContain('video.preload = "auto";');
  });

  it("uses time-limited public media links and renews them before the one-hour expiry", () => {
    expect(mediaService).toContain("expiresIn = 3600");
    expect(mediaService).toContain('body: { path, expiresIn }');
  });

  it("requires explicit approval before media enters public report details", () => {
    expect(detail).toContain('select("id,storage_path,media_role,media_type,moderation_status")');
    expect(detail).toContain('m.moderation_status==="approved"');
    expect(detail).toContain("Promise.allSettled(approvedMedia.map");
    expect(detail).toContain('result.status==="fulfilled"');
  });
});
