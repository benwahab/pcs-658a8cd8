import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("public media approval guards", () => {
  const home = readSource("src/pcs/pages/Home.tsx");
  const detail = readSource("src/pcs/pages/ReportDetail.tsx");

  it("requires explicit approval before media enters the public home feed", () => {
    expect(home).toContain('item.moderation_status === "approved"');
    expect(home).toContain('<MediaCarousel media={media} />');
    expect(home).not.toContain("mediaCarouselPlaceholder");
  });

  it("requires explicit approval before media enters public report details", () => {
    expect(detail).toContain('select("id,storage_path,media_role,media_type,moderation_status")');
    expect(detail).toContain('m.moderation_status==="approved"');
    expect(detail).toContain("Promise.allSettled(approvedMedia.map");
    expect(detail).toContain('result.status==="fulfilled"');
  });
});
