import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { expectCode } from "../support/code";

describe("PCS service worker offline startup", () => {
  const source = readFileSync(new URL("../../public/sw.js", import.meta.url), "utf8");

  it("caches fingerprinted JavaScript and CSS assets", () => {
    expectCode(source).toContain("async function cacheFirstBuildAsset");
    expectCode(source).toContain("/assets/");
    expectCode(source).toContain('request.destination==="script"||request.destination==="style"');
    expectCode(source).toContain("cacheFirstBuildAsset(request)");
  });

  it("keeps API and authentication endpoints outside the cache", () => {
    expectCode(source).toContain(
      'url.pathname.startsWith("/api/")||url.pathname.startsWith("/auth/")',
    );
  });

  it("uses a shorter network wait before falling back to the cached shell", () => {
    expectCode(source).toContain("controller.abort(),2000");
    expectCode(source).toContain('cache.match(new URL("/",self.location.origin).href)');
  });
});
