import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { expectCode } from "../support/code";

const source = readFileSync(
  resolve(process.cwd(), "supabase/edge-functions-source/mairie-create-agent/index.ts"),
  "utf8",
);

describe("mairie-create-agent phone validation", () => {
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

describe("mairie-create-agent authorization and identity invariants", () => {
  it("only allows active, approved mairie accounts to create agents", () => {
    expectCode(source).toContain('.eq("is_active", true)');
    expectCode(source).toContain('.eq("approval_status", "approved")');
  });

  it("stores the normalized Niger phone used by agent login", () => {
    expectCode(source).toContain("phone_normalized: phone");
    expectCode(source).toContain('.eq("phone_normalized", phone)');
  });

  it("removes an inherited citizen role before completing agent provisioning", () => {
    expectCode(source).toContain('.eq("code", "citizen")');
    expectCode(source).toContain(".delete()");
    expectCode(source).toContain("inherited citizen role cleanup failed");
  });
});
