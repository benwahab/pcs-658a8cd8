import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("organization signup UI integration", () => {
  const login = readSource("src/pcs/pages/OrganizationLogin.tsx");
  const cst = readSource("src/pcs/pages/CST.tsx");

  it("submits the registration form to the dedicated Edge Function", () => {
    expect(login).toContain('supabase.functions.invoke("organization-signup"');
    expect(login).toContain("organization_code: org");
    expect(login).toContain("structure_name: structureName.trim()");
    expect(login).toContain("region_id: regionId");
    expect(login).toContain("commune_id: communeId");
    expect(login).toContain("email: email.trim()");
    expect(login).toContain("password,");
  });

  it("does not report success when the Edge Function returns an error", () => {
    expect(login).toContain("if (signupError)");
    expect(login).toContain("if (data?.error) throw new Error(data.error)");
    expect(login).toContain("setInfo(data?.message");
  });

  it("keeps organization signup review in the CST dashboard", () => {
    expect(cst).toContain('supabase.rpc("list_organization_signup_requests")');
    expect(cst).toContain('"approve_organization_signup_request"');
    expect(cst).toContain('"reject_organization_signup_request"');
    expect(cst).toContain("const note=orgRejectNote.trim()");
  });
});
