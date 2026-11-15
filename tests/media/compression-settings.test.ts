import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { expectCode } from "../support/code";

const media = readFileSync(resolve(process.cwd(), "src/pcs/services/media.ts"), "utf8");

describe("media compression budget (poor-connection playback)", () => {
  it("caps video at 720p, 30 fps and about 1.5 Mbit/s", () => {
    expectCode(media).toContain("const VIDEO_MAX_LONG_SIDE = 1280;");
    expectCode(media).toContain("bitrate: 1_500_000,");
    expectCode(media).toContain("frameRate: 30,");
  });

  it("keeps the MP4 index at the start so playback begins before the download ends", () => {
    expectCode(media).toContain('fastStart: "in-memory"');
  });

  it("preserves more photo detail with 1920 px WebP and never keeps a non-WebP result", () => {
    expectCode(media).toContain("const maxDimension = 1920;");
    expectCode(media).toContain('"image/webp", 0.86');
    expectCode(media).toContain('blob.type !== "image/webp"');
  });
});
