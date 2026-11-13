import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { expectCode } from "../support/code";

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("organization signup UI integration", () => {
  const login = readSource("src/pcs/pages/OrganizationLogin.tsx");
  const cst = readSource("src/pcs/pages/CST.tsx");

  it("submits the registration form to the dedicated Edge Function", () => {
    expectCode(login).toContain('supabase.functions.invoke("organization-signup"');
    expectCode(login).toContain("organization_code: org");
    expectCode(login).toContain("structure_name: structureName.trim()");
    expectCode(login).toContain("region_id: regionId");
    expectCode(login).toContain("commune_id: communeId");
    expectCode(login).toContain("email: email.trim()");
    expectCode(login).toContain("password,");
  });

  it("does not report success when the Edge Function returns an error", () => {
    expectCode(login).toContain("if (signupError)");
    expectCode(login).toContain("if (data?.error) throw new Error(data.error)");
    expectCode(login).toContain("setInfo(data?.message");
  });

  it("keeps organization signup review in the CST dashboard", () => {
    expectCode(cst).toContain('supabase.rpc("list_organization_signup_requests")');
    expectCode(cst).toContain('"approve_organization_signup_request"');
    expectCode(cst).toContain('"reject_organization_signup_request"');
    expectCode(cst).toContain("const note=orgRejectNote.trim()");
  });
});
