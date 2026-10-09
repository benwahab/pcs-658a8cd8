import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("mairie-create-agent phone validation", () => {
  const source = readFileSync(
    resolve(process.cwd(), "supabase/edge-functions-source/mairie-create-agent/index.ts"),
    "utf8",
  );
  const validation = source.match(/if \(!\/(.+?)\/\.test\(phone\)\)/);

  it("uses a real Niger international phone pattern", () => {
    expect(validation, "phone validation must remain explicit in the Edge Function").not.toBeNull();
    const pattern = new RegExp(validation![1]);

    expect(pattern.test("+22793560626")).toBe(true);
    expect(pattern.test("+22700000000")).toBe(true);
    expect(pattern.test("93560626")).toBe(false);
    expect(pattern.test("+22893560626")).toBe(false);
    expect(pattern.test("+2279356062")).toBe(false);
    expect(pattern.test("+227935606266")).toBe(false);
  });
});
