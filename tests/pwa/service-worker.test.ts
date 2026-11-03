import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("PCS service worker offline startup", () => {
  const source = readFileSync(new URL("../../public/sw.js", import.meta.url), "utf8");

  it("caches fingerprinted JavaScript and CSS assets", () => {
    expect(source).toContain("async function cacheFirstBuildAsset");
    expect(source).toContain('/assets/');
    expect(source).toContain('request.destination==="script"||request.destination==="style"');
    expect(source).toContain("cacheFirstBuildAsset(request)");
  });

  it("keeps API and authentication endpoints outside the cache", () => {
    expect(source).toContain('url.pathname.startsWith("/api/")||url.pathname.startsWith("/auth/")');
  });

  it("uses a shorter network wait before falling back to the cached shell", () => {
    expect(source).toContain("controller.abort(),2000");
    expect(source).toContain('cache.match(new URL("/",self.location.origin).href)');
  });
});
