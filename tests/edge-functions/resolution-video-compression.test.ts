import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { expectCode } from "../support/code";

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("resolution video optimization", () => {
  const mairie = readSource("src/pcs/services/mairie.ts");
  const agentPage = readSource("src/pcs/pages/AgentTerrain.tsx");

  it("re-encodes the field video before uploading it", () => {
    const compressAt = mairie.indexOf("await compressCitizenVideo(video, onCompressProgress)");
    const uploadAt = mairie.indexOf("await uploadResolutionVideo(");
    expect(compressAt).toBeGreaterThan(-1);
    expect(uploadAt).toBeGreaterThan(compressAt);
    // The uploaded file is the optimized one, never the raw input.
    expectCode(mairie).toContain("optimizedVideo,");
  });

  it("keeps the report-already-resolved shortcut before any compression work", () => {
    const resolvedAt = mairie.indexOf('report.status === "resolved") return true');
    const compressAt = mairie.indexOf("await compressCitizenVideo(");
    expect(resolvedAt).toBeGreaterThan(-1);
    expect(compressAt).toBeGreaterThan(resolvedAt);
  });

  it("keeps the GPS accuracy guard before uploading", () => {
    const gpsGuardAt = mairie.indexOf("accuracyM > 20");
    const compressAt = mairie.indexOf("await compressCitizenVideo(");
    expect(gpsGuardAt).toBeGreaterThan(-1);
    expect(compressAt).toBeGreaterThan(gpsGuardAt);
  });

  it("shows the optimization progress to the agent and always clears it", () => {
    expectCode(agentPage).toContain("(ratio) => setVideoProgress(ratio)");
    expectCode(agentPage).toContain("Optimisation de la vidéo…");
    expectCode(agentPage).toContain("setVideoProgress(null);");
  });
});
