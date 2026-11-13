import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { expectCode } from "../support/code";

describe("public feed media visibility", () => {
  const home = readFileSync(resolve(process.cwd(), "src/pcs/pages/Home.tsx"), "utf8");

  it("renders the media carousel only when approved media URLs exist", () => {
    expectCode(home).toContain("{mediaReady && media.length > 0 && (");
    expectCode(home).toContain(
      "<MediaCarousel media={media} onMediaError={refreshFailedMediaUrl} />",
    );
    expectCode(home).not.toContain("mediaCarouselPlaceholder");
  });

  it("filters public media to explicitly approved citizen evidence or resolution videos", () => {
    expectCode(home).toContain('item.moderation_status === "approved"');
    expectCode(home).toContain(
      '(item.media_role === "citizen_evidence" || item.media_role === "resolution_video")',
    );
  });
});
