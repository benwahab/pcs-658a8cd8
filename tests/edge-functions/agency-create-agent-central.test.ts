import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("central creation of organization field agents", () => {
  const edgeFunction = readSource(
    "supabase/edge-functions-source/agency-create-agent/index.ts",
  );
  const organizationService = readSource("src/pcs/services/organization.ts");
  const organizationPage = readSource("src/pcs/pages/OrganizationDashboard.tsx");

  it("requires an active central administrator or supervisor", () => {
    expect(edgeFunction).toContain('.in("role", ["admin", "supervisor"])');
    expect(edgeFunction).toContain('.eq("unit_type", "central")');
    expect(edgeFunction).toContain("Seule la centrale peut créer les comptes agents terrain.");
  });

  it("requires the central office to select one of its active agencies", () => {
    expect(edgeFunction).toContain("body.organization_unit_id");
    expect(edgeFunction).toContain('.eq("parent_unit_id", central.id)');
    expect(edgeFunction).toContain('.eq("unit_type", "agency")');
    expect(edgeFunction).toContain("organization_unit_id: agency.id");
  });

  it("provides the selected agency from the central dashboard", () => {
    expect(organizationService).toContain("organization_unit_id: string");
    expect(organizationPage).toContain("Agence de rattachement");
    expect(organizationPage).toContain("createAgencyAgent({ ...agentForm, organization_unit_id: agentAgencyUnitId })");
    expect(organizationPage).toContain("L'agence choisira ensuite l'agent chargé de chaque mission.");
  });
});
