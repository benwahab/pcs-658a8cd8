import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { expectCode } from "../support/code";

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("organization-create-agency security invariants", () => {
  const source = readSource("supabase/edge-functions-source/organization-create-agency/index.ts");

  it("requires a precise active central-unit membership", () => {
    expectCode(source).toContain(
      '.select("organization_id, unit_id, role, organization_units!inner(unit_type,is_active)")',
    );
    expectCode(source).toContain('.eq("organization_units.unit_type", "central")');
    expectCode(source).toContain('.eq("organization_units.is_active", true)');
    expectCode(source).toContain('const centralUnitId = String(membership.unit_id ?? "")');
  });

  it("does not accept an arbitrary administrator email", () => {
    expectCode(source).not.toContain("body.admin_email");
    expectCode(source).toContain("@agency.pcs.invalid");
    expectCode(source).toContain("email: null");
  });

  it("rolls back incomplete agency provisioning", () => {
    expectCode(source).toContain("await db.auth.admin.deleteUser(created.user.id)");
    expectCode(source).toContain('await db.from("organization_units").delete().eq("id", unit.id)');
  });
});

describe("organization-signup safeguards", () => {
  const source = readSource("supabase/edge-functions-source/organization-signup/index.ts");

  it("limits repeated signup attempts and rejects unsupported organizations", () => {
    expectCode(source).toContain("consume_mairie_signup_rate_limit");
    expectCode(source).toContain("p_max_attempts: 5");
    expectCode(source).toContain('["NIGELEC", "NDE"]');
    expectCode(source).toContain(
      'return json({ error: "Trop de tentatives. Réessayez plus tard." }, 429)',
    );
  });

  it("keeps professional access pending until CST approval", () => {
    expectCode(source).toContain('status: "pending"');
    expectCode(source).toContain(
      "Aucun accès professionnel ne sera accordé avant l’approbation du CST",
    );
    expectCode(source).toContain("await rollback()");
  });
});
