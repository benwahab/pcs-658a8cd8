import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("public feed media visibility", () => {
  const home = readFileSync(resolve(process.cwd(), "src/pcs/pages/Home.tsx"), "utf8");

  it("renders the media carousel only when approved media URLs exist", () => {
    expect(home).toContain("{mediaReady && media.length > 0 && (");
    expect(home).toContain("<MediaCarousel media={media} onMediaError={refreshFailedMediaUrl} />");
    expect(home).not.toContain("mediaCarouselPlaceholder");
  });

  it("filters public media to explicitly approved citizen evidence or resolution videos", () => {
    expect(home).toContain("item.moderation_status === \"approved\"");
    expect(home).toContain('(item.media_role === "citizen_evidence" || item.media_role === "resolution_video")');
  });
});
