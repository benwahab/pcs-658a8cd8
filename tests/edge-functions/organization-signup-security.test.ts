import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("organization-create-agency security invariants", () => {
  const source = readSource("supabase/edge-functions-source/organization-create-agency/index.ts");

  it("requires a precise active central-unit membership", () => {
    expect(source).toContain(
      '.select("organization_id, unit_id, role, organization_units!inner(unit_type,is_active)")',
    );
    expect(source).toContain('.eq("organization_units.unit_type", "central")');
    expect(source).toContain('.eq("organization_units.is_active", true)');
    expect(source).toContain('const centralUnitId = String(membership.unit_id ?? "")');
  });

  it("does not accept an arbitrary administrator email", () => {
    expect(source).not.toContain("body.admin_email");
    expect(source).toContain("@agency.pcs.invalid");
    expect(source).toContain("email: null");
  });

  it("rolls back incomplete agency provisioning", () => {
    expect(source).toContain("await db.auth.admin.deleteUser(created.user.id)");
    expect(source).toContain('await db.from("organization_units").delete().eq("id", unit.id)');
  });
});

describe("organization-signup safeguards", () => {
  const source = readSource("supabase/edge-functions-source/organization-signup/index.ts");

  it("limits repeated signup attempts and rejects unsupported organizations", () => {
    expect(source).toContain("consume_mairie_signup_rate_limit");
    expect(source).toContain("p_max_attempts: 5");
    expect(source).toContain('["NIGELEC", "NDE"]');
    expect(source).toContain(
      'return json({ error: "Trop de tentatives. Réessayez plus tard." }, 429)',
    );
  });

  it("keeps professional access pending until CST approval", () => {
    expect(source).toContain('status: "pending"');
    expect(source).toContain(
      "Aucun accès professionnel ne sera accordé avant l’approbation du CST",
    );
    expect(source).toContain("await rollback()");
  });
});
